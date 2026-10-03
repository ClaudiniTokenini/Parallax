const llmStatusEl = document.getElementById("llm-status");
const fbStatusEl = document.getElementById("fb-status");
const dashboardBtn = document.getElementById("dashboard-btn");
const connectBtn = document.getElementById("connect-btn");

const LM_ORIGINS = [
  "http://127.0.0.1/*",
  "http://localhost/*",
  "http://127.0.0.1:1234/*",
  "http://localhost:1234/*"
];

dashboardBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

connectBtn.addEventListener("click", async () => {
  connectBtn.disabled = true;
  try {
    await chrome.permissions.request({ origins: LM_ORIGINS });
  } catch (error) {
    llmStatusEl.textContent = String(error);
    llmStatusEl.classList.add("err");
  }
  connectBtn.disabled = false;
  pingApi();
});

pingApi();
pingFacebook();

function pingApi() {
  llmStatusEl.classList.remove("ok", "err");
  llmStatusEl.textContent = "Checking Parallax API…";

  chrome.runtime.sendMessage({ type: "PING_LLM" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      const detail = response?.error || chrome.runtime.lastError?.message || "offline";
      llmStatusEl.textContent = detail;
      llmStatusEl.classList.add("err");
      connectBtn.hidden = false;
      return;
    }

    llmStatusEl.textContent = `API ready · ${response.model}`;
    llmStatusEl.classList.add("ok");
    connectBtn.hidden = true;
  });
}

function pingFacebook() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id || !isFacebookUrl(tab.url || "")) {
      fbStatusEl.textContent = "Open Facebook, then refresh the tab.";
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "PING_CONTENT" }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        fbStatusEl.textContent =
          "Script not running. Click Reload on the extension, then refresh Facebook.";
        fbStatusEl.classList.add("err");
        return;
      }

      const errorSuffix = response.lastError ? ` · ${response.lastError}` : "";
      fbStatusEl.textContent = `Active on Facebook · ${response.postsFound} posts found · ${response.postsScanned} classified${errorSuffix}`;
      fbStatusEl.classList.add(response.lastError ? "err" : "ok");
    });
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
