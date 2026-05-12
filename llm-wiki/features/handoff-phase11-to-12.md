---
confidence: 0.95
sources: [PRD_Phase11.md, codebase inspection, session 2026-05-12]
last-confirmed: 2026-05-12
status: active
supersedes: null
---

# Phase 11 → 12 Handoff

## Session Summary (2026-05-12)

**Agent**: opencode (big-pickle)
**Task**: Full Phase 11 implementation — Settings, Title Polish, Continue Run, Run History, Onboarding.

### What was done

All 5 Phase 11 items implemented and typecheck-clean. See changelog for full file list.

### Verification

- `pnpm run typecheck` — **clean** across all 4 workspace packages

---

## Phase 11 Architecture Decisions

### Onboarding Gating
- Onboarding shows **only on fresh install** (no active run, no archived runs).
- Players returning to an in-progress game skip onboarding entirely.
- Steps 3-4 are event-triggered (first swipe, first player message) rather than linear — the onboarding manager uses `useEffect` to watch game store state.

### Run Archive Schema
- A lightweight `RunSummary` type stores just the viewer-facing fields (killer identity, outcome, days, facts, matches, swipes).
- Full `CaseRun` blobs are NOT archived to avoid AsyncStorage bloat.
- Archive is saved in `startNewRun()` when the previous run was closed.
- Capped at 10 entries.

### Settings Prefs
- Display/accessibility toggles follow the same `saveBoolPref` / `loadBoolPref` pattern as the existing audio mute prefs.
- Defaults: scanlines on, screen shake on, reduce motion off, high contrast off.

### Display Pref Keys
- `catfish/prefs/scanlines/v1`, `catfish/prefs/screen_shake/v1`, `catfish/prefs/reduce_motion/v1`, `catfish/prefs/high_contrast/v1`

---

## Phase 12 Build Plan

Source: `PRD_Phase12.md` (not yet read — speculatively Date mode, narrative hooks, or chat improv based on project trajectory).

### Items likely queued

1. **Date Mode scenes** (SpriteKit or interactive chat-based dates) — the largest remaining gameplay gap.
2. **Narrative hook system** — the `NarrativeHookRouter`/`HookCatalog` from the SwiftUI codebase hasn't been ported.
3. **Chat improv** — the `requestImprovTurn` action in gameStore exists but may need a working endpoint.
4. **Facetime calls** — `pendingFacetimeCalls` field exists on CaseRun but no UI for accepting/declining.
5. **Voicemail player** — `voicemails` field exists, `markVmListened` action exists, but no playback UI.
6. **Evidence chain builder UI** — `buildChain` / `updateFactNote` actions exist, evidence chain definitions in content.json, but no UI for the player to build chains.

### Recommended Priority

1. **Date Mode** — core gameplay loop. Without dates, the "dating detective" promise is unfulfilled.
2. **Narrative hooks** — provides ambient game feel (toasts, caller ID flashes, phone vibrations).
3. **Facetime + Voicemail** — fills out the phone app experience.
4. **Evidence chain builder UI** — completes the Journal feature arc.

### Risk Areas

1. **SpriteKit integration** — if Date Mode uses SpriteKit, it's a new dependency for the React Native codebase. May need `react-native-skia` or `expo-gl` instead.
2. **Improv API reliability** — the `requestImprovTurn` path depends on the api-server workspace. If it's not deployed, chat hits a dead end after scripted turns.
3. **No test infrastructure** — no unit tests exist for any Phase 11 component. Recommend adding tests as Phase 12 proceeds.
