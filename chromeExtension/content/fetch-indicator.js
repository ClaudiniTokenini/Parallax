(() => {
  if (globalThis.ParallaxFetchIndicator) return;

  const HOST_ATTR = "data-parallax-fetch";
  const CHECK_MS = 500;
  const MIN_SPIN_MS = 250;
  const ENTER_MS = 280;
  const EXIT_MS = 220;

  const LOGO_SVG = `
    <svg class="logo" width="22" height="17" viewBox="0 0 44 34" fill="none" aria-hidden="true">
      <g clip-path="url(#plx-fetch-clip)">
        <g filter="url(#plx-fetch-shadow)">
          <circle cx="23" cy="17" r="14" fill="#F3E074"/>
        </g>
        <circle cx="14" cy="17" r="14" fill="#9568AE"/>
      </g>
      <defs>
        <filter id="plx-fetch-shadow" x="7" y="-1" width="36" height="36" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix"/>
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
          <feOffset dx="2"/>
          <feGaussianBlur stdDeviation="2"/>
          <feComposite in2="hardAlpha" operator="out"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0"/>
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1_115"/>
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_1_115" result="shape"/>
        </filter>
        <clipPath id="plx-fetch-clip">
          <rect width="44" height="34" fill="white"/>
        </clipPath>
      </defs>
    </svg>
  `;

  const SPINNER_SVG = `
    <svg class="status spin" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="#e4ddd2" stroke-width="2"/>
      <path d="M14 8a6 6 0 0 0-6-6" stroke="#cbb8f3" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;

  const CHECK_SVG = `
    <svg class="status check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.4 6.6 11.5 12.5 4.8" stroke="#29232d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  const STYLES = `
    :host { all: initial; }
    .toast {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: #fbf7f1;
      color: #29232d;
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(41, 35, 45, 0.14);
      font-family: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      transform: translateY(-120%);
      opacity: 0;
      pointer-events: none;
      will-change: transform, opacity;
    }
    .toast.in {
      transform: translateY(0);
      opacity: 1;
      transition:
        transform ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .toast.out {
      transform: translateY(-120%);
      opacity: 0;
      transition:
        transform ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1),
        opacity ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1);
    }
    .logo { display: block; flex-shrink: 0; }
    .status { width: 16px; height: 16px; display: block; flex-shrink: 0; }
    .spin { animation: plx-spin 0.7s linear infinite; }
    .check { animation: plx-pop 0.22s cubic-bezier(0.22, 1, 0.36, 1); }
    @keyframes plx-spin { to { transform: rotate(360deg); } }
    @keyframes plx-pop {
      from { transform: scale(0.7); opacity: 0.4; }
      to { transform: scale(1); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .toast.in, .toast.out { transition-duration: 0.01ms; }
      .spin { animation: none; }
      .check { animation: none; }
    }
  `;

  let host = null;
  let toast = null;
  let iconSlot = null;
  let live = null;
  let phaseTimer = 0;
  let shownAt = 0;
  let visible = false;
  let mode = "hidden";
  let observed = false;

  function ensure() {
    if (host?.isConnected && toast && iconSlot) {
      attach();
      return;
    }

    host = document.createElement("div");
    host.setAttribute(HOST_ATTR, "1");
    host.style.cssText = [
      "position:fixed",
      "top:16px",
      "right:16px",
      "z-index:2147483647",
      "pointer-events:none",
      "width:auto",
      "height:auto"
    ].join(";");

    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = STYLES;

    toast = document.createElement("div");
    toast.className = "toast out";
    toast.setAttribute("role", "status");
    toast.innerHTML = `${LOGO_SVG}<span class="icon">${SPINNER_SVG}</span>`;

    live = document.createElement("span");
    live.setAttribute("aria-live", "polite");
    live.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);";

    iconSlot = toast.querySelector(".icon");
    shadow.append(style, toast, live);
    attach();
    watchDom();
  }

  function attach() {
    const parent = document.body || document.documentElement;
    if (!parent || !host) return;
    if (host.parentElement !== parent) parent.appendChild(host);
  }

  function watchDom() {
    if (observed) return;
    observed = true;
    const observer = new MutationObserver(() => {
      if (host && !host.isConnected) attach();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function showLoading() {
    ensure();
    if (mode !== "loading") {
      iconSlot.innerHTML = SPINNER_SVG;
      if (live) live.textContent = "Parallax is checking posts";
    }
    mode = "loading";
    if (!visible) {
      visible = true;
      shownAt = Date.now();
      toast.classList.remove("in");
      toast.classList.add("out");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (mode === "hidden") return;
          toast.classList.remove("out");
          toast.classList.add("in");
        });
      });
      return;
    }
    toast.classList.remove("out");
    toast.classList.add("in");
  }

  function showDone() {
    if (!toast || mode === "hidden") return;
    mode = "done";
    iconSlot.innerHTML = CHECK_SVG;
    if (live) live.textContent = "Parallax finished checking posts";
    toast.classList.remove("out");
    toast.classList.add("in");
  }

  function hideToast() {
    if (!toast) return;
    visible = false;
    mode = "hidden";
    toast.classList.remove("in");
    toast.classList.add("out");
    if (live) live.textContent = "";
  }

  function setBusy(busy) {
    window.clearTimeout(phaseTimer);
    if (busy) {
      showLoading();
      return;
    }
    if (!visible && mode === "hidden") return;

    const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - shownAt));
    phaseTimer = window.setTimeout(() => {
      showDone();
      phaseTimer = window.setTimeout(hideToast, CHECK_MS);
    }, wait);
  }

  function hide() {
    window.clearTimeout(phaseTimer);
    hideToast();
  }

  globalThis.ParallaxFetchIndicator = { setBusy, hide };
})();
