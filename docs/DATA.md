# Local data

Source of truth: a single SQLite file.

```
dashboard/data/parallax.db
```

The file is gitignored. Delete it to reset. Open it in DB Browser for SQLite.

Schema lives in [dashboard/schema.sql](../dashboard/schema.sql). The dashboard applies it on boot.

## Tables

### `post_events`

Append-only digital events from the extension.

| Column | Notes |
| --- | --- |
| `id` | Integer primary key |
| `occurred_at` | ISO timestamp from the extension |
| `platform` | `facebook` (twitter later) |
| `post_id` | Content-script fingerprint, not the Facebook URL |
| `event_type` | `classified`, `hidden`, or `revealed` |
| `is_negative` | 0/1, set on classified and hidden |
| `created_at` | Server insert time |

Unique index on `(post_id, event_type)` so Facebook re-scans do not double-count.

### `sleep_nights`

| Column | Notes |
| --- | --- |
| `date` | Local calendar date `YYYY-MM-DD` |
| `duration_seconds` | Total sleep |
| `sleep_start`, `sleep_end` | Optional ISO timestamps |
| `source` | `polar` or `fixture` |

### `exercises`

| Column | Notes |
| --- | --- |
| `polar_id` | Stable id from Polar or a fixture id |
| `start_time` | ISO timestamp |
| `duration_seconds` | Workout length |
| `sport` | Label |
| `calories` | Optional |
| `cardio_load` | Optional |
| `source` | `polar` or `fixture` |

### `recharge_nights`

Polar Nightly Recharge, or a fixture stand-in.

| Column | Notes |
| --- | --- |
| `date` | `YYYY-MM-DD` |
| `ans_charge` | Optional numeric |
| `status` | e.g. `poor`, `ok`, `good` |
| `source` | `polar` or `fixture` |

### `polar_accounts`

At most one connected Polar user. Access token stays on disk, never in the extension.

### `meta`

Key/value: `data_source` (`live` or `fixture`), `last_polar_sync`, `last_extension_event`.

## Privacy

- Do not store post text, author names, or screenshots
- Only store the fingerprint the content script already uses
- Polar tokens never leave the machine
- Insight copy is browsing-protection language, not a diagnosis

## Cleaning

- Settings → **Wipe local data**
- `npm run reset` in `dashboard/`
- Delete `dashboard/data/parallax.db`
