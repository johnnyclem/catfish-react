# Phase 6 — Narrative Hook Expansion + Arcade Polish

## Summary

Expand the HookCatalog with hooks for all 5 killer variants across all 4 games, add global narrative progression hooks, polish arcade game UIs, and add the Photos app as a fact-image gallery.

## Motivation

The current HookCatalog has ~13 hooks total, covering only a fraction of killer/game combinations. Most games play identically regardless of who the killer is. For beta, every game should surface at least 2 killer-specific hooks, and cross-game narrative progression should reward playing multiple games in a run. The Photos app is also stubbed and could serve as a visual evidence gallery.

## Deliverables

### 6.1 Full Killer-Specific Hooks
For each game × killer combination, author at least 2 hooks:

**WordLow** (10 hooks → 20):
- Per-killer word suggestions: e.g., Sam's "SHADE", Jules's "CRUSH"
- Win/lose flavor text per killer

**EgoTrip** (8 hooks → 20):
- Per-killer obstacle labels (2 per killer, at positions 5 and 10)
- Win/lose flavor per killer

**SugarCoat** (2 hooks → 12):
- Per-killer scoop tile patterns (different gossip themes per killer)
- Win/lose flavor per killer

**SafeSpot** (2 hooks → 12):
- Per-killer named enemy types
- Win/lose flavor per killer

### 6.2 Global Narrative Progression Hooks
Add 5-8 global hooks that fire based on game history:
- "Playing WordLow after discovering a Kai fact" → toast connecting the two
- "Winning EgoTrip with high score after Sam date" → fact reveal
- "Losing SafeSpot while River is unmatched" — dismissive toast
- Cross-game easter eggs (completing all 4 games in one day → bonus hook)

### 6.3 Arcade UI Polish
- Consistent game-over screens across all 4 games
- Score persistence (high score per game per run, stored in GameState)
- Shared sound effects: place, match, error, win jingle, lose sound
- Consistent exit confirmation ("Leave game? Progress will be lost.")

### 6.4 Photos App — Evidence Gallery
Replace `AppStubView` for `photos` with a real view:
- Grid of discovered fact images (facts with `imageAssetID` that are discovered)
- Tap to expand: full image + fact text + source label
- Empty state: "No evidence photos yet. Keep investigating."
- Camera roll metaphor: photos appear as they're discovered, can't see undiscovered images

### 6.5 Hook Router Improvements
- Prevent duplicate hooks from firing in the same game session
- Priority system: killer-specific hooks > global hooks > generic hooks
- Hook cooldown: minimum 30 seconds between toasts from the same source

## Acceptance Criteria

1. HookCatalog contains 60+ hooks covering all 20 game×killer combinations
2. At least 2 hooks fire per game session regardless of which killer is active
3. Photos app displays discovered fact images
4. Arcade games have consistent UI patterns
5. Build succeeds, all tests pass

## Files to Modify

- `catfish/Core/Narrative/HookCatalog.swift` — expand from ~13 to 60+ hooks
- `catfish/Core/Narrative/NarrativeHookRouter.swift` — add dedup, priority, cooldown
- `catfish/Features/Apps/Arcade/SugarCoat/SugarCoatGame.swift` — polish
- `catfish/Features/Apps/Arcade/SafeSpot/SafeSpotGame.swift` — polish
- `catfish/Features/Apps/Arcade/WordLow/WordLowGame.swift` — polish
- `catfish/Features/Apps/Arcade/EgoTrip/EgoTripGame.swift` — polish
- `catfish/Features/PhoneOS/PhoneOSState.swift` — add Photos routing
- New: `catfish/Features/Apps/Photos/PhotosGalleryView.swift`

## Token Budget Estimate
~70K tokens (large hook authoring + new view + polish across 4 games)

## Dependencies
- Phase 4 (SugarCoat gameplay) — hooks won't fire without game logic
- Phase 5 (SafeSpot gameplay) — hooks won't fire without game logic
