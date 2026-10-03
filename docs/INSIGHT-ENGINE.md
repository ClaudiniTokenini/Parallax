# Insight engine

Deterministic if/then rules. No ML. No diagnosis. Recalculated on every Overview load and `GET /api/overview`.

The engine builds **facts** from the last 3 days of feed events plus the local health ZIP, then walks a **priority list**. The first matching rule wins.

## Inputs

| Side | Window | Source |
| --- | --- | --- |
| Mental | Last 3 days vs 14-day mix | Extension `classified` / `hidden` / `revealed` |
| Physical | Import stretch; “fresh” if the latest sleep, session, or step day is within 7 days | ZIP: sleep, workouts, steps, optional recharge / HR zones |

Missing ZIP or missing feed does not crash the engine. That side is omitted and named in the supporting copy.

An old Polar dump is treated as a **stretch recap**, not “you have not trained in 400 hours.” Wall-clock gaps only count when the latest health row is fresh.

## Facts

Mental:

- `heavyFeed` — negativity ≥ 50% (or clearly above the 14-day mix), or several blurs when classification rate is missing
- `peeked` — you revealed ≥ 22% of blurred posts
- `heldFilter` — posts were blurred and you mostly left them covered
- `quietFeed` — negativity ≤ 25% and few blurs
- `lighterThanUsual` — 3-day negativity is ≥ 8 points below the 14-day mix

Physical:

- `shortSleep` — recent nights under 6.5h, or ≥ 10% below the stretch mean
- `solidSleep` — recent nights ≥ 7h
- `staleWorkout` — fresh data and the gap since the last session is long vs your own rhythm
- `activeStretch` — a recent session, several sessions in the import, or ~7k+ steps/day
- `tiredBody` — short sleep, stale session, low recharge, hot HR-zone block, or very low steps without movement

## Headlines (first match)

| Rule | When | Headline |
| --- | --- | --- |
| `heavy-feed-tired-body` | Heavy feed and tired body | Give your mind a quieter feed today. |
| `heavy-feed-peeked` | Heavy feed and you opened blurs | Protect your attention today. |
| `heavy-feed-held` | Heavy feed and you left blurs covered | You let the filter hold today. |
| `heavy-feed-only` | Heavy feed, body unknown or fine | The feed asked a lot today. |
| `tired-body` | Body low, feed not heavy | Take it easy today. |
| `solid-both` | Sleep/movement ok and feed quiet or absent | You have a solid baseline today. |
| `quiet-feed` | Gentler feed | You have a solid baseline today. |
| `check-in` | Default / both sides thin | Check in with both sides today. |

Supporting copy names the inputs (blocked posts, revealed posts, sleep, sessions, steps) and says when a side is missing. Disclaimer: browsing protection plus local health data, not a mental-health assessment.

## Affirmations

A static list keyed by headline. The Overview **Play** button is still a stub until Eleven Labs.

## What we do not compute

- Sentiment categories
- Personalized model weights
- Diagnosis, risk scores, or clinical cutoffs
