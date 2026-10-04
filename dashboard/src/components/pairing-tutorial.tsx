"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const SHOW_KEY = "parallax-show-tutorial";
const SEEN_KEY = "parallax-tutorial-dismissed";

export function PairingTutorial({ displayName }: { displayName: string }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const shouldShow =
      sessionStorage.getItem(SHOW_KEY) === "1" || localStorage.getItem(SEEN_KEY) !== "1";
    if (shouldShow) setOpen(true);
  }, []);

  const close = useCallback(() => {
    sessionStorage.removeItem(SHOW_KEY);
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  const greetingName = displayName.trim() || "there";

  const modal =
    mounted && open ? (
      <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[#1d1a16]/55 px-4 py-8 sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative w-full max-w-3xl rounded-[28px] bg-[#fbf7f1] p-6 shadow-[0_24px_80px_rgba(29,26,22,0.28)] sm:p-8"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-lg text-[#7a746b] hover:bg-[#f3eee6]"
          >
            ×
          </button>

          <p className="text-xs tracking-[0.22em] text-[#7a746b]">QUICK SETUP</p>
          <h2 id={titleId} className="serif mt-2 pr-10 text-3xl leading-tight sm:text-4xl">
            Hi {greetingName}.
          </h2>
          <p className="mt-3 max-w-2xl text-[#7a746b]">
            Parallax needs your browser extension linked to this account. Open{" "}
            <span className="font-medium text-[#1d1a16]">Settings</span>, copy the pairing code, then
            paste it into the extension. That is how feed protection and post stats stay on your
            profile.
          </p>
          <p className="mt-2 text-sm text-[#9a9388]">You only have to do this once.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Step n={1} title="Go to Settings">
              <div className="pointer-events-none select-none rounded-2xl bg-white/80 p-3">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full px-2.5 py-1 text-[11px] text-[#7a746b]">Overview</span>
                  <span className="rounded-full bg-[#efe8ff] px-2.5 py-1 text-[11px] text-[#1d1a16]">
                    Settings
                  </span>
                </div>
              </div>
            </Step>

            <Step n={2} title="Copy the code">
              <div className="pointer-events-none select-none rounded-2xl bg-white/80 p-3">
                <p className="text-[11px] text-[#7a746b]">Pairing code</p>
                <div className="mt-1.5 rounded-xl bg-[#fbf7f1] px-3 py-2 font-mono text-[11px] text-[#1d1a16]">
                  plx_your_pairing_code
                </div>
                <span className="mt-2 inline-flex rounded-full bg-[#efe8ff] px-3 py-1 text-[11px] font-medium">
                  Copy code
                </span>
              </div>
            </Step>

            <Step n={3} title="Paste it in the extension">
              <div className="pointer-events-none select-none rounded-2xl bg-white/80 p-3">
                <p className="text-[11px] text-[#7a746b]">Pairing code</p>
                <div className="mt-1.5 rounded-xl border border-[#e4ddd2] bg-white px-3 py-2 text-[11px] text-[#9a9388]">
                  plx_…
                </div>
                <span className="mt-2 inline-flex w-full justify-center rounded-full bg-[#efe8ff] px-3 py-1.5 text-[11px] font-medium">
                  Save pairing code
                </span>
              </div>
            </Step>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={close}
              className="rounded-full bg-[#cbb8f3] px-6 py-2 text-sm font-medium text-[#1d1a16]"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Help"
        title="Help"
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#7a746b] hover:bg-[#f3eee6]"
      >
        <HelpIcon />
      </button>
      {modal ? createPortal(modal, document.body) : null}
    </>
  );
}

function Step({
  n,
  title,
  children
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.16em] text-[#7a746b]">
        STEP {n}
      </p>
      <p className="mt-1 text-sm font-medium">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function HelpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9.4 9.3c.2-1.4 1.35-2.3 2.7-2.3 1.45 0 2.55.9 2.55 2.25 0 1.05-.55 1.65-1.55 2.2-.9.5-1.2.9-1.2 1.65v.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.7" r="0.95" fill="currentColor" />
    </svg>
  );
}

export function markTutorialAfterLogin() {
  try {
    sessionStorage.setItem(SHOW_KEY, "1");
  } catch {
    /* ignore */
  }
}
