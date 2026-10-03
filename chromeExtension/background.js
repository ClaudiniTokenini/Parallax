const DEFAULT_LM_STUDIO_BASES = [
  "http://127.0.0.1:1234",
  "http://localhost:1234"
];
const FALLBACK_MODEL = "enacimie/Qwen3-4B-Q4_K_M-GGUF";
const PRESET_NAME = "Parallax";

const CLASSIFICATION_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "post_classification",
    strict: true,
    schema: {
      type: "object",
      properties: {
        is_negative: {
          type: "boolean",
          description:
            "Czy post zawiera negatywny content, który powinien zostać ukryty przed użytkownikiem."
        }
      },
      required: ["is_negative"],
      additionalProperties: false
    }
  }
};

const SYSTEM_PROMPT = `You classify the emotional tone of social media posts.
Set is_negative=true if the post has a negative tone: sad, angry, scary, aggressive, violent, war-related, hateful, depressing, gloomy, outraged, insulting, anxious, or emotionally draining.
Set is_negative=false only when the post is clearly positive, neutral, informational, or light humor.
If unsure, set is_negative=true.`;

let cachedModelId = null;
let cachedBaseUrl = null;
let queue = Promise.resolve();
let contentStatus = {
  ok: false,
  postsFound: 0,
  postsScanned: 0,
  postsHidden: 0,
  lastError: "",
  updatedAt: 0
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CLASSIFY_POST") {
    enqueue(() => classifyPost(message.text))
      .then(sendResponse)
      .catch((error) => {
        console.warn("[Parallax] classify failed", error);
        sendResponse({
          ok: false,
          isNegative: false,
          error: explainNetworkError(error)
        });
      });
    return true;
  }

  if (message?.type === "PING_LLM") {
    pingLlm()
      .then(sendResponse)
      .catch((error) =>
        sendResponse({ ok: false, error: explainNetworkError(error) })
      );
    return true;
  }

  if (message?.type === "RECORD_STAT") {
    bumpStat(message.key)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "CONTENT_STATUS") {
    contentStatus = {
      ok: true,
      postsFound: Number(message.postsFound || 0),
      postsScanned: Number(message.postsScanned || 0),
      postsHidden: Number(message.postsHidden || 0),
      lastError: String(message.lastError || ""),
      updatedAt: Date.now()
    };
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "GET_RUNTIME_STATE") {
    sendResponse({ ok: true, contentStatus });
    return false;
  }

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!isFacebookUrl(tab.url || "")) return;

  chrome.scripting
    .executeScript({
      target: { tabId },
      files: ["content/facebook.js"],
      world: "ISOLATED"
    })
    .catch((error) => console.warn("[Parallax] inject failed", error));
});

function isFacebookUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === "facebook.com" || hostname.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function explainNetworkError(error) {
  const text = String(error?.message || error || "Unknown error");
  if (/Failed to fetch|NetworkError|Load failed/i.test(text)) {
    return "Cannot reach LM Studio at 127.0.0.1:1234. Start Developer → Local Server, enable CORS, then click Connect in the popup.";
  }
  return text;
}

async function getCandidateBases() {
  const stored = await chrome.storage.local.get({
    lmStudioBaseUrl: cachedBaseUrl || DEFAULT_LM_STUDIO_BASES[0]
  });
  const preferred = String(stored.lmStudioBaseUrl || DEFAULT_LM_STUDIO_BASES[0]).replace(
    /\/$/,
    ""
  );
  return [...new Set([preferred, ...DEFAULT_LM_STUDIO_BASES])];
}

async function lmFetch(path, init = {}) {
  const bases = await getCandidateBases();
  let lastError = null;

  for (const base of bases) {
    try {
      const response = await fetchLoopback(`${base}${path}`, init);
      cachedBaseUrl = base;
      await chrome.storage.local.set({ lmStudioBaseUrl: base });
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Cannot reach LM Studio");
}

async function fetchLoopback(url, init = {}) {
  const headers = {
    Accept: "application/json",
    Authorization: "Bearer lm-studio",
    ...(init.headers || {})
  };
  const options = {
    ...init,
    headers,
    cache: "no-store"
  };

  try {
    return await fetch(url, { ...options, targetAddressSpace: "loopback" });
  } catch (error) {
    return await fetch(url, options);
  }
}

async function getModelId() {
  if (cachedModelId) return cachedModelId;

  const response = await lmFetch("/v1/models", { method: "GET" });
  if (!response.ok) {
    throw new Error(`LM Studio /v1/models failed (${response.status})`);
  }

  const payload = await response.json();
  cachedModelId = payload?.data?.[0]?.id || FALLBACK_MODEL;
  return cachedModelId;
}

async function pingLlm() {
  cachedModelId = null;
  const model = await getModelId();
  return { ok: true, baseUrl: cachedBaseUrl, model };
}

async function classifyPost(text) {
  const content = String(text || "").trim();
  if (!content) {
    return { ok: true, isNegative: false };
  }

  const model = await getModelId();
  const body = {
    model,
    preset: PRESET_NAME,
    temperature: 0,
    max_tokens: 512,
    stream: false,
    enable_thinking: false,
    chat_template_kwargs: { enable_thinking: false },
    response_format: CLASSIFICATION_SCHEMA,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Classify this social media post.\n/no_think\n\n${content.slice(0, 3500)}`
      }
    ]
  };

  let response = await lmFetch("/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    if (response.status === 400 && /preset/i.test(details)) {
      delete body.preset;
      response = await lmFetch("/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }
    if (!response.ok) {
      const retryDetails = await response.text().catch(() => details);
      throw new Error(
        `LM Studio classify failed (${response.status}): ${retryDetails.slice(0, 200)}`
      );
    }
  }

  const payload = await response.json();
  const message = payload?.choices?.[0]?.message || {};
  const raw = extractMessageText(message);
  const isNegative = parseIsNegative(raw) ?? parseIsNegative(JSON.stringify(message.parsed || ""));
  console.info("[Parallax] llm", { isNegative, raw: String(raw).slice(0, 200) });
  return { ok: true, isNegative, raw: String(raw).slice(0, 200) };
}

function extractMessageText(message) {
  if (!message || typeof message !== "object") return "";
  if (message.parsed && typeof message.parsed === "object") {
    return JSON.stringify(message.parsed);
  }
  return [message.content, message.reasoning_content, message.reasoning]
    .map(asText)
    .filter(Boolean)
    .join("\n");
}

function asText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("\n");
  }
  return String(value);
}

function parseIsNegative(raw) {
  const cleaned = String(raw || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return false;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return coerceNegative(parsed.is_negative ?? parsed.isNegative ?? parsed.negative);
  } catch {
    return /"is_negative"\s*:\s*true/i.test(cleaned);
  }
}

function coerceNegative(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const text = String(value).trim().toLowerCase();
  return ["true", "yes", "tak", "1"].includes(text);
}

async function bumpStat(key) {
  const allowed = new Set(["postsScanned", "postsHidden"]);
  if (!allowed.has(key)) return;

  const current = await chrome.storage.local.get({
    postsScanned: 0,
    postsHidden: 0
  });
  await chrome.storage.local.set({ [key]: Number(current[key] || 0) + 1 });
}
