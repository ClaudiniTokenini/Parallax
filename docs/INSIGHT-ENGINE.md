# Insight engine

Deterministic rules. No ML. No medical diagnosis. Recalculated on every `GET /api/overview`.

## Windows

| Window | Use |
| --- | --- |
| Last 3 days | Digital counts on Overview (blocked / revealed) |
| Last 7 days | Recent workout volume |
| Last 14 days | Personal baseline for rates and sleep |
| Polar limits | Sleep 28 days, exercises 30 days |

A **baseline** is the user's own 14-day mean, not a population “healthy” number. If the 14-day window is empty, the engine falls back to the shorter window and a neutral headline.

## Signals

Each signal is a number, then a delta vs baseline, clamped to a small range.

| Signal | Formula |
| --- | --- |
| `negativity_rate` | negative `classified` / all `classified` |
| `reveal_rate` | `revealed` / `hidden` |
| `sleep_hours` | mean sleep hours in the recent 3 nights vs 14-day mean |
| `hours_since_workout` | now − last exercise start |
| `workouts_7d` | count in 7 days vs (14-day count / 2) |
| `recharge` | latest Nightly Recharge / ANS charge when present |

Missing Polar/fixture health data does not crash the engine. Those signals are omitted and the headline leans on digital data.

## Headlines

The worst one or two signals pick a headline:

| Condition | Headline |
| --- | --- |
| Low recharge and stale workout | Take it easy today. |
| High negativity and high reveal | Protect your attention today. |
| Poor sleep and high digital load | Give your mind a quieter feed today. |
| Good sleep, recent activity, low negativity | You have a solid baseline today. |
| Default | Check in with both sides today. |

Supporting copy names the inputs (blocked posts, revealed posts, last workout, sleep). It states that this is browsing protection and Polar/demo metrics, not a mental-health assessment.

## Affirmations

A static list keyed by headline. The Overview **Play** button is a stub until Eleven Labs.

## What we do not compute

- Sentiment categories
- Personalized model weights
- Diagnosis, risk scores, or clinical cutoffs
