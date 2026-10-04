# Dashboard

Next.js app for Parallax. Full setup (classifier, env files, extension) is in the [root README](../README.md). Logos and the sun/moon art live in [assets/](assets/) and are served from `public/assets/`.

## Setup

Tested on Node.js v22.20.0.

```powershell
npm install
copy .env.example .env.local
npm run dev
```

On bash, use `cp .env.example .env.local`.

Dev server: [http://127.0.0.1:3000](http://127.0.0.1:3000)

`npm run dev` and `npm run start` write `../chromeExtension/env.js` from `NEXT_PUBLIC_DASHBOARD_URL` and `NEXT_PUBLIC_CLASSIFIER_URL`. Reload the unpacked extension after those URLs change.

```powershell
npm run seed    # demo digital + health rows
npm run reset   # delete the SQLite file
npm run build
npm run start   # production mode on port 3000
```

## Environment

Copy `.env.example` to `.env.local`. Restart the dev server after edits.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_DASHBOARD_URL` | yes | Public dashboard origin. Default `http://127.0.0.1:3000`. |
| `NEXT_PUBLIC_CLASSIFIER_URL` | yes | FastAPI classifier. Default `http://127.0.0.1:8000`. |
| `ELEVENLABS_API_KEY` | no | Spoken affirmations. Leave empty to skip speech. |
| `ELEVENLABS_VOICE_ID` | no | Voice id. Example default `JBFqnCBsd6RMkjVDRZzb`. |
| `ELEVENLABS_MODEL_ID` | no | Model id. Example default `eleven_flash_v2_5`. |

Day-to-day health import is **Upload health ZIP** on Settings for example from Polar smartwatch tracker.

## Database

`data/parallax.db` is created on first request. Schema: [schema.sql](schema.sql).

## Routes

Sign-in is required for the app pages. A new visitor is sent to `/login`.

| Path | Page |
| --- | --- |
| `/login` | Sign in |
| `/register` | Create an account |
| `/` | Overview |
| `/physical` | Physical health |
| `/mental` | Mental wellbeing |
| `/settings` | Profile, extension pairing code, health ZIP, wipe |

## API

| Method | Path | Role |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/profile` | Rename display name |
| POST | `/api/auth/password` | Set username and password |
| POST | `/api/auth/token` | Rotate the extension pairing code |
| GET | `/api/health` | Extension and UI ping |
| POST | `/api/events` | Extension ingest (pairing token) |
| GET | `/api/overview` | Insight and overview cards |
| GET | `/api/physical` | Sleep, workouts, recharge |
| GET | `/api/mental` | Digital rates vs baseline |
| GET | `/api/settings` | Connection and profile meta |
| POST | `/api/seed` | Fixture data |
| POST | `/api/reset` | Wipe the signed-in profile's rows |
| POST | `/api/polar/import` | Polar export ZIP |
| GET | `/api/polar/auth` | Start Polar OAuth |
| GET | `/api/polar/callback` | OAuth redirect |
| POST | `/api/polar/sync` | Pull Polar AccessLink data |
| GET, POST | `/api/affirmation/speak` | ElevenLabs speech for an affirmation |
