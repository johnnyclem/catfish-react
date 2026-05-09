---
confidence: 0.95
sources: [catfish/Features/Ending/EndingOverlay.swift, catfish/Features/Ending/Day7UrgencyBanner.swift, catfish/Core/GameState.swift, catfish/Core/AccusationResolver.swift]
last-confirmed: 2026-04-29
status: active
---

# Feature: Ending System

## Status

Working

## Components

| File | Role |
|------|------|
| `Features/Ending/EndingOverlay.swift` | Full-screen ending overlay for all 4 ending types |
| `Features/Ending/Day7UrgencyBanner.swift` | Journal urgency banner shown on day 7 |
| `Core/GameState.swift` | EndingResult struct, endRun(), narrativeBeat/evidenceStrength helpers |
| `Core/AccusationResolver.swift` | Resolves accusation outcome including isLuckyGuess flag |
| `RootView.swift` | Routes to EndingOverlay when run ends |

## How It Works

Four ending types (`CaseEnding`):

1. **caughtThem** — Correct accusation. Shows "CASE CLOSED" with evidence verification status. If evidenceStrength < 0.3, treated as "lucky guess" with different subheadline.

2. **wrongfulAccusation** — Wrong person accused. Shows "WRONG ACCUSATION" with killer reveal.

3. **metKiller** — Day 7 meet invitation accepted. Triggered via `day7MeetInvitation` chat message kind. Shows "FACE TO FACE".

4. **killerEscaped** — Day 7 passed without accusation or advancing past day 7. Shows "TIME'S UP".

### Ending Overlay Flow

1. `GameState.endRun(with:)` creates `EndingResult` with ending type, killer, narrative beat, evidence strength, fact count, days played
2. `RootView` detects `isRunActive == false` + `lastEndingResult != nil`
3. Shows `EndingOverlay` with phased reveal animation (pulse icon → content → details)
4. "Play Again" clears ending result and starts new run

### Day 7 Climax

- Status bar turns warning color, shows "LAST DAY — MAKE YOUR ACCUSATION"
- Journal shows `Day7UrgencyBanner` with "TIME'S RUNNING OUT"
- Killer sends `day7MeetInvitation` message via chat with Accept/Decline buttons
- Accepting triggers `.metKiller` ending
- Declining forces player to use the accusation flow
- `canAdvanceDay` is false on day 7 (no further day advancement)

## Key Details

- `EndingResult` is separate from `AccusationResult` — the overlay uses the former
- `AccusationResult.isLuckyGuess` tracks whether the correct accusation had <30% evidence
- Day 7 meet invitation uses `ChatMessageKind.day7MeetInvitation` (distinct from `.dateInvitation`)
- All print() statements replaced with `os.Logger` for beta release
- Debug killer picker hidden behind long-press gesture on splash screen

## Related Pages

- [[architecture/data-models]]
- [[decisions/player-paced-days]]
- [[decisions/journal-commit-contract]]
