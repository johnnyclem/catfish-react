# Phase 5 — SafeSpot (Tower Defense) Full Gameplay

## Summary

Implement the complete tower defense gameplay loop for SafeSpot, including enemy waves, tower placement, projectile system, resource management, and narrative hook integration.

## Motivation

SafeSpot is the second fully-stubbed arcade game. It currently renders a static 5x6 grid with no interactivity. The tower defense mechanic is the "strategy game" that surfaces narrative hooks through named enemies and tactical metaphors (gaslighting as enemy, self-care as defense). Without gameplay, the HookCatalog's SafeSpot entries never fire.

## Deliverables

### 5.1 Grid & Lane System
- 5 columns (lanes) x 9 rows
- Leftmost column: enemy spawn zone
- Rightmost column: player base ("sanctuary")
- Middle 3 columns (cols 1-3): buildable territory
- Visual: lane dividers, spawn zone indicator, base health bar

### 5.2 Enemy System
- Enemy types from narrative hooks: `Gaslighter`, `LoveBomber`, `SilentTreatment`, `BreadcrumbDropper`
- Each enemy has: speed, health, lane, current position (animated), reward (POM)
- Enemies spawn from left, move right at constant speed per type
- If enemy reaches base: base loses 1 sanity point

### 5.3 Tower (Tool) System
- 4 tower types matching existing UI: Self Care (heal), Mute (slow), Fact Check (damage), Seen (reveal)
- Each tower: cost (POM), damage, range, fire rate, special effect
- Tap empty cell → show tower picker → place tower (deduct POM)
- Towers auto-target nearest enemy in range
- Tower placement animation (pop-in)

### 5.4 Projectile System
- Visual projectiles from tower to target
- Different projectile visuals per tower type
- Hit animation (flash + damage number)

### 5.5 Wave System
- 5 waves per game, increasing difficulty
- Wave composition from narrative hooks (`namedEnemy` payload)
- Between waves: brief pause + wave announcement toast
- Final wave has "boss" enemy (2x health)

### 5.6 Resource Management
- POM (currency): start with 100, earn from kills, spend on towers
- Sanity (base health): start with 5, lose 1 per enemy that reaches base
- Tower sell: tap placed tower → sell for 50% POM refund

### 5.7 Game Flow
- Start screen with wave count and difficulty
- Active gameplay with grid, resource counters, tower placement
- Wave progress indicator (3/5 enemies remaining)
- End overlay: "Sanctuary Held!" (win) or "Overwhelmed" (lose)
- Play Again / Exit buttons

### 5.8 Hook Integration
- `willStart`: receive `namedEnemy` from HookCatalog for wave composition
- `contentSelected` (on boss kill): fire fact reveal or toast
- `didEnd`: report result to NarrativeHookRouter

## Acceptance Criteria

1. Full tower defense loop: place towers → enemies spawn → towers fire → enemies die or reach base → repeat
2. 5 waves with increasing difficulty
3. Resource management (POM/sanity) works correctly
4. Named enemies from narrative hooks appear in waves
5. Win (survive all waves) and lose (sanity reaches 0) conditions trigger correctly
6. Build succeeds, all tests pass

## Files to Modify

- `catfish/Features/Apps/Arcade/SafeSpot/SafeSpotGame.swift` — complete rewrite from stub to full game

## Token Budget Estimate
~60K tokens (most complex single-file game implementation)

## Dependencies
- None (self-contained game)
