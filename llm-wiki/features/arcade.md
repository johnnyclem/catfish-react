---
confidence: 0.95
sources: [catfish/Features/Apps/Arcade/, catfish/Core/Narrative/]
last-confirmed: 2026-04-28
status: active
---

# Arcade & Mini-Games

PhoneOS includes mini-games that surface narrative hooks.

## Mini-Games

| Game | File |
|------|------|
| SugarCoat | `Features/Apps/Arcade/SugarCoat/SugarCoatGame.swift` |
| SafeSpot | `Features/Apps/Arcade/SafeSpot/SafeSpotGame.swift` |
| WordLow | `Features/Apps/Arcade/WordLow/WordLowGame.swift` |
| EgoTrip | `Features/Apps/Arcade/EgoTrip/EgoTripGame.swift` |

## Narrative Hook System

Arcade games can surface narrative hooks via:

| Component | File |
|-----------|------|
| Home-screen routing | `Features/PhoneOS/PhoneOSState.swift`, `Features/PhoneOS/PhoneShell.swift` |
| `HookToastView` | `Features/Apps/Arcade/HookToastView.swift` |
| `NarrativeHook` | `Core/Narrative/NarrativeHook.swift` |
| `HookCatalog` | `Core/Narrative/HookCatalog.swift` (72 hooks) |
| `NarrativeHookRouter` | `Core/Narrative/NarrativeHookRouter.swift` |
| Shared arcade UI | `Features/Apps/Arcade/ArcadeSharedUI.swift` |

### Hook Priority System

Hooks have three priority levels, evaluated highest-first:

| Priority | Value | Use |
|----------|-------|-----|
| `.killerSpecific` (3) | Highest | Hooks that check `run.killer == X` |
| `.global` (2) | Medium | Cross-game narrative progression hooks |
| `.generic` (1) | Lowest | Default; decorative toasts, flavor text |

### Hook Router Features

- **Priority sorting**: killer-specific > global > generic
- **Kind deduplication**: only one hook of each payload kind fires per event
- **Cooldown**: 30-second minimum between hooks from the same trigger source
- **One-shot tracking**: one-shot hooks fire at most once per run

### Hook Catalog Breakdown (72 total)

| Section | Count | Coverage |
|---------|-------|----------|
| WordLow | 20 | 5 killers × (suggest + toast + win + lose) |
| EgoTrip | 21 | 5 killers × (label@5 + label@10 + win + lose) + generic lose |
| SugarCoat | 12 | 5 killers × (scoop + win/lose) + generic win/lose |
| SafeSpot | 12 | 5 killers × (named enemy + win/lose) + generic start/lose |
| Global | 7 | Cross-game progression hooks |

## Shared Arcade UI

- `ArcadeGameOverOverlay` — consistent game-over screen for all 4 games
- `ArcadeExitAlert` — "Leave game? Progress will be lost." confirmation

## Related Pages

- [[features/phone-os]] — Mini-games are PhoneOS apps
- [[architecture/overview]] — How narrative hooks fit in
