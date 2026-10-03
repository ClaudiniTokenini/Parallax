(() => {
  if (globalThis.__PARALLAX_TW__) return;
  globalThis.__PARALLAX_TW__ = true;

  const SLOGANS = [
    "Nothing to see here",
    "Keep scrolling",
    "Move along",
    "Not worth your time",
    "Skip this one"
  ];

  const OVERLAY_ATTR = "data-parallax-overlay";
  const HOST_ATTR = "data-parallax-id";
  const BADGE_ATTR = "data-parallax-badge";

  const CACHE_KEY = "plxTwClassified";
  const classified = new Map();
  const inFlight = new Set();
  const failedUntil = new Map();
  const overlays = new Map();
  const revealedNodes = new WeakSet();
  let sloganIndex = 0;
  let scanTimer = 0;
  let lastFoundCount = 0;
  let lastError = "";
  let badgeDismissed = false;
  let overlaySyncStarted = false;
  let enabled = true;
  let badgeLabel = null;
  let persistTimer = 0;

  chrome.storage.local.get({ enabled: true, [CACHE_KEY]: {} }, (stored) => {
    enabled = stored.enabled !== false;
    hydrateClassified(stored[CACHE_KEY]);
    applyEnabledState(true);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      applyEnabledState(true);
    }
    if (changes[CACHE_KEY]?.newValue) {
      hydrateClassified(changes[CACHE_KEY].newValue);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "PING_CONTENT") {
      sendResponse(getContentStatus());
      return false;
    }
    if (message?.type === "RESCAN") {
      if (enabled) scanFeed();
      sendResponse(getContentStatus());
      return false;
    }
    if (message?.type === "SET_ENABLED") {
      enabled = message.enabled !== false;
      applyEnabledState(true);
      sendResponse(getContentStatus());
      return false;
    }
    return false;
  });

  log("content script loaded");
  reportStatus();
  observeFeed();
  whenReady(() => {
    ensureBadge();
  });

  function whenReady(fn) {
    if (document.body) {
      fn();
      return;
    }
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  function observeFeed() {
    const observer = new MutationObserver(() => {
      window.clearTimeout(scanTimer);
      scanTimer = window.setTimeout(() => {
        if (!badgeDismissed) ensureBadge();
        scanFeed();
      }, 250);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function applyEnabledState(rescan) {
    updateBadgeText();
    if (!enabled) {
      pauseOverlays();
      reportStatus();
      return;
    }
    if (rescan) scanFeed();
    reportStatus();
  }

  function pauseOverlays() {
    for (const [id, rec] of [...overlays.entries()]) {
      revealPost(rec?.article || rec?.cover, id, false);
    }
  }

  function scanFeed() {
    if (!enabled) {
      reportStatus();
      return;
    }
    const posts = findFeedPosts();
    lastFoundCount = posts.length;
    for (const post of posts) {
      processPost(post);
    }
    syncOverlays();
    reportStatus();
  }

  function findFeedPosts() {
    const posts = [];
    const seen = new Set();
    const candidates = document.querySelectorAll('article[data-testid="tweet"]');

    for (const article of candidates) {
      if (!article || seen.has(article) || !isTopLevelTweet(article)) continue;
      seen.add(article);
      posts.push(article);
    }

    return posts;
  }

  function isTopLevelTweet(article) {
    if (!(article instanceof Element)) return false;
    if (article.closest('[role="dialog"], [role="complementary"], [role="banner"]')) return false;
    if (article.parentElement?.closest('article[data-testid="tweet"]')) return false;
    if (article.hasAttribute(OVERLAY_ATTR) || article.hasAttribute(BADGE_ATTR)) return false;
    if (article.closest(`[${OVERLAY_ATTR}], [${BADGE_ATTR}]`)) return false;
    return true;
  }

  function processPost(article) {
    const cover = getCoverTarget(article);
    if (
      revealedNodes.has(article) ||
      revealedNodes.has(cover) ||
      article.dataset.parallaxState === "revealed" ||
      cover?.dataset.parallaxState === "revealed"
    ) {
      clearArticleDim(article);
      clearArticleDim(cover);
      return;
    }

    const text = extractPostContent(article);
    if (!text) return;

    const id = fingerprint(text);
    article.setAttribute(HOST_ATTR, id);

    const state = classified.get(id);
    if (state?.revealed) {
      revealPost(article, id, false);
      return;
    }
    if (state?.isNegative) {
      hidePost(article, id);
      return;
    }
    if (state && state.isNegative === false) return;
    if (inFlight.has(id)) return;
    if ((failedUntil.get(id) || 0) > Date.now()) return;

    inFlight.add(id);
    recordStat("postsScanned");
    log("classifying", text.slice(0, 80));

    chrome.runtime.sendMessage({ type: "CLASSIFY_POST", text, postId: id }, (response) => {
      inFlight.delete(id);

      if (chrome.runtime.lastError) {
        lastError = chrome.runtime.lastError.message;
        failedUntil.set(id, Date.now() + 20000);
        log("runtime error", lastError);
        reportStatus();
        return;
      }
      if (!response?.ok) {
        lastError = response?.error || "Classification failed";
        failedUntil.set(id, Date.now() + 20000);
        log("classify failed", lastError);
        reportStatus();
        return;
      }

      lastError = "";
      failedUntil.delete(id);
      rememberClassified(id, { isNegative: Boolean(response.isNegative), revealed: false });
      recordEvent("classified", id, Boolean(response.isNegative));
      log(`result negative=${Boolean(response.isNegative)}`, text.slice(0, 80));
      if (response.isNegative) {
        const target = findArticleById(id) || resolveArticle(article, id);
        if (target) hidePost(target, id);
        else log("negative post node not found", id);
      }
      reportStatus();
    });
  }

  function extractPostContent(article) {
    const textEl = article.querySelector('[data-testid="tweetText"]');
    let message = textEl?.innerText?.trim() || "";

    if (!message) {
      const blocks = [...article.querySelectorAll('div[dir="auto"], span')]
        .map((node) => node.innerText.trim())
        .filter((value) => value.length > 20);
      message = pickLongestUnique(blocks);
    }

    const imageAlts = [...article.querySelectorAll("img[alt]")]
      .map((img) => img.alt.trim())
      .filter((alt) => isUsefulAlt(alt));

    const parts = [];
    if (message) parts.push(cleanUiNoise(message));
    if (imageAlts.length) parts.push(`Image descriptions: ${imageAlts.slice(0, 4).join(" | ")}`);

    const combined = parts.join("\n").replace(/\s+\n/g, "\n").trim();
    if (combined.length < 8) return "";
    return combined.slice(0, 1200);
  }

  function hidePost(article, id) {
    if (classified.get(id)?.revealed) return;
    const cover = getCoverTarget(article);
    if (revealedNodes.has(article) || revealedNodes.has(cover)) return;

    startOverlaySync();
    dimArticle(cover);

    let rec = overlays.get(id);
    if (!rec) {
      rec = { host: createOverlayHost(id), article, cover };
      (document.body || document.documentElement).appendChild(rec.host);
      overlays.set(id, rec);
      const prev = classified.get(id) || { isNegative: true, revealed: false };
      if (!prev.countedHidden) {
        rememberClassified(id, { ...prev, isNegative: true, countedHidden: true });
        recordStat("postsHidden");
        recordEvent("hidden", id, true);
      }
      log("hiding post", id);
    }

    rec.article = article;
    rec.cover = cover;
    cover.dataset.parallaxState = "hidden";
    positionOverlay(rec);
  }

  function getCoverTarget(article) {
    if (!(article instanceof Element)) return article;
    const cell = article.closest('[data-testid="cellInnerDiv"]');
    if (cell) return cell;
    return article;
  }

  function createOverlayHost(id) {
    const host = document.createElement("div");
    host.setAttribute(OVERLAY_ATTR, id);
    host.style.cssText = [
      "position:fixed",
      "z-index:2147483645",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      "padding:24px 16px",
      "background:transparent",
      "text-align:center",
      "pointer-events:auto",
      "box-sizing:border-box"
    ].join(";");

    const shadow = host.attachShadow({ mode: "closed" });
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:auto;height:auto;padding:20px 28px;border-radius:20px;background:rgba(12,16,28,0.45);font-family:system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

    const slogan = document.createElement("p");
    slogan.textContent = nextSlogan();
    slogan.style.cssText =
      "margin:0;color:#fff;font-size:clamp(20px,4vw,28px);line-height:1.2;font-weight:800;letter-spacing:-0.02em;text-shadow:0 2px 12px rgba(0,0,0,0.65);";

    const label = document.createElement("p");
    label.textContent = "(negative content)";
    label.style.cssText =
      "margin:0 0 8px;color:#fff;font-size:14px;font-weight:500;opacity:0.92;text-shadow:0 1px 8px rgba(0,0,0,0.7);";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Show anyway";
    button.style.cssText =
      "appearance:none;border:0;background:#fff;color:#111;font-size:14px;font-weight:700;padding:10px 22px;border-radius:999px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.25);pointer-events:auto;";

    const reveal = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const rec = overlays.get(id);
      revealPost(rec?.article || rec?.cover, id, true);
    };
    button.addEventListener("pointerdown", reveal, true);
    button.addEventListener("click", reveal, true);

    wrap.append(slogan, label, button);
    shadow.append(wrap);
    host.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    return host;
  }

  function dimArticle(target) {
    if (!target) return;
    target.style.setProperty("filter", "blur(26px)", "important");
    target.style.setProperty("overflow", "hidden", "important");
    target.style.setProperty("pointer-events", "none", "important");
    target.style.setProperty("user-select", "none", "important");
  }

  function clearArticleDim(target) {
    if (!target) return;
    target.style.removeProperty("filter");
    target.style.removeProperty("overflow");
    target.style.removeProperty("pointer-events");
    target.style.removeProperty("user-select");
    target.style.removeProperty("opacity");
  }

  function positionOverlay(rec) {
    const article = rec.article;
    const host = rec.host;
    if (!article?.isConnected) {
      host.style.display = "none";
      return;
    }

    const cover = rec.cover?.isConnected ? rec.cover : getCoverTarget(article);
    rec.cover = cover;
    const rect = cover.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) {
      host.style.display = "none";
      return;
    }

    host.style.display = "flex";
    host.style.top = `${Math.round(rect.top)}px`;
    host.style.left = `${Math.round(rect.left)}px`;
    host.style.width = `${Math.round(rect.width)}px`;
    host.style.height = `${Math.round(rect.height)}px`;
  }

  function syncOverlays() {
    for (const [id, rec] of overlays) {
      const state = classified.get(id);
      if (state?.revealed) {
        rec.host.remove();
        overlays.delete(id);
        continue;
      }
      const article = rec.article?.isConnected ? rec.article : findArticleById(id);
      if (!article || revealedNodes.has(article) || classified.get(id)?.revealed) {
        if (classified.get(id)?.revealed || revealedNodes.has(article)) {
          rec.host.remove();
          overlays.delete(id);
        } else {
          rec.host.style.display = "none";
        }
        continue;
      }
      rec.article = article;
      rec.cover = getCoverTarget(article);
      dimArticle(rec.cover);
      positionOverlay(rec);
    }
  }

  function startOverlaySync() {
    if (overlaySyncStarted) return;
    overlaySyncStarted = true;
    document.addEventListener("scroll", syncOverlays, true);
    window.addEventListener("resize", syncOverlays);
    window.setInterval(syncOverlays, 500);
  }

  function revealPost(article, id, markRevealed) {
    const rec = overlays.get(id);
    if (markRevealed) {
      const prev = classified.get(id) || { isNegative: true, revealed: false };
      rememberClassified(id, { ...prev, revealed: true });
      recordEvent("revealed", id, true);
    }

    const nodes = [article, rec?.article, rec?.cover];
    for (const node of nodes) {
      if (!node) continue;
      revealedNodes.add(node);
      node.dataset.parallaxState = "revealed";
      clearArticleDim(node);
    }

    if (rec?.host) rec.host.remove();
    overlays.delete(id);
  }

  function findArticleById(id) {
    for (const post of findFeedPosts()) {
      const text = extractPostContent(post);
      if (text && fingerprint(text) === id) return post;
      if (post.getAttribute(HOST_ATTR) === id) return post;
    }
    return document.querySelector(`[${HOST_ATTR}="${CSS.escape(id)}"]`);
  }

  function ensureBadge() {
    if (badgeDismissed) return;
    if (document.querySelector(`[${BADGE_ATTR}]`)) return;
    if (!document.body) return;

    const host = document.createElement("div");
    host.setAttribute(BADGE_ATTR, "1");
    host.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:2147483646",
      "pointer-events:auto"
    ].join(";");

    const shadow = host.attachShadow({ mode: "closed" });
    const pill = document.createElement("div");
    pill.style.cssText =
      "display:flex;align-items:center;gap:8px;background:#0c101c;color:#f4f7fb;border:1px solid #38d6c4;border-radius:999px;padding:8px 10px 8px 12px;font:600 12px/1.2 system-ui,'Segoe UI',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.35);";

    const label = document.createElement("span");
    badgeLabel = label;
    label.textContent = enabled ? "Parallax is scanning this feed" : "Parallax is paused";

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.style.cssText =
      "appearance:none;border:0;background:transparent;color:#9aa7b8;font-size:16px;cursor:pointer;line-height:1;";
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      badgeDismissed = true;
      host.remove();
    });

    pill.append(label, close);
    shadow.append(pill);
    document.body.appendChild(host);
  }

  function resolveArticle(article, id) {
    if (article?.isConnected) return article;
    return document.querySelector(`[${HOST_ATTR}="${CSS.escape(id)}"]`);
  }

  function pickLongestUnique(blocks) {
    const unique = [];
    for (const block of blocks.sort((a, b) => b.length - a.length)) {
      if (unique.some((existing) => existing.includes(block))) continue;
      unique.push(block);
      if (unique.length >= 2) break;
    }
    return unique.join("\n");
  }

  function isUsefulAlt(alt) {
    if (!alt || alt.length < 8) return false;
    if (/profile|avatar|emoji|ikona/i.test(alt)) return false;
    return true;
  }

  function cleanUiNoise(text) {
    return text
      .replace(
        /\b(Reply|Repost|Quote|Like|Likes|Views?|Bookmark|Share|Follow|Show more|Show replies|From|Promoted)\b/gi,
        " "
      )
      .replace(/\d+(\.\d+)?[KM]?\s*(replies|reposts|likes|views|quotes)/gi, " ")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function nextSlogan() {
    const slogan = SLOGANS[sloganIndex % SLOGANS.length];
    sloganIndex += 1;
    return slogan;
  }

  function fingerprint(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function updateBadgeText() {
    if (badgeLabel) {
      badgeLabel.textContent = enabled
        ? "Parallax is scanning this feed"
        : "Parallax is paused";
    }
  }

  function getContentStatus() {
    return {
      ok: true,
      enabled,
      postsFound: lastFoundCount,
      postsScanned: classified.size,
      postsHidden: [...classified.values()].filter((state) => state.isNegative && !state.revealed)
        .length,
      lastError,
      platform: "twitter"
    };
  }

  function reportStatus() {
    chrome.runtime.sendMessage({ type: "CONTENT_STATUS", ...getContentStatus() }, () => {
      void chrome.runtime.lastError;
    });
  }

  function recordStat(key) {
    chrome.runtime.sendMessage({ type: "RECORD_STAT", key }, () => {
      void chrome.runtime.lastError;
    });
  }

  function recordEvent(eventType, postId, isNegative) {
    chrome.runtime.sendMessage(
      {
        type: "RECORD_EVENT",
        eventType,
        platform: "twitter",
        postId,
        isNegative,
        occurredAt: new Date().toISOString()
      },
      () => {
        void chrome.runtime.lastError;
      }
    );
  }

  function hydrateClassified(cache) {
    for (const [id, state] of Object.entries(cache || {})) {
      if (!id || !state || typeof state !== "object") continue;
      classified.set(id, state);
    }
  }

  function rememberClassified(id, state) {
    classified.set(id, state);
    persistClassified();
  }

  function persistClassified() {
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      const entries = [...classified.entries()].slice(-500);
      chrome.storage.local.set({ [CACHE_KEY]: Object.fromEntries(entries) });
    }, 200);
  }

  function log(...args) {
    console.info("[Parallax]", ...args);
  }
})();
