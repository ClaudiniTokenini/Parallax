# Dashboard

Local Next.js app for Parallax. Product brief: [CONTEXT.md](CONTEXT.md). Mockup: [mockups/dashboard_mockup.png](mockups/dashboard_mockup.png). Logos and the sun/moon art live in [assets/](assets/) and are served from `public/assets/`.

## Commands

```bash
npm install
copy .env.example .env.local
npm run dev
```

Dev server: [http://127.0.0.1:3000](http://127.0.0.1:3000)

```bash
npm run seed    # demo digital + health rows
npm run reset   # delete the SQLite file
npm run build
npm run start   # production mode on port 3000
```

## Environment

See `.env.example`. Polar keys are optional. Without them, use demo health data.

## Database

`data/parallax.db` is created on first request. Schema: [schema.sql](schema.sql). Docs: [../docs/DATA.md](../docs/DATA.md).

## Routes

| Path | Page |
| --- | --- |
| `/` | Overview |
| `/physical` | Physical health |
| `/mental` | Mental wellbeing |
| `/settings` | Polar, seed, wipe, connection status |

## API

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/health` | Extension + UI ping |
| POST | `/api/events` | Extension ingest |
| GET | `/api/overview` | Insight + overview cards |
| GET | `/api/physical` | Sleep, workouts, recharge |
| GET | `/api/mental` | Digital rates vs baseline |
| GET | `/api/settings` | Connection / meta |
| POST | `/api/seed` | Fixture data |
| POST | `/api/reset` | Wipe SQLite |
| GET | `/api/polar/auth` | Start OAuth |
| GET | `/api/polar/callback` | OAuth redirect |
| POST | `/api/polar/sync` | Pull Polar data |
