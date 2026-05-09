# Phase 7 — Date Scenes: Authoring & Scene Loader

## Summary

Author date scene JSON files for all 5 characters (2 scenes each), build the scene loader that picks the right scene based on match/day/killer state, and wire the date scheduling flow from chat.

## Motivation

The DateDirector engine is fully built but only has one demo scene (`kai_date_01_coffee_shop_day.json`). No real narrative content exists. The date tab in LotsOFish shows the demo scene regardless of who the player matched with. For beta, every character needs at least 2 authored date scenes with killer-tell beats, and the system needs to select scenes based on game state.

## Deliverables

### 7.1 Date Scene JSON Authoring
Author 10 date scene files (2 per character):

| File | Character | Setting | Day | Focus |
|------|-----------|---------|-----|-------|
| `kai_date_01_coffee_shop.json` | Kai | Coffee Shop | 1-2 | Calibration — baseline personality, loading dock hint |
| `kai_date_02_bar.json` | Kai | Bar | 3-4 | Escalation — flirtation vs evasion, glove detail tell |
| `river_date_01_park.json` | River | Park | 1-2 | Calibration — trail knowledge, boot size tell |
| `river_date_02_restaurant.json` | River | Restaurant | 3-4 | Pressure — trailcam deflection, accountability test |
| `miles_date_01_coffee_shop.json` | Miles | Coffee Shop | 1-2 | Calibration — curated charm, IG reflection tell |
| `miles_date_02_apartment.json` | Miles | Apartment | 4-5 | High stakes — composure slip, alleyway detail |
| `sam_date_01_park.json` | Sam | Park | 1-2 | Calibration — warmth, medical chart tell |
| `sam_date_02_restaurant.json` | Sam | Restaurant | 3-4 | Pressure — pharmacy receipt, shift gap |
| `jules_date_01_coffee_shop.json` | Jules | Coffee Shop | 1-2 | Calibration — artistic intensity, green room tell |
| `jules_date_02_bar.json` | Jules | Bar | 3-4 | Escalation — backstage timing, emotional deflection |

Each scene follows the `DateScene` Codable schema:
- 15-25 beats mixing scripted, eastworld, choice, focusShift, factReveal, and end
- At least 1 Focus Shift moment per scene (mode transition)
- At least 1 choice with affinity consequences
- 1 conditional beat that varies if character is the killer (using `isKiller` condition)
- Fact reveal beats reference real fact IDs from `content.json`

### 7.2 Scene Loader
Create `DateSceneLoader` that:
- Given (characterID, dayNumber, discoveredFactIDs, affinity), selects the appropriate scene
- Falls back to first scene if no second scene is unlocked yet
- Handles missing scene files gracefully (error overlay with "Date interrupted" message)
- Caches loaded scenes for the current run

### 7.3 Date Scheduling Flow
- Add `scheduledDate` property to `MatchRelationship` (characterID + dayNumber + sceneID)
- Chat messages can offer dates (new chat message type: `.dateInvitation`)
- Player accepts → `scheduledDate` set on the MatchRelationship
- On `advanceDay()`, if scheduled date is due, `RootView` routes to `DateSceneView`
- After date ends: return to PhoneShell, scheduledDate cleared, post-date chat messages triggered

### 7.4 Date Tab Rewrite
- Replace demo-only DateSceneView with dynamic scene loader
- Show list of matched characters with "Schedule Date" / "Go on Date" buttons
- Date availability gated by day (scene 1 available day 1+, scene 2 available day 3+)
- Show date outcome summary for completed dates

### 7.5 Date Persistence
- Replace `InMemoryDateDirectorPersistence` with SwiftData-backed persistence
- Store `DateOutcome` per date in a new `DateOutcomeRecord` model
- Persist checkpoint for crash recovery
- Display completed date outcomes in the Date tab

## Acceptance Criteria

1. 10 date scene JSON files load and play end-to-end without errors
2. Correct scene selected based on character, day, and affinity
3. Date scheduling works from chat: invitation → accept → scheduled → play
4. Post-date state changes (facts, affinity) persist correctly
5. Date outcomes visible in the Date tab
6. All 5 killer tells can be delivered through date scenes
7. Build succeeds, all tests pass

## Files to Modify

- New: 10 date scene JSON files in `catfish/Resources/DateScenes/`
- New: `catfish/Core/Date/DateSceneLoader.swift`
- New: `catfish/Core/Models/DateOutcomeRecord.swift`
- `catfish/Core/Models/MatchRelationship.swift` — add scheduledDate
- `catfish/Features/Date/DateMode.swift` — wire scene loader, SwiftData persistence
- `catfish/Features/Date/DateSceneView.swift` — dynamic scene routing
- `catfish/Features/Apps/LotsOFish/LotsOFishApp.swift` — date tab rewrite
- `catfish/Core/GameState.swift` — date scheduling on advanceDay
- `catfish/RootView.swift` — scheduled date routing

## Token Budget Estimate
~75K tokens (10 scene files + moderate code changes)

## Dependencies
- Phase 3 (all facts authored) — date scenes reference fact IDs
- DateDirector engine already built (pre-existing)
