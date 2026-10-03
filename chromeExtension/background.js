const API_BASES = ["http://127.0.0.1:8000", "http://localhost:8000"];

let cachedApiBase = null;
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
    pingApi()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: explainNetworkError(error) }));
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
    return "Cannot reach Parallax API at 127.0.0.1:8000. Start the FastAPI server.";
  }
  return text;
}

async function getCandidateBases() {
  const stored = await chrome.storage.local.get({
    apiBaseUrl: cachedApiBase || API_BASES[0]
  });
  const preferred = String(stored.apiBaseUrl || API_BASES[0]).replace(/\/$/, "");
  return [...new Set([preferred, ...API_BASES])];
}

async function apiFetch(path, init = {}) {
  const bases = await getCandidateBases();
  let lastError = null;

  for (const base of bases) {
    try {
      const response = await fetchLoopback(`${base}${path}`, init);
      cachedApiBase = base;
      await chrome.storage.local.set({ apiBaseUrl: base });
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Cannot reach Parallax API");
}

async function fetchLoopback(url, init = {}) {
  const options = {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  };

  try {
    return await fetch(url, { ...options, targetAddressSpace: "loopback" });
  } catch {
    return await fetch(url, options);
  }
}

async function pingApi() {
  const response = await apiFetch("/health", { method: "GET" });
  if (!response.ok) {
    throw new Error(`Parallax API /health failed (${response.status})`);
  }
  const payload = await response.json();
  if (!payload?.ok) {
    throw new Error(payload?.error || "Parallax API cannot reach LM Studio");
  }
  return { ok: true, baseUrl: cachedApiBase, model: payload.model };
}

async function classifyPost(text) {
  const content = String(text || "").trim();
  if (!content) {
    return { ok: true, isNegative: false };
  }

  const response = await apiFetch("/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: content })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Parallax API classify failed (${response.status})`);
  }

  const isNegative = Boolean(payload.isNegative ?? payload.is_negative);
  console.info("[Parallax] api", { isNegative });
  return { ok: true, isNegative };
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
