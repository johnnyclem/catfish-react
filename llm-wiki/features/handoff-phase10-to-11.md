---
confidence: 0.95
sources: [PRD_Phase10.md, PRD_Phase11.md, codebase inspection, session 2026-05-12]
last-confirmed: 2026-05-12
status: active
supersedes: null
---

# Phase 10 → 11 Handoff

## Session Summary (2026-05-12)

**Agent**: opencode (big-pickle)
**Task**: Implemented Phase 10 remaining items + prepared handoff.

### What was done

**10.1 tap→filter (SuspectBoard → Journal)**
- Added `journalFilterCandidateId` + `setJournalFilter()` to `phoneShellState.ts` — a cross-app navigation parameter so the SuspectBoard can tell the Journal which suspect to filter on.
- Changed `SuspectBoardScreen.handleCardTap` from opening a chat thread to setting the journal filter + navigating to the journal app via `openApp("journal")`.
- Changed card hint from "tap to chat ▸" → "tap to review ▸".
- Added `useEffect` in `JournalScreen` that reads the filter from phoneShell on mount, initializes `selectedSuspectId`, then clears the filter. All existing `JournalControls` / `SuspectGroup` filtering logic is reused.

**10.4 evidence breakdown (AccusationStep2)**
- Replaced single `EvidenceBar` with `EvidenceBreakdownBar` showing three color-coded segments:
  - **Strong** (cyan `s`) — facts in chains pointing TO this suspect
  - **Contradiction** (red `c`) — facts in chains pointing to a different suspect
  - **Unexplained** (grey `u`) — facts not in any chain
- Added `strongFacts`, `contradictionFacts`, `unexplainedFacts` to `AccuseRow`.
- Breakdown computation: builds a `chainAboutByFactId` map from evidence chains, then categorizes each captured fact against the suspect's identity.

### Files Modified

| File | Change |
|------|--------|
| `features/parody/phoneShellState.ts` | +`journalFilterCandidateId`, +`setJournalFilter()` |
| `features/journal/SuspectBoardScreen.tsx` | `handleCardTap` → filter+journal nav, hint text changed |
| `features/journal/JournalScreen.tsx` | `useEffect` reads filter from phoneShell on mount |
| `features/accusation/AccusationStep2.tsx` | `EvidenceBreakdownBar` replaces `EvidenceBar` |

### Verification

- `pnpm run typecheck` — **clean** across all 4 workspace packages

---

## Phase 10 Remaining Items

All items from the Phase 10 PRD are implemented in the React Native codebase. Below are gaps vs. the PRD spec that could be addressed:

### 10.1 SuspectBoard — Evidence counts per card (enhancement)

The PRD specifies: _"Each suspect card shows evidence count pointing toward them, evidence count clearing them. Color coding: green (cleared), yellow (some evidence), red (strong evidence against)."_

Current state:
- `SuspectBoardScreen` uses a 4-segment risk meter based on raw `factCount` (unknown/low/elevated/high).
- The strong/contradiction breakdown from `AccusationStep2` could be repurposed for the board cards.
- To implement: pass the same breakdown (`strongFacts`, `contradictionFacts`, `unexplainedFacts`) into `SuspectCard`, replace `RiskMeter` with a breakdown bar + color-coded status chip.

**Effort**: ~30 min, one component swap.

### 10.3 Deduction Notes — Auto-suggest (optional/not required)

PRD lists _"Optional: auto-suggest connections based on shared character tags"_ — this is marked optional, not a requirement.

### General gap: No test files for Phase 10 features

The project has test targets (`catfishTests/`, `catfishUITests/` from AGENTS.md) but no tests exist for the new Phase 10 components. Consider adding unit tests for the breakdown computation in `AccusationStep2` and the filter-navigation in `JournalScreen`.

---

## Phase 11 Build Plan

Source: `PRD_Phase11.md`

### Overview

Build first-run onboarding, settings screen, run history, and title screen polish. These are foundational UX surfaces needed for beta.

### Items

