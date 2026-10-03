# Packaging Parallax for a real user

The end goal: someone unzips or installs Parallax in Chrome and it works. No VS Code, no `npm`, no LM Studio window.

That is **not true today**. This page says why, what “build” means, and which packaging paths get us there.

## What a user has to run today

Parallax is three local pieces, not one extension file:

| Piece | What it is | Port | Needed for |
| --- | --- | --- | --- |
| Chrome extension | Plain JS in `chromeExtension/` | — | Blur Facebook, open dashboard |
| Dashboard | Next.js + SQLite | `127.0.0.1:3000` | UI, Polar, insight engine, event store |
| Classifier | FastAPI (and behind it a local model / LM Studio) | `127.0.0.1:8000` | Decide if a post is negative |

Installing only the extension gives you the popup and Facebook script. **Show dashboard** still needs the Next server. Blurring still needs the classifier API.

You do **not** have to “build” the extension with webpack. You **do** have to run (or package) the two Node/Python servers unless we change the architecture.

## Dev way vs user way (current repo)

### Developer (what you do in the hackathon)

1. Clone the repo.
2. `cd dashboard && npm install && npm run seed && npm run dev`
3. Start the FastAPI classifier (and LM Studio if that is how the API loads the model).
4. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → `chromeExtension`.
5. On first install the extension opens the dashboard (or a fallback page if port 3000 is down).
6. Pin the icon. Open Facebook. Use the popup toggle to pause protection.

Reload the extension after JS changes. Refresh Facebook after content-script changes. No extension compile step.

`npm run build` in `dashboard/` is optional. Use it when you want production Next (`npm start`) instead of the dev server. The extension does not consume that build today.

### “User” on this laptop, still a developer machine

Same as above, minus VS Code. They still need Node, the dashboard command, and the classifier. Zipping `chromeExtension` alone is not enough.

### Store / unzip user (the goal)

They should only:

1. Install the extension (Chrome Web Store, or “Load unpacked” on a zip).
2. Maybe click **Add** once.
3. Use Facebook and **Show dashboard**.

That requires one of the packaging options below.

## Do we have to host the model on a server?

**No, not required.** Three honest options:

### 1. Keep the model on the user’s machine (local)

Best fit for the “no cloud backend” brief.

- **Sidecar app** (recommended local product): a small installer (Tauri, Electron, or a `.bat` + embedded Node) starts the dashboard and the classifier. The extension keeps talking to `127.0.0.1`.
- **In-extension model**: run a tiny classifier inside Chrome (Transformers.js / ONNX in an offscreen document). No extra process. The model must be small.

A **Qwen 3 / 4B GGUF** is the wrong size to put inside the extension:

- Download about **2–3 GB**
- RAM often **6–8 GB** while classifying
- WASM / WebGPU in Chrome is slow or fails on many laptops

That model is fine **next to** the browser (LM Studio, llama.cpp, FastAPI on the machine). It is too heavy to ship *as* the extension.

A **tiny** on-device model is realistic in the extension:

- DistilBERT / MiniLM / a custom ONNX sentiment head: **tens to ~250 MB**
- Fast enough for feed posts
- Weaker than Qwen, good enough for “negative vs not”

### 2. Host the model on a server

Easiest “it just works” UX. The extension calls `https://…/classify`. Dashboard can be the same host.

- Need a GPU or a small always-on box for 4B-class models
- Breaks the current non-goal of “no cloud backend”
- Privacy: post text leaves the machine unless you only send fingerprints (then you cannot classify)

Use this if the hackathon demo must work on a judge’s phone-hotspot laptop with zero installs.

### 3. Hybrid

Ship a tiny on-device fallback. If the user installs the sidecar (or we detect localhost), use the stronger local model.

## Dashboard: can it live only in the extension?

The popup can open a page without Next.js (`chrome.runtime.getURL(...)`). A **static** dashboard inside the extension could read `chrome.storage` and skip Node.

What you lose if you drop the Next server:

- SQLite file you can open in DB Browser
- Polar OAuth client secret and callback on `127.0.0.1:3000`
- Insight engine as a shared API

What you keep:

- Counts, toggle, “open dashboard” that always works after install

A shipped product can do **both**: extension pages for the empty/offline shell, and a sidecar or hosted app for Polar + history.

## Practical packaging paths

### A. Zip + start script (weekend / jury laptop you control)

Zip:

- `chromeExtension/`
- `dashboard/` (after `npm install`, or document that they run it)
- classifier folder + `start.bat` / `start.sh`

Jury: run start script, load unpacked extension. Still developer-ish, but no VS Code.

### B. Chrome Web Store zip (extension only)

Zip **only** `chromeExtension/`. Chrome does not run Next or Python for you.

Only choose this if classify + dashboard are **hosted** or **in-extension**.

Store listing: no “load unpacked”. Updates go through the store.

### C. Sidecar installer + unpacked or store extension (best local-first)

1. One `.exe` / `.msi` / `.dmg` starts dashboard + classifier (bundled Node + GGUF *or* a small ONNX).
2. Extension from the store, pointed at `127.0.0.1`.
3. First install: `onInstalled` already opens the dashboard tab.

Weight if you bundle Qwen 4B: installer **~3 GB**. Weight if you bundle MiniLM: **under 300 MB**.

### D. Full in-browser (closest to “unzip and go”)

- Move dashboard UI to extension pages + `chrome.storage` / IndexedDB
- Classify with Transformers.js (small model)
- Polar later via a hosted OAuth helper, or skip Polar in the unzip build

This is the only path that is *literally* “install the extension, nothing else.”

## Recommendation

| Goal | Do this |
| --- | --- |
| Hackathon on your machine | Keep current: unpacked extension + `npm run dev` + local API |
| Judge with no tools, 5 minutes | Host classify + dashboard **or** bring a USB with the sidecar already running |
| Real local product | Sidecar + small-or-bundled model; do not put 4B GGUF inside Chrome |
| True single install | Small in-extension model + dashboard as an extension page |

**You do not host the model unless you choose path B/hosted.** Local sidecar or a small on-device model is enough. A 4B chat model is local-possible and extension-impractical.

## What we already wired for install

On **first add** of the extension, the service worker opens the dashboard the same way **Show dashboard** does:

- If `http://127.0.0.1:3000/api/health` answers, that tab opens
- If not, `dashboard.html` opens with the `npm run dev` instructions and retries the health check

You do not need a separate “build the extension” step for that. You still need the dashboard process for the real UI.
