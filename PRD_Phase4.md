# Phase 4 — SugarCoat (Match-3) Full Gameplay

## Summary

Implement the complete match-3 gameplay loop for SugarCoat, including swap mechanics, match detection, cascades, scoring, and narrative hook integration.

## Motivation

SugarCoat is one of two fully-stubbed arcade games. It currently renders a static 7x6 grid with no interactivity. The match-3 mechanic is core to the PhoneOS experience — it's the "casual game" that surfaces narrative hooks (lie/excuse/clout tiles matching gossip themes). Without gameplay, the HookCatalog's SugarCoat entries never fire.

## Deliverables

### 4.1 Core Grid Engine
- 7x6 grid with 5 tile types: `lie` (red), `excuse` (blue), `clout` (gold), `truth` (green), `shade` (purple)
- Each tile has: type, position (row, col), `id`
- Grid initialization with no pre-existing matches (shuffle until clean)

### 4.2 Swap Mechanic
- Tap-to-select first tile, tap adjacent tile to swap
- Or: drag-swap between adjacent tiles
- Swap animation (0.2s cross-slide)
- If swap produces no match, animate swap-back

### 4.3 Match Detection
- After each swap, scan for horizontal and vertical runs of 3+ matching tiles
- Mark matched tiles for removal
- Support 4-match and 5-match (bonus scoring)

### 4.4 Cascade System
- Remove matched tiles (shrink/pop animation, 0.15s)
- Gravity: tiles above fall down to fill gaps (0.2s staggered fall)
- New tiles spawn at top of each column
- After gravity settles, re-scan for new matches
- Repeat until no more matches (cascade chain)

### 4.5 Scoring & Game State
- 3-match = 30 pts, 4-match = 60 pts, 5-match = 100 pts
- Cascade multiplier: x2 on 2nd cascade, x3 on 3rd+
- Moves counter: start at 20, decrement on each swap
- Clout counter: total score displayed as "clout earned"
- Win condition: reach target clout before moves run out
- Lose condition: moves reach 0 without hitting target

### 4.6 Special Tiles (Scoop mechanic)
- When narrative hook provides `scoopTilePattern`, replace random tiles with special "scoop" tiles
- Matching a scoop tile triggers a narrative payload (toast or fact reveal)
- Scoop tiles have distinct visual treatment (glow or border)

### 4.7 Game Flow
- Start screen with target clout display
- Active gameplay with grid, counters, and tile interaction
- End overlay: "Tea Spilled!" (win) or "Cold Tea" (lose) with score
- Play Again / Exit buttons
- 30-second timer per move (optional — skip if tokens tight)

### 4.8 Hook Integration
- `willStart`: receive `scoopTilePattern` from HookCatalog
- `contentSelected` (on scoop match): fire toast with narrative text
- `didEnd`: report final score to NarrativeHookRouter for win/lose hooks

## Acceptance Criteria

1. Full match-3 loop: swap → match → cascade → score → repeat until win/lose
2. No pre-existing matches on grid init
3. Invalid swaps (no match produced) animate back
4. Cascade chains score with increasing multiplier
5. Scoop tiles fire narrative hooks when matched
6. Game ends correctly on win (target reached) or lose (moves exhausted)
7. Build succeeds, all tests pass

## Files to Modify

- `catfish/Features/Apps/Arcade/SugarCoat/SugarCoatGame.swift` — complete rewrite from stub to full game

## Token Budget Estimate
~55K tokens (single file, substantial new logic)

## Dependencies
- None (self-contained game)
