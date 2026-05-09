# Phase 3 — Fact Universe Authoring (Days 4-7) + Voice Pre-generation

## Summary

Complete the fact universe content for days 4-7, author date-scene tell facts, wire the voice pre-generation pipeline, and connect real Eastworld responses in chat.

## Motivation

Days 1-3 facts are authored (Phase 2), but `KillerImplementations` references ~40 fact IDs for days 4-7 and date-scene tells that don't exist in `content.json` yet. Without these facts, the accusation system can't validate deductions, and the game ends at day 3 with no deepening investigation. Voice pre-generation is also critical: the DateDirector expects voice line assets, and none are currently bundled.

## Deliverables

### 3.1 Days 4-6 Static Facts
Add ~25 new facts to `content.json` covering:
- **Day 4** (8 facts): deeper social evidence — `dev_text_day4_*` friend texts for each suspect, second social post discoveries, new DM content
- **Day 5** (8 facts): investigation escalation — location contradictions, behavioral pattern flags, `miles_portrait_uneasy_day5`, cross-referencing alibi details
- **Day 6** (8 facts): final evidence — `miles_day6_location_ping_mismatch`, time-stamped activity logs, financial trail hints, the critical "near-miss" clue per suspect

Each fact must have: `id`, `kind` (`staticFact`/`variable`/`conditional`), `source` (with full FactSourceContent), `day`, `aboutCharacter`, `payload` (text + optional imageAssetID + optional voiceLineID).

**Validation**: Every fact ID referenced in any `KillerImplementation`'s `conditionalFactIDs`, `variableOverrides`, `solvingDeduction.requiredFactIDs`, or `redHerrings[].requiredFactIDs` must exist in `content.json` after this task.

### 3.2 Day 7 Facts + Ending Events
- Day 7 facts (2-3): the final nail — `day7_invitation_fact` (conditional per killer), `day7_nia_warning`
- Day 7 day-events already exist in `content.json` but verify they correctly trigger the accusation deadline

### 3.3 Date-Scene Tell Facts
Author 10 date-scene tell facts (2 per killer):
- `date_kai_tell_01`, `date_kai_tell_02` — Kai's loading dock nervousness, glove detail
- `date_river_tell_01`, `date_river_tell_02` — River's trailcam deflection, boot size mismatch
- `date_miles_tell_01`, `date_miles_tell_02` — Miles's IG window reflection, alleyway composure slip
- `date_sam_tell_01`, `date_sam_tell_02` — Sam's medical chart edit, pharmacy receipt anomaly
- `date_jules_tell_01`, `date_jules_tell_02` — Jules's green room access, backstage timing

These are `conditional` facts (only seeded when the matching character is the killer), with `source: dateScene`.

### 3.4 Voice Pre-generation Pipeline
- Run `Scripts/pregen_voice_lines.py` against the full fact universe
- Ensure `voice_manifest.json` entries exist for all facts with `voiceLineID`
- Verify `Scripts/audit_voice_bundle.py` passes with no missing assets
- Add pre-generated `.m4a` files to `Resources/Voice/` bundle

### 3.5 Real Eastworld in Chat
- Replace `StubDateEastworldClient` with actual `EastworldVoiceService` calls in `ChatView`
- Wire character personality prompts from `Docs/date-mode/agents/*.md`
- Add session budget management (3000 char limit per character per session)
- Fallback to stub on network error

## Acceptance Criteria

1. `content.json` contains 55+ facts covering days 1-7
2. Every fact ID in `KillerImplementations` resolves to a real fact
3. `RunBootstrapper` can seed a complete run for any of the 5 killers without missing facts
4. `AccusationResolver` can validate a full `solvingDeduction` for every killer
5. `voice_manifest.json` covers all facts with `voiceLineID`
6. Chat responses come from Eastworld API (or stub on failure)
7. Build succeeds, all tests pass

## Files to Modify

- `catfish/Resources/Content/content.json` — add ~35 new facts
- `catfish/Resources/Voice/voice_manifest.json` — expand voice catalog
- `catfish/Features/Apps/LotsOFish/ChatView.swift` — wire real Eastworld
- `catfish/Core/Content/RunBootstrapper.swift` — may need updates for new fact types
- `Scripts/pregen_voice_lines.py` — run and verify

## Token Budget Estimate
~65K tokens (large content.json authoring + moderate code changes)

## Dependencies
- Phase 2 complete (Fact model, DiscoveredFact, content pipeline)