#### 11.1 Title Screen Polish (~2h)

- "Continue Case" button when active `CaseRun` exists
- "New Case" button (always enabled, warns if run in progress)
- Run status preview: current day, suspect count, evidence count
- Subtle background animation (parallax phone graphic)
- Version number display

**Entry point**: This is the root of the navigation tree. Currently the app launches into the phone shell or the title screen stub (check `app/home.tsx` and `app/_layout.tsx`).

**Key files**:
- `app/home.tsx` or equivalent title screen
- `core/gameStore.ts` — check for active run

#### 11.2 Onboarding Flow (~3h)

Complete the 6-step onboarding flow. The existing `PhoneShell` and `JournalApp`/`SwipeScreen` already exist as destinations for the tutorial steps.

**Steps**:
1. Welcome splash
2. Phone tour (callouts pointing to LotsOFish, Journal, Photos, Phone icons)
3. Swipe tutorial (auto-navigate to swipe, highlight gesture area)
4. Chat tutorial (after first match, navigate to matches)
5. Journal intro (show journal with first fact)
6. Accusation warning (final screen)

**Key considerations**:
- Onboarding state should persist to AsyncStorage
- Steps 3-6 are triggered by game events (first swipe, first match, first fact), not just linear progression
- The phone shell needs a "tutorial mode" overlay layer for callouts

#### 11.3 Settings Screen (~2h)

New app on home screen (gear icon):
- Audio: BGM/SFX/Voice volume sliders + mute toggle
- Display: CRT scanlines toggle, screen shake toggle
- Accessibility: reduce motion toggle, high contrast text toggle
- About: version, credits, privacy policy link
- Persist via `UserDefaults` (or AsyncStorage in RN context)

**Key files**:
- New: `features/settings/SettingsScreen.tsx`
- `features/parody/phoneShellState.ts` — add `"settings"` to `PhoneShellApp`
- `features/parody/HomeScreen.tsx` (or wherever home grid icons are defined)
- `constants/colors.ts` / `components/PixelChrome.tsx` — scanline/shake toggles

#### 11.4 Run History (~2.5h)

New view accessible from title screen:
- List of past (closed) `CaseRun`s
- Each entry: killer identity (revealed), outcome, days taken, facts discovered
- Tap → run detail: full fact timeline, accusation result
- "Play Again" button
- Empty state

**Key files**:
- New: `features/title/RunHistoryScreen.tsx`
- New: `features/title/RunDetailScreen.tsx`
- `core/gameStore.ts` — query closed runs (runs stored in AsyncStorage via `repository.ts`)

**Important**: The current `repository.ts` stores exactly one active run. For run history, you'll need either:
- A run archive list in AsyncStorage (saved when a run closes)
- Or modify `repository.ts` to keep a list of completed runs

#### 11.5 Continue Run Flow (~1h)

- Title screen detects active run via `gameStore.run !== null`
- "Continue Case" button restores phone shell state
- If run was mid-date (checkpoint), resume checkpoint

**Key files**:
- `core/gameStore.ts` — hydrate check
- `features/parody/phoneShellState.ts` — restore last active app/view

### Phase 11 Dependency Graph

```
11.1 Title Screen ─┬─→ 11.4 Run History (accessed from title)
                   └─→ 11.5 Continue Run (button on title)
11.2 Onboarding ───→ modifies PhoneShell + adds tutorial overlay
11.3 Settings ─────→ new home screen app, no deps
```

### Estimated Total Effort

~10-11 hours for all 5 items. No external dependencies (pure frontend work).

### Risk Areas

1. **AsyncStorage run history** — current persistence model only tracks one active run. Need to design a run archive schema before implementing 11.4.
2. **Onboarding persistence** — must survive cold starts. Use a dedicated AsyncStorage key (`onboarding_completed`, `onboarding_step`) separate from the game run data.
3. **Tutorial overlay** — the phone shell needs an overlay layer above all app content. This could be a wrapper in the root shell component that conditionally renders callout views.
