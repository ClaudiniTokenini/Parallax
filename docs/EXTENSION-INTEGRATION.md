# Extension integration

The dashboard cannot read `chrome.storage`. The service worker pushes events to localhost.

## Popup

**Show dashboard** opens `http://127.0.0.1:3000`. The popup also pings `GET /api/health`. If that fails, it still opens the tab and the page explains how to start the app.

`chromeExtension/dashboard.html` is a fallback: it tries to send the browser to port 3000 and tells the user to run `npm run dev` if the app is down.

## Messages

Content script → background:

| Type | When |
| --- | --- |
| `CLASSIFY_POST` | New Facebook post text |
| `RECORD_STAT` | Existing popup counters (`postsScanned`, `postsHidden`) |
| `RECORD_EVENT` | After classify, first hide, or user reveal |
| `CONTENT_STATUS` | Live tab snapshot |

Background → dashboard:

```http
POST http://127.0.0.1:3000/api/events
Content-Type: application/json
```

```json
{
  "eventType": "classified",
  "platform": "facebook",
  "postId": "abc123",
  "isNegative": true,
  "occurredAt": "2026-10-03T14:12:00.000Z"
}
```

`eventType` is `classified` | `hidden` | `revealed`.

## When events fire

1. Classifier returns → `classified` (positive or negative)
2. First blur of that `postId` → `hidden`
3. User clicks **Show anyway** → `revealed`

Positive posts only emit `classified` with `isNegative: false`.

## Loopback fetch

Same pattern as LM Studio:

```js
fetch(url, { ...options, targetAddressSpace: "loopback" })
```

Host permissions already include `http://127.0.0.1/*`.

## CORS

Dashboard API routes allow:

- `Origin: chrome-extension://*`
- `Access-Control-Allow-Private-Network: true`
- Methods `GET`, `POST`, `OPTIONS`

## Failure rules

- Ingest errors must not break blur or classify
- Background logs `[Parallax] dashboard ingest failed`
- Popup can show the last dashboard error
- Duplicate `(postId, eventType)` is ignored (HTTP 200, `inserted: false`)
