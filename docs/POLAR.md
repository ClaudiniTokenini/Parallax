# Polar

Physical data comes from Polar AccessLink when credentials exist, otherwise from fixtures.

AccessLink only returns exercises uploaded **after** the user is registered with your client. For a hackathon demo, use **Use demo health data** on Settings.

## Create an AccessLink app

1. Open [admin.polaraccesslink.com](https://admin.polaraccesslink.com/)
2. Create a client
3. Authorization redirect URL:

```
http://127.0.0.1:3000/api/polar/callback
```

4. Copy client id and secret into `dashboard/.env.local`:

```
POLAR_CLIENT_ID=...
POLAR_CLIENT_SECRET=...
POLAR_REDIRECT_URI=http://127.0.0.1:3000/api/polar/callback
```

## OAuth (local)

1. Settings → **Connect Polar** → `GET /api/polar/auth` redirects to Polar Flow
2. Polar redirects to `/api/polar/callback?code=...`
3. Dashboard exchanges the code at `https://polarremote.com/v2/oauth2/token`
4. Registers the user at `POST https://www.polaraccesslink.com/v3/users` (409 is fine)
5. Stores `user_id` and `access_token` in `polar_accounts`

## Sync

`POST /api/polar/sync` (also offered as **Sync now**) pulls non-transactional endpoints so Polar does not discard the data:

- `GET /v3/exercises` — last 30 days
- `GET /v3/users/sleep` — last 28 days
- `GET /v3/users/nightly-recharge` — Nightly Recharge if the account has it

Rows are upserted into `exercises`, `sleep_nights`, and `recharge_nights` with `source = polar`. `meta.last_polar_sync` is updated. `meta.data_source` becomes `live`.

## Fixtures

`POST /api/seed` (or Settings → **Load demo data**, or `npm run seed`) writes about 14 days of sleep, workouts, recharge, and sample post events. `meta.data_source` becomes `fixture`.

Live Polar sync replaces fixture health rows. Digital events are left alone unless you wipe the database.

## What we do not do

- No Polar webhooks (local app, no public URL)
- No transactional pull that commits/deletes Polar inbox data for the demo path
- No cloud token storage
