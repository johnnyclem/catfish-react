# Phase 13 — End-to-End Playtest Polish & Beta Release

## Summary

Full playtest-driven polish pass: fix narrative inconsistencies, balance evidence difficulty, add missing edge cases, complete the day-7 climax, and prepare the build for beta distribution.

## Motivation

All features are implemented but untested as an integrated whole. Individual systems work in isolation, but the full 7-day investigation arc — from first swipe to final accusation — has never been validated. This phase is the integration test: play every path, fix every break, and ship.

## Deliverables

### 13.1 Full Run Playtesting
Play through complete runs for all 5 killer variants:

**Run 1: Miles is Killer (happy path)**
- Swipe all 5, match Miles + 2 others
- Play all 4 arcade games
- Go on 2 dates (Miles coffee + apartment)
- Discover 15+ facts through chat, dates, arcade hooks, browser, phone
- Build evidence chain → accuse Miles → caught
- Target: ~45 minutes playtime

**Run 2: Kai is Killer (red herring path)**
- Match Kai + 2 others
- Fall for River red herring (built into Kai's redHerrings)
- Accuse River → wrongful accusation
- Game continues? Or ends? Verify CaseEnding flow

**Run 3: Wrongful Accusation Day 5**
- Accuse wrong person early
- Verify `CaseEnding.wrongfulAccusation` triggers correctly
- Verify killer escapes (narrative beat plays)

**Run 4: Day 7 Automatic Ending**
- Play to day 7 without accusing
- Verify `CaseEnding.killerEscaped` triggers
- Verify day-7 meet invitation from killer

**Run 5: Lucky Guess**
- Accuse correct killer with <30% evidence
- Verify `AccusationResult` shows "lucky guess" not "evidence verified"

### 13.2 Narrative Consistency Audit
For each of the 5 killer paths:
- Verify all `conditionalFactIDs` facts are discoverable
- Verify all `variableOverrides` produce correct payloads
- Verify all `redHerrings` chains have discoverable supporting facts
- Verify `solvingDeduction.requiredFactIDs` are all discoverable
- Check: no fact references a character who couldn't be the killer in a way that breaks
- Check: friend tips don't accidentally reveal the killer's identity

### 13.3 Evidence Balance Tuning
- Ensure every killer has enough discoverable evidence to form a solving deduction
- Ensure red herrings are plausible (not obviously wrong)
- Ensure no single path makes the killer obvious by day 3
- Target difficulty: average player accuses correctly by day 5-6 with 60-80% evidence
- Difficulty spike: day 3-4 evidence should create doubt, not certainty

### 13.4 Edge Case Fixes
Fix issues discovered during playtesting:
- App backgrounding mid-date → checkpoint resume works
- App kill mid-date → checkpoint resume works
- Swipe all 5 profiles day 1 → no crash, no empty state
- Day advance with no scheduled content → graceful handling
- Accuse with 0 discovered facts → proper "no evidence" handling
- Multiple runs in same session → state cleanly resets
- Voice playback interruption (phone call) → resumes correctly
- Low storage → voice cache eviction

### 13.5 Day 7 Climax
Special handling for the final day:
- Day 7 narrator event: "This is it. Last day to make your case."
- Killer sends meet invitation via chat (different tone for each killer)
- Journal shows "Time's running out" banner
- Accepting meet → `CaseEnding.metKiller` scene
- Refusing meet → must accuse via journal
- Day 7 timer: no more day advance (already at 7)

### 13.6 Ending Scenes
After accusation resolution, show an ending overlay:
- **Caught (evidence verified)**: "Case closed. The evidence was overwhelming." + fact summary
- **Caught (lucky guess)**: "Case closed... but was it luck or instinct?" + fact summary
- **Wrongful accusation**: "[Character] was innocent. The real killer walks free." + reveal
- **Killer escaped**: "7 days passed. [Killer] disappeared." + reveal
- **Met Killer**: Special scene for day-7 meet acceptance
- Each ending shows: killer reveal, evidence review, "Play Again" button

### 13.7 Beta Release Preparation
- Remove debug killer picker from title screen (or hide behind gesture)
- Verify `--skip-onboarding` launch argument still works for development
- Clean up `print()` statements → replace with `os_log` or remove
- Verify minimum iOS 17 deployment target
- Verify all assets are in asset catalog (no missing images)
- Test on physical device (if available)
- Archive build for TestFlight distribution

### 13.8 Wiki Finalization
- Update all `llm-wiki/` pages with final architecture
- Update `llm-wiki/index.md` with complete page catalog
- Run `wiki-lint`: check metadata, broken links, stale pages
- Write final changelog entry summarizing beta state

## Acceptance Criteria

1. Complete playthrough possible for all 5 killers without crashes
2. Wrongful accusation and lucky guess paths work correctly
3. Day 7 climax feels distinct from earlier days
4. All ending scenes display correctly
5. Evidence balance: no killer is trivially obvious or impossibly hard
6. No `print()` statements in production code
7. Archive build succeeds
8. All tests pass
9. Wiki is up to date

## Files to Modify

- All feature files — bug fixes from playtesting
- `catfish/Core/GameState.swift` — day 7 handling, ending flow
- `catfish/RootView.swift` — ending overlay routing
- `catfish/Features/Journal/AccusationView.swift` — ending scenes
- New: `catfish/Features/Ending/EndingOverlay.swift`
- `catfish/Core/Content/ContentScheduler.swift` — day 7 events
- `catfish/Resources/Content/content.json` — balance adjustments
- `llm-wiki/` — full update

## Token Budget Estimate
~75K tokens (broad but shallow changes across many files)

## Dependencies
- All previous phases (this is the integration phase)
