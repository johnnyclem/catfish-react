# Phase 11 — Onboarding, Settings, Run History & Title Screen

## Summary

Build the first-run onboarding experience, a settings/options screen, a run history viewer, and polish the title screen with continue-run support.

## Motivation

The title screen only has "Start new case" — no way to continue an existing run. Onboarding is partially scaffolded but incomplete. There's no settings screen for audio or display options. Run history (past playthroughs) isn't visible. These are essential UX surfaces for beta.

## Deliverables

### 11.1 Title Screen Polish
- "Continue Case" button (appears when active CaseRun exists)
- "New Case" button (always available, warns if run in progress)
- Run status preview: current day, suspect count, evidence count
- Subtle background animation (parallax phone graphic)
- Version number display

### 11.2 Onboarding Flow Completion
The existing `OnboardingManager` has steps defined. Complete the flow:

**Step 1: Welcome**
- "Welcome to Catfish" splash
- "You've matched with 5 people on LotsOFish. One of them is a killer."
- Continue button

**Step 2: Phone Tour**
- Highlight PhoneShell with callouts
- "This is your phone. Everything happens here."
- Point out: LotsOFish, Journal, Photos, Phone

**Step 3: Swipe Tutorial**
- Auto-navigate to LotsOFish Discover tab
- "Swipe right to match, left to pass"
- Highlight swipe area
- Complete after first swipe

**Step 4: Chat Tutorial**
- After first match, navigate to Matches
- "Send a message to start a conversation"
- Complete after first sent message

**Step 5: Journal Introduction**
- "Keep track of clues in your journal"
- Show journal with first discovered fact
- Complete on tap

**Step 6: Accusation Warning**
- "You have 7 days to find the killer"
- "Accuse the wrong person and they walk free"
- "Take your time. Trust your gut."
- Final continue → onboarding complete

### 11.3 Settings Screen
New app on home screen (gear icon):
- **Audio**: BGM volume slider, SFX volume slider, Voice volume slider, Mute toggle
- **Display**: CRT scanlines toggle, screen shake toggle
- **Accessibility**: reduce motion toggle, high contrast text toggle
- **About**: version, credits, privacy policy link
- Settings persist via `UserDefaults` (not SwiftData)

### 11.4 Run History
New view accessible from title screen:
- List of past CaseRuns (ended runs only)
- Each entry: killer identity (revealed), outcome (caught/escaped/wrong), days taken, facts discovered count
- Tap → run detail: full fact timeline, accusation result, key moments
- "Play Again" button on past run detail
- Empty state: "No closed cases yet. Go catch a killer."

### 11.5 Continue Run Flow
- When `GameState.loadCurrentRun()` finds an active run, show "Continue Case" on title
- Tapping continues loads PhoneShell with current state
- If run was mid-date (has checkpoint), resume from checkpoint
- Day counter and evidence count shown on title for context

## Acceptance Criteria

1. Title screen shows Continue/New Case correctly based on run state
2. Full onboarding flow completes without errors
3. Settings screen persists volume and display preferences
4. Run history shows past playthroughs with results
5. Continue run restores full game state
6. Build succeeds, all tests pass

## Files to Modify

- `catfish/RootView.swift` — title screen rewrite, continue run flow
- `catfish/Core/GameState.swift` — run history queries
- `catfish/Features/PhoneOS/OnboardingManager.swift` (or equivalent) — complete steps
- New: `catfish/Features/Settings/SettingsView.swift`
- New: `catfish/Features/Title/RunHistoryView.swift`
- New: `catfish/Features/Title/RunDetailView.swift`
- `catfish/Features/PhoneOS/PhoneOSState.swift` — settings app ID
- `catfish/Features/PhoneOS/PhoneShell.swift` — settings routing
- `catfish/Audio/AudioEngine.swift` — volume control integration

## Token Budget Estimate
~60K tokens (multiple new views, moderate complexity)

## Dependencies
- None (foundational UX layer)
