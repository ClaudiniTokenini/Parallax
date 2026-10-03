# Architecture

Parallax has two local processes plus Chrome:

1. Chrome extension — scans Facebook, classifies posts via LM Studio, blurs negatives
2. LM Studio — local OpenAI-compatible model on port 1234
3. Next.js dashboard — local UI, SQLite store, Polar proxy, insight engine on port 3000

There is no cloud product backend. Next.js API routes run on the same machine as the browser.

```
Facebook tab
    │
    ▼
content script ──CLASSIFY_POST──► background.js ──► LM Studio :1234
    │                               │
    │ hidden / revealed             │
    └──────── RECORD_EVENT ─────────┴── loopback POST /api/events
                                              │
                                              ▼
                                       Next.js :3000
                                              │
                         ┌────────────────────┼────────────────────┐
                         ▼                    ▼                    ▼
                   parallax.db            Polar API          Insight engine
                         │                                         │
                         └──────────────────► UI pages ◄───────────┘
```

## Why Next.js is the local backend

The dashboard is a normal `http://127.0.0.1:3000` site. It cannot read `chrome.storage`. Polar needs a client secret and a redirect URI. Both belong on a local Node process, not in the extension.

A second Express server would only add another process. API routes in the dashboard app are enough.

## What is stored where

| Data | Store |
| --- | --- |
| Lifetime popup counters | `chrome.storage.local` (`postsScanned`, `postsHidden`) |
| Event history, Polar tokens, sleep, workouts | `dashboard/data/parallax.db` |
| LM Studio base URL | `chrome.storage.local` |
| Polar client id/secret | `dashboard/.env.local` |

Post text is never stored. See [DATA.md](DATA.md).

## Ports and origins

- Dashboard: `http://127.0.0.1:3000`
- LM Studio: `http://127.0.0.1:1234`
- Extension origin: `chrome-extension://<id>`

The service worker already has host permissions for localhost. It posts events with `targetAddressSpace: "loopback"` so Chrome Private Network Access does not block the call. The API answers CORS for `chrome-extension://*` and `Access-Control-Allow-Private-Network: true`.

## Failure isolation

If the dashboard is down, classification and blur still work. Event ingest failures are logged; they do not throw in the Facebook content script.
