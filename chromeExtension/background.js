try {
  importScripts("env.js");
} catch {
  // Generated on `npm run dev` in dashboard/. Falls back to localhost.
}

function envConfig() {
  const env = self.PARALLAX_ENV || {};
  return {
    dashboardUrl: String(env.dashboardUrl || "http://127.0.0.1:3000").replace(/\/$/, ""),
    apiUrl: String(env.apiUrl || "http://127.0.0.1:8000").replace(/\/$/, "")
  };
}

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

const DASHBOARD_FALLBACKS = ["http://127.0.0.1:3000", "http://localhost:3000"];

let cachedApiBase = null;
let cachedDashboardBase = null;

let cachedModelId = null;
let cachedBaseUrl = null;
let queue = Promise.resolve();
let dashboardLastError = "";
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

  if (message?.type === "RECORD_EVENT") {
    enqueue(() => ingestDashboardEvent(message))
      .then((result) => sendResponse(result))
      .catch((error) => {
        dashboardLastError = String(error?.message || error);
        console.warn("[Parallax] dashboard ingest failed", error);
        sendResponse({ ok: false, error: dashboardLastError });
      });
    return true;
  }

  if (message?.type === "SET_ENABLED") {
    const enabled = message.enabled !== false;
    chrome.storage.local.set({ enabled });
    broadcastToFacebook({ type: "SET_ENABLED", enabled });
    sendResponse({ ok: true, enabled });
    return false;
  }

  if (message?.type === "PING_DASHBOARD") {
    pingDashboard()
      .then(sendResponse)
      .catch((error) =>
        sendResponse({ ok: false, error: String(error?.message || error) })
      );
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
    sendResponse({
      ok: true,
      contentStatus,
      dashboardLastError,
      dashboardBase: cachedDashboardBase || DASHBOARD_FALLBACKS[0]
    });
    return false;
  }

  return false;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") return;
  chrome.storage.local.set({ enabled: true });
  openDashboardOnInstall();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  const url = tab.url || "";
  const file = isFacebookUrl(url)
    ? "content/facebook.js"
    : isTwitterUrl(url)
      ? "content/twitter.js"
      : null;
  if (!file) return;

  chrome.scripting
    .executeScript({
      target: { tabId },
      files: [file],
      world: "ISOLATED"
    })
    .catch((error) => console.warn("[Parallax] inject failed", error));
});

function openDashboardOnInstall() {
  pingDashboard()
    .then((result) => chrome.tabs.create({ url: result.baseUrl || DASHBOARD_FALLBACKS[0] }))
    .catch(() => chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") }));
}

function broadcastToFacebook(message) {
  chrome.tabs.query({ url: ["https://*.facebook.com/*", "https://facebook.com/*"] }, (tabs) => {
    for (const tab of tabs) {
      if (!tab.id) continue;
      chrome.tabs.sendMessage(tab.id, message, () => {
        void chrome.runtime.lastError;
      });
    }
  });
}

function isFacebookUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === "facebook.com" || hostname.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

function isTwitterUrl(url) {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "x.com" ||
      hostname.endsWith(".x.com") ||
      hostname === "twitter.com" ||
      hostname.endsWith(".twitter.com")
    );
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
    return "Cannot reach the classifier. Check NEXT_PUBLIC_CLASSIFIER_URL in dashboard/.env.local and that FastAPI is running.";
  }
  return text;
}

function getApiBase() {
  const base = envConfig().apiUrl.replace(/\/$/, "");
  cachedApiBase = base;
  return base;
}

async function apiFetch(path, init = {}) {
  const base = getApiBase();
  const response = await fetchLoopback(`${base}${path}`, init);
  cachedApiBase = base;
  return response;
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
    return await fetch(url, options);
  } catch (first) {
    const hostname = new URL(url).hostname;
    const isLoopback = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
    try {
      return await fetch(url, {
        ...options,
        targetAddressSpace: isLoopback ? "loopback" : "local"
      });
    } catch {
      throw first;
    }
  }
}

function dashboardFromApi(apiBase) {
  try {
    const api = new URL(String(apiBase || "").replace(/\/$/, ""));
    return `${api.protocol}//${api.hostname}:3000`;
  } catch {
    return "";
  }
}

function dashboardCandidates() {
  const env = envConfig();
  const list = [
    env.dashboardUrl,
    cachedDashboardBase,
    dashboardFromApi(env.apiUrl),
    ...DASHBOARD_FALLBACKS
  ]
    .map((value) => String(value || "").replace(/\/$/, ""))
    .filter(Boolean);
  return [...new Set(list)];
}

async function getPairingToken() {
  const stored = await chrome.storage.local.get({ pairingToken: "" });
  return String(stored.pairingToken || "").trim();
}

async function ingestDashboardEvent(message) {
  const token = await getPairingToken();
  const payload = {
    eventType: message.eventType,
    platform: message.platform || "facebook",
    postId: message.postId,
    isNegative: message.isNegative,
    occurredAt: message.occurredAt || new Date().toISOString(),
    pairingToken: token || undefined
  };

  const bases = await dashboardCandidates();
  let lastError = "Dashboard offline";
  for (const base of bases) {
    try {
      const response = await fetchLoopback(`${base}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const details = await response.text().catch(() => "");
        lastError = `Dashboard ingest failed (${response.status}): ${details.slice(0, 160)}`;
        continue;
      }
      cachedDashboardBase = base;
      dashboardLastError = "";
      return response.json();
    } catch (error) {
      lastError = String(error?.message || error);
    }
  }

  throw new Error(lastError);
}

async function pingDashboard() {
  const token = await getPairingToken();
  const bases = await dashboardCandidates();
  let lastError = "Dashboard offline";

  for (const base of bases) {
    try {
      const url = new URL(`${base}/api/health`);
      if (token) url.searchParams.set("token", token);
      const response = await fetchLoopback(url.toString(), { method: "GET" });
      if (!response.ok) {
        lastError = `Dashboard offline (${response.status}) at ${base}`;
        continue;
      }
      const payload = await response.json();
      cachedDashboardBase = base;
      dashboardLastError = "";
      return { ok: true, ...payload, baseUrl: base };
    } catch (error) {
      lastError = `${base}: ${String(error?.message || error)}`;
    }
  }

  throw new Error(lastError);
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
