# Parallax

Parallax observes wellbeing from two perspectives: physical state and digital environment.

## MVP

- Chrome extension
- Facebook
- Twitter/X if feasible
- local content classification
- positive/negative classification
- blur negative posts
- reveal button
- local dashboard
- Polar/health data integration
- simple wellbeing rules

## Nice to have, but for later (maybe)
- model reacts to user feedback
- categories of negative content (e.g. war, beauty standards, drama, gossip)
- playing the affirmation with Eleven Labs

## Non-goals

- medical diagnosis
- sentiment categories
- personalized ML
- cloud backend
- mobile app
- multi-browser support

## Architecture
```
                         PARALLAX
                            │
             ┌──────────────┴──────────────┐
             │                             │
      DIGITAL PERSPECTIVE           PHYSICAL PERSPECTIVE
             │                             │
       Chrome Extension                Dashboard
             │                             │
      Facebook / Twitter                Polar API
             │                        / Health API
             │                             │
       Local classifier                    │
             │                             │
             └──────────────┬──────────────┘
                            │
                       Local storage
                            │
                            ▼
                     Insight Engine
                            │
                            ▼
                     Simple insight
```

## Flow

```
Facebook / Twitter
        │
        ▼
MutationObserver
        │
        ▼
Find post
        │
        ▼
Extract text
        │
        ▼
Local classifier
        │
        ├──────── positive ────────► nothing
        │
        └──────── negative
                  │
                  ▼
               BLUR
                  │
          ┌───────┴────────┐
          │                │
       revealed          hidden
          │                │
          ▼                ▼
       event             event
```

## Dashboard details

- technology: TypeScript, React, Tailwind CSS, Next.js (App Router)
- local backend: the Next.js process on `http://127.0.0.1:3000` (API routes + SQLite)
- dashboard is accessed by clicking **Show dashboard** in the extension popup

Decisions that used to live in the todo list below are written up here:

- [Architecture](../docs/ARCHITECTURE.md)
- [Local data](../docs/DATA.md)
- [Extension integration](../docs/EXTENSION-INTEGRATION.md)
- [Polar](../docs/POLAR.md)
- [Insight engine](../docs/INSIGHT-ENGINE.md)
- [How to run](../README.md)
- [Packaging for end users](../docs/PACKAGING.md)

## Mockups
Mockups for the dashboard are located within `/mockups` directory.


## Resolved design todos

These are implemented in the dashboard app and documented in `/docs`:

- Extension posts events to `http://127.0.0.1:3000/api/events` over loopback (not `chrome.storage`)
- SQLite file at `dashboard/data/parallax.db`
- Next.js API routes are the local backend
- Polar AccessLink OAuth + fixture health data
- Baseline-relative insight engine
- Start instructions in the repo README
