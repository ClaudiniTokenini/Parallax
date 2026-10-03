const llmStatusEl = document.getElementById("llm-status");
const fbStatusEl = document.getElementById("fb-status");
const dashboardBtn = document.getElementById("dashboard-btn");
const connectBtn = document.getElementById("connect-btn");
const apiUrlInput = document.getElementById("api-url");

const DEFAULT_API = "http://127.0.0.1:8000";

dashboardBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

chrome.storage.local.get({ apiBaseUrl: DEFAULT_API }, (stored) => {
  apiUrlInput.value = stored.apiBaseUrl || DEFAULT_API;
  pingApi();
});

connectBtn.addEventListener("click", async () => {
  const apiBaseUrl = normalizeApiUrl(apiUrlInput.value);
  apiUrlInput.value = apiBaseUrl;
  connectBtn.disabled = true;

  try {
    const origin = `${new URL(apiBaseUrl).origin}/*`;
    await chrome.permissions.request({ origins: [origin, "http://*/*"] });
    await chrome.storage.local.set({ apiBaseUrl });
  } catch (error) {
    llmStatusEl.textContent = String(error);
    llmStatusEl.classList.add("err");
    connectBtn.disabled = false;
    return;
  }

  connectBtn.disabled = false;
  pingApi();
});

pingFeed();

function pingApi() {
  llmStatusEl.classList.remove("ok", "err");
  llmStatusEl.textContent = "Checking Parallax API…";

  chrome.runtime.sendMessage({ type: "PING_LLM" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      const detail = response?.error || chrome.runtime.lastError?.message || "offline";
      llmStatusEl.textContent = detail;
      llmStatusEl.classList.add("err");
      return;
    }

    llmStatusEl.textContent = `API ready · ${response.model} · ${response.baseUrl}`;
    llmStatusEl.classList.add("ok");
  });
}

function pingFeed() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id || !isSupportedFeedUrl(tab.url || "")) {
      fbStatusEl.textContent = "Open Facebook or X/Twitter, then refresh the tab.";
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "PING_CONTENT" }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        fbStatusEl.textContent =
          "Script not running. Click Reload on the extension, then refresh the tab.";
        fbStatusEl.classList.add("err");
        return;
      }

      const site = response.platform === "twitter" ? "X/Twitter" : "Facebook";
      const errorSuffix = response.lastError ? ` · ${response.lastError}` : "";
      fbStatusEl.textContent = `Active on ${site} · ${response.postsFound} posts found · ${response.postsScanned} classified${errorSuffix}`;
      fbStatusEl.classList.add(response.lastError ? "err" : "ok");
    });
  });
}

function normalizeApiUrl(value) {
  const trimmed = String(value || DEFAULT_API).trim().replace(/\/$/, "");
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Use http://");
    }
    return url.origin;
  } catch {
    return DEFAULT_API;
  }
}

function isSupportedFeedUrl(url) {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "facebook.com" ||
      hostname.endsWith(".facebook.com") ||
      hostname === "x.com" ||
      hostname.endsWith(".x.com") ||
      hostname === "twitter.com" ||
      hostname.endsWith(".twitter.com")
    );
  } catch {
    return false;
  }
}
