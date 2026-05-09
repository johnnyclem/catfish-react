---
confidence: 0.9
sources: [catfish/Features/Swipe/, README.md]
last-confirmed: 2026-04-26
status: active
---

# Swipe Feature

The core gameplay loop — Tinder-style card swiping through suspect profiles.

## Components

| File | Role |
|------|------|
| `Features/Swipe/SwipeView.swift` | Container view |
| `Features/Swipe/SwipeCard.swift` | Individual card with drag gesture |
| `Features/Swipe/SwipeDeckViewModel.swift` | Deck state management |

## How It Works

1. `SwipeDeckViewModel` loads the 5 candidate profiles for the current run.
2. `SwipeCard` renders each profile with a drag gesture.
3. **Right swipe** (≥110pt threshold): Creates a `MatchRelationship`, shows
   celebration overlay.
4. **Left swipe**: Passes the card, state persists through app relaunch.
5. Deck exhaustion shows an empty state.

## Key Details

- Commit threshold: `SwipeCard.commitThreshold` = 110pt horizontal drag
- `AssetImage` is used for profile pictures (graceful placeholder fallback)
- Matches are persisted via SwiftData immediately
- The deck order is determined at run creation by `RunBootstrapper` (stubbed)

## Status

Working. Swipe → Match → Celebration flow is complete.

## Related Pages

- [[architecture/overview]] — How Swipe fits in the app
- [[features/date-mode]] — What happens after a match
- [[architecture/data-models]] — MatchRelationship model
