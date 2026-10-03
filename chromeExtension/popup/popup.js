const env = typeof PARALLAX_ENV === "object" && PARALLAX_ENV ? PARALLAX_ENV : {};
const DEFAULT_API = String(env.apiUrl || "http://127.0.0.1:8000").replace(/\/$/, "");
const DEFAULT_DASHBOARD = String(env.dashboardUrl || "http://127.0.0.1:3000").replace(/\/$/, "");

const llmStatusEl = document.getElementById("llm-status");
const fbStatusEl = document.getElementById("fb-status");
const dashboardStatusEl = document.getElementById("dashboard-status");
const dashboardBtn = document.getElementById("dashboard-btn");
const pairBtn = document.getElementById("pair-btn");
const pairingInput = document.getElementById("pairing-token");
const enabledToggle = document.getElementById("enabled-toggle");
const toggleLabel = document.getElementById("toggle-label");

dashboardBtn.addEventListener("click", () => {
  openDashboard();
});

chrome.storage.local.get({ enabled: true, pairingToken: "" }, (stored) => {
  pairingInput.value = stored.pairingToken || "";
  setToggle(stored.enabled !== false);
  pingApi();
});

enabledToggle.addEventListener("change", async () => {
  const enabled = enabledToggle.checked;
  setToggle(enabled);
  await chrome.storage.local.set({ enabled });
  chrome.runtime.sendMessage({ type: "SET_ENABLED", enabled }, () => {
    void chrome.runtime.lastError;
  });
  pingFacebook();
});

pairBtn.addEventListener("click", async () => {
  const pairingToken = String(pairingInput.value || "").trim();
  pairingInput.value = pairingToken;
  pairBtn.disabled = true;
  try {
    await chrome.permissions.request({
      origins: [
        `${new URL(DEFAULT_DASHBOARD).origin}/*`,
        `${new URL(DEFAULT_API).origin}/*`,
        "http://*/*"
      ]
    });
  } catch {
    // Permission may already be granted.
  }
  await chrome.storage.local.set({ pairingToken });
  pairBtn.disabled = false;
  pingDashboard();
  pingApi();
});

pingFeed();

function openDashboard() {
  chrome.runtime.sendMessage({ type: "PING_DASHBOARD" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
      return;
    }
    chrome.tabs.create({ url: response.baseUrl || DEFAULT_DASHBOARD });
  });
}

function setToggle(enabled) {
  enabledToggle.checked = enabled;
  toggleLabel.textContent = enabled ? "On — blur negative posts" : "Off — Facebook is unfiltered";
}

function pingApi() {
  llmStatusEl.classList.remove("ok", "err");
  llmStatusEl.textContent = "Checking classifier…";

  chrome.runtime.sendMessage({ type: "PING_LLM" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      const detail = response?.error || chrome.runtime.lastError?.message || "offline";
      llmStatusEl.textContent = detail;
      llmStatusEl.classList.add("err");
      return;
    }

    llmStatusEl.textContent = `Classifier ready · ${response.model || "local"}`;
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
    })
  })
}

function pingFacebook() {
  fbStatusEl.classList.remove("ok", "err");
  chrome.storage.local.get({ enabled: true }, (stored) => {
    if (stored.enabled === false) {
      fbStatusEl.textContent = "Feed protection is paused.";
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !isFacebookUrl(tab.url || "")) {
        fbStatusEl.textContent = "Open Facebook, then refresh the tab.";
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: "PING_CONTENT" }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          fbStatusEl.textContent =
            "Script not running. Reload the extension, then refresh Facebook.";
          fbStatusEl.classList.add("err");
          return;
        }

        const errorSuffix = response.lastError ? ` · ${response.lastError}` : "";
        fbStatusEl.textContent = `Watching Facebook · ${response.postsFound} posts · ${response.postsScanned} classified${errorSuffix}`;
        fbStatusEl.classList.add(response.lastError ? "err" : "ok");
      });
    });
  });
}

function pingDashboard() {
  dashboardStatusEl.classList.remove("ok", "err");
  dashboardStatusEl.textContent = "Checking dashboard…";

  chrome.runtime.sendMessage({ type: "PING_DASHBOARD" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      const detail =
        response?.error || chrome.runtime.lastError?.message || "Run npm run dev in dashboard/.";
      dashboardStatusEl.textContent = `Dashboard offline. ${detail}`;
      dashboardStatusEl.classList.add("err");
      return;
    }

    if (response.pairingError) {
      dashboardStatusEl.textContent = "Pairing code not recognized. Copy it from Settings.";
      dashboardStatusEl.classList.add("err");
      return;
    }

    dashboardStatusEl.textContent = response.paired
      ? `Paired as ${response.displayName || "You"} — events go to this profile.`
      : "Dashboard ready. Paste the pairing code from Settings.";
    dashboardStatusEl.classList.add("ok");
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
