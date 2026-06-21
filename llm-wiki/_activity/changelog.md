# Changelog

Session logs and activity records. Append newest entries at the top.

---

## 2026-06-15 — Beta Release-Candidate Review (Phase 13 integration pass)

End-to-end review of code, gameplay, and mechanics with the goal of a
beta-ready RC. Removed dead code, fixed bugs, finished half-wired
features, and hardened the test suite.

### Winnability / mechanics fixes
- **Evidence chains were broken for 6 of 8 killers.** `core/evidenceChains.ts`
  referenced fact ids that don't exist in `factUniverse.json` (e.g.
  `ren_bio_dealbreakers`, `kai_ig_workout`, `dev_text_day5_lead`,
  `nia_text_day3_coverup`). Rewrote every Ren/Kai/Delphine/Jules/River/Sam
  chain to reference real, discoverable facts (bio→IG→conditional→portrait),
  3 chains per killer. Each killer now has a ≤3-chain selection covering
  ≥80% of its solving deduction (the AccusationStep3 "full evidence" bar).
- **`findChainDefinition` was order-sensitive** — linking facts B→A failed
  even when A→B was valid. Made it order-insensitive; `buildChain` now
  persists the definition's canonical order so dedupe can't be bypassed.
- **AccusationStep3 required selecting a chain to file.** Runs where a
  player built no chains were un-accusable. Filing now always allowed
  (the resolver scores discovered facts, not selected chains).
- **EvidenceChainBuilder / PhotosApp now respect the reveal gate**
  (`isFactRevealedYet`) so future-day facts don't leak early.

### Onboarding (was badly broken)
- **6 of 8 onboarding steps were unreachable.** `OnboardingManager`
  auto-starts a run at the swipe step, but `OnboardingGate` hid the
  overlay the instant a run existed (`!run`), tearing down the tutorial
  mid-flow. Added a `step > 0` latch so onboarding persists until
  completed. (`OnboardingGate.tsx`)
- Fixed the swipe-tutorial card emitting bare `{"\n"}` text nodes as
  `<View>` children (RN-web console error). (`OnboardingManager.tsx`)
- Hardened the swipe-step auto-advance ref (matched its sibling steps).

### Web-platform + UX fixes
- Title-screen "New Case (Reset)" used `Alert.alert`, a **no-op on web** —
  the confirm never appeared. Replaced with an inline confirm panel.
  (`app/index.tsx`)
- PhotosApp evidence thumbnails were non-interactive `<View>`s, so the
  finished `EvidenceDetail` viewer was unreachable. Made them `Pressable`.

### Dead code removed
- `features/accusation/AccusationSheet.tsx` (replaced by the wizard; was
  mounted but never opened — `accuseOpen` was never set true).
- `components/KeyboardAwareScrollViewCompat.tsx` (never imported).
- `core/friendDMContent.ts` (never wired; voicemail is the live channel).
- Unused `@workspace/api-client-react` dependency.
- `EvidenceChainBuilder`'s no-op `onChainBuilt` prop.

### Tooling
- Bumped Expo packages to expected SDK pins so `pnpm dev`'s version-check
  shim no longer blocks startup.

### Tests
- Added `scripts/test-content-integrity.mts` (`pnpm test:content-integrity`):
  cross-references every killer's deck, deduction, reveal gates, chain
  coverage, and voicemail fact-links — proves all 8 killers are winnable.
- Migrated all e2e specs from the retired AccusationSheet to the
  AccusationWizard flow; restored the lost "Skip Town" ending in the
  wizard (Step 1).
- Added `__tests__/e2e/z-onboarding-first-run.spec.ts` — drives the full
  8-step tutorial to the game (the path that was silently broken).
- Seeded onboarding-completed state in every game-loop boot helper so the
  overlay doesn't block the suite.
- Fixed fragile journal-filter assertions (substring name matches →
  structural group-count + accessibility-label chip targeting).

### Validation
- `pnpm typecheck` clean across all packages.
- 15/15 unit suites green (incl. new content-integrity).
- Full Playwright suite green (23 passed, 2 intentionally skipped — the
  non-deterministic Day-7 face-to-face tests, covered by legacy-seeded
  specs instead).

### Known content gap (not a code bug)
- No authored facts carry evidence images (A3xx range is UI chrome only),
  so the Photos app shows a graceful empty state. Wiring is correct for
  when evidence images are authored.

---

## 2026-05-12 — Phase 11 Full Implementation

**Agent**: opencode (big-pickle)
**Session type**: Implementation

### What happened

Implemented all 5 Phase 11 items: Settings screen, Title Screen polish, Continue Run Flow, Run History, and Onboarding Flow.

#### 11.1 Title Screen Polish
- Added run-status preview: suspect count (deck.length) + evidence count (committed facts)
- Added subtle parallax phone graphic animation (Animated translateY loop)
- Added confirmation dialog (`Alert.alert`) on "New Case (Reset)" with Cancel/Start New
- Added "View Run History" button routing to `/run-history`

#### 11.2 Onboarding Flow
- Created `features/onboarding/onboardingStore.ts` — Zustand store + AsyncStorage persistence for onboarding state
- Created `features/onboarding/OnboardingGate.tsx` — wraps root layout, gates onboarding on fresh install (no run, no archive)
- Created `features/onboarding/OnboardingManager.tsx` — 6-step flow:
  - Step 1: Welcome splash with story setup
  - Step 2: Phone tour with app callout list
  - Step 3: Swipe tutorial — auto-navigates to swipe, advances on first swipe
  - Step 4: Chat tutorial — auto-navigates to matches, advances on first player message
  - Step 5: Journal intro — navigates to journal, manual advance
  - Step 6: Accusation warning — final screen, marks onboarding complete
- Gate shows onboarding only on fresh install (no active run, no archive), skips for returning players

#### 11.3 Settings Screen
- Added `scanlinesEnabled`, `screenShakeEnabled`, `reduceMotionEnabled`, `highContrastTextEnabled` to `gameStore.ts` with AsyncStorage persistence and hydrate loading
- Added `"settings"` to `PhoneShellApp` union type
- Created `features/settings/SettingsIcon.tsx` — Feather gear icon in PixelIconFrame
- Created `features/settings/SettingsScreen.tsx` — Audio/Display/Accessibility/About sections with RN Switch toggles
- Added tile to `HomeGrid.APPS` array + routing case in `home.tsx`

#### 11.4 Run History
- Added `RunSummary` interface to `core/models.ts`
- Added `loadRunArchive()`/`saveRunArchive()` to `core/repository.ts` (AsyncStorage, capped at 10 entries)
- Added `runArchive` state to `gameStore.ts` — hydrates on load, saves when `startNewRun()` archives a closed run
- Created `features/title/RunHistoryScreen.tsx` — list of archived runs with killer name, outcome, stats
- Created `features/title/RunDetailScreen.tsx` — detail view with full stats, "Play Again" button
- Added `run-history/index` and `run-detail/[runId]` routes in `_layout.tsx` + expo-router files

#### 11.5 Continue Run Flow
- Added `Checkpoint` interface and optional `checkpoint` field to `CaseRun` model
- Added checkpoint-based routing in `app/home.tsx` — auto-navigates to the appropriate shell surface (date/facetime/chat) on mount if a checkpoint exists

### Files created
- `artifacts/catfish/features/settings/SettingsScreen.tsx`
- `artifacts/catfish/features/settings/SettingsIcon.tsx`
- `artifacts/catfish/features/title/RunHistoryScreen.tsx`
- `artifacts/catfish/features/title/RunDetailScreen.tsx`
- `artifacts/catfish/features/onboarding/onboardingStore.ts`
- `artifacts/catfish/features/onboarding/OnboardingGate.tsx`
- `artifacts/catfish/features/onboarding/OnboardingManager.tsx`
- `artifacts/catfish/app/run-history/index.tsx`
- `artifacts/catfish/app/run-detail/[runId].tsx`

### Files modified
- `artifacts/catfish/core/models.ts` — RunSummary, Checkpoint types
- `artifacts/catfish/core/repository.ts` — loadRunArchive, saveRunArchive
- `artifacts/catfish/core/gameStore.ts` — display prefs (fields+keys+loaders+setters), runArchive, archive-on-startNewRun
- `artifacts/catfish/features/parody/phoneShellState.ts` — +"settings" to PhoneShellApp
- `artifacts/catfish/features/parody/HomeGrid.tsx` — SettingsIcon import, "settings" in APPS + ParodyAppId
- `artifacts/catfish/app/home.tsx` — SettingsScreen import, settings routing, checkpoint restoration
- `artifacts/catfish/app/index.tsx` — parallax anim, run-status preview, Alert confirmation, View Run History
- `artifacts/catfish/app/_layout.tsx` — OnboardingGate wrap, run-history/run-detail Stack.Screen entries
- `llm-wiki/_activity/changelog.md` — this entry

### Verification
- `pnpm run typecheck` — **clean** across all 4 workspace packages

---

## 2026-05-12 — Phase 10 Remaining Items + Phase 11 Handoff

**Agent**: opencode (big-pickle)
**Session type**: Implementation + handoff

### What happened

Completed the last two items from the Phase 10 remaining-items checklist, then prepared a handoff document for Phase 10 residual work + Phase 11 build plan.

#### 10.1 SuspectBoard card tap → filter Journal

- Added `journalFilterCandidateId` + `setJournalFilter()` to `phoneShellState.ts` — a cross-app navigation parameter so SuspectBoard can tell Journal which suspect to filter on.
- Changed `SuspectBoardScreen.handleCardTap` to set the filter then navigate via `openApp("journal")` instead of opening a chat thread.
- Card hint: "tap to chat ▸" → "tap to review ▸".
- `JournalScreen` reads the filter from phoneShell on mount via `useEffect`, initializes `selectedSuspectId`, then clears the filter.

#### 10.4 Evidence strength breakdown in AccusationStep2

- Replaced single `EvidenceBar` with `EvidenceBreakdownBar`: three color-coded segments for strong (cyan `s`), contradiction (red `c`), unexplained (grey `u`).
- Added `strongFacts`, `contradictionFacts`, `unexplainedFacts` to `AccuseRow`.
- Breakdown computation builds a `chainAboutByFactId` map from evidence chains to categorize each captured fact.

#### Handoff document

Created `llm-wiki/features/handoff-phase10-to-11.md` with:
- Summary of this session's work
- Phase 10 remaining gaps vs PRD spec (SuspectBoard evidence counts per card)
- Full Phase 11 build plan with effort estimates, key files, dependency graph, and risk areas

### Files modified

- `artifacts/catfish/features/parody/phoneShellState.ts`
- `artifacts/catfish/features/journal/SuspectBoardScreen.tsx`
- `artifacts/catfish/features/journal/JournalScreen.tsx`
- `artifacts/catfish/features/accusation/AccusationStep2.tsx`
- `llm-wiki/features/handoff-phase10-to-11.md` (new)
- `llm-wiki/_activity/changelog.md` (this entry)

### Verification

- `pnpm run typecheck` — **clean** across all 4 workspace packages

---

## 2026-05-09 — React Port: SocialFeed, SuspectBoard, Journal P2

**Agent**: opencode (MiniMax-M2.7)
**Session type**: Implementation (React Native port)

### What happened

Ported three Pass 5/6 SwiftUI screens to React Native + Expo Router, then updated the Journal to handle the two-class fact system (authored + captured).

#### SocialFeedScreen (new)

Created `features/dating/SocialFeedScreen.tsx` — Instagram-style vertical feed:
- Character picker chip row (filters by matched candidates only)
- `SocialCard` per `Fact` where `source.kind === "instagram"`, sorted by day
- Each card shows square social art asset (`A700_kai_social_`, `A720_river_social_`, etc.) with caption text below
- Captions already carry killer-variant text: `buildAuthoredFacts()` applies `variableOverrides` at bootstrap time, so the double-blind tell works without additional wiring

Added `"social"` to `LotsOfFishView` + `"Social"` tab in `LotsOfFishApp.tsx`.

#### SuspectBoardScreen (new)

Created `features/journal/SuspectBoardScreen.tsx` — case board as a 2-column scrollable grid:
- `SuspectCard` per candidate from `run.deck`: portrait, name, 4-segment risk meter
- Risk levels: `???` (0 facts), `low` (1-2), `elevated` (3-5), `high` (6+)
- `isKillerCandidate` → red border + "suspect" badge
- `matchId` + `isDropped` → renders "dropped" chip; no chip for unmatched candidates
- Tap card → `router.push(\`/chat/${threadId}\`)` for matched candidates with a thread
- `tap to chat ▸` hint shown only on matched, non-dropped cards

Added `"board"` to `LotsOfFishView` + `"Board"` tab with `book-open` icon in `LotsOfFishApp.tsx`.

#### FactCard → unified authored + captured

Rewrote `FactCard.tsx` to handle both fact classes:
- `kind === "captured"` → shows `capturedQuote`, `capturedOnDay`, `✕` discard chip
- `kind !== "captured"` → shows `payload.text`, `fact.day`, colored `SourceBadge` (bio/IG/portrait expression/dev/friend/chat/narration)

#### JournalScreen P2 — two-class fact surfacing

Restructured `JournalScreen.tsx`:
- `authoredFacts` (non-captured committed) shown in a flat chronological section at the top with a purple header label + disclaimer ("world-logged · not discardable")
- `capturedFacts` continue to use existing `SuspectGroup` per-suspect layout with filter/sort controls
- `JournalControls` (filter chips + sort pills) appear only when captured facts exist
- Summary strip updated to 3-column: **captured / authored / suspects**
- Subtitle updated: "Long-press a chat message to capture a Fact. Authored facts are auto-logged."

### Key patterns learned

- `buildAuthoredFacts(runId, killer)` returns `Fact[]` where `kind: "static" | "variable" | "conditional"` — all pre-committed. Captured facts have `kind: "captured"` and `capturedFromCandidateId` set.
- `run.facts` is a flat array — grouping for display is done in the screen component with `useMemo`
- `isKillerCandidate` is `true` only on the actual killer candidate in `run.deck` (not decoys). This is the correct flag for the suspect board's killer indicator, NOT `identity === run.killer` (which was the old buggy pattern that caused all decoys to be marked as killers)
- `pixelShellState.ts` `LotsOfFishView` type must be updated whenever a new tab is added to the dating app shell

### Files created

- `artifacts/catfish/features/dating/SocialFeedScreen.tsx` (new)
- `artifacts/catfish/features/journal/SuspectBoardScreen.tsx` (new)

### Files modified

- `artifacts/catfish/features/parody/phoneShellState.ts` — added `"board" | "social"` to `LotsOfFishView`
- `artifacts/catfish/features/parody/LotsOfFishApp.tsx` — added Social + Board tabs with routing
- `artifacts/catfish/features/journal/FactCard.tsx` — unified authored/captured rendering
- `artifacts/catfish/features/journal/JournalScreen.tsx` — two-class fact surfacing, 3-column summary
- `llm-wiki/features/phone-os.md` — updated with new app tabs + board/social descriptions
- `llm-wiki/features/journal.md` (new) — full journal feature documentation
- `llm-wiki/index.md` — added journal page, updated stats
- `llm-wiki/_activity/changelog.md` — appended this entry

### Verification

- `pnpm tsc --noEmit` — **clean** (zero errors)

---

## 2026-04-30 — Journal discovery gating + unread clue badge

**Agent**: Codex (GPT-5)
**Session type**: Implementation

### What happened

- Removed automatic day-1 clue discovery during run bootstrap:
  - `RunBootstrapper.apply` no longer calls `autoDiscoverDayOneFacts`.
- Added per-run journal read state:
  - `CaseRun.journalLastSeenClueCount` (default `0`).
- Added journal unread logic in game state:
  - `GameState.newJournalClueCount` computes discovered-minus-seen.
  - `GameState.markJournalViewed()` updates `journalLastSeenClueCount` and saves.
- Wired Journal app icon badge:
  - `HomeScreen.badge(for:)` now returns unread clue count for `.journal`.
- Opening the Journal now clears unread clues:
  - `ClueJournalView.onAppear` calls `try? gameState.markJournalViewed()`.

### What was learned

- The immediate “12 clues discovered” state on a fresh run was caused by day-1
  auto-seeding of `DiscoveredFact` records, not by Journal rendering.
- Existing architecture supports badge behavior cleanly via `GameState` without
  introducing new global phone OS notification state.

### Files changed

- `catfish/Core/Content/RunBootstrapper.swift`
- `catfish/Core/Models/CaseRun.swift`
- `catfish/Core/GameState.swift`
- `catfish/Features/PhoneOS/HomeScreen.swift`
- `catfish/Features/Journal/ClueJournalView.swift`
- `llm-wiki/features/phone-os.md`
- `llm-wiki/architecture/data-models.md`
- `llm-wiki/index.md`
- `llm-wiki/_activity/changelog.md`

### Verification

- Xcode diagnostics check on edited files: no new errors.
- Full Xcode build: **SUCCEEDED**.

## 2026-04-29 — Phase 13: End-to-End Playtest Polish & Beta Release

**Agent**: opencode (glm-5.1)
**Session type**: Implementation

### What happened

- Created `Features/Ending/EndingOverlay.swift` — full-screen ending overlay with phased reveal animation for all 4 CaseEnding types
- Created `Features/Ending/Day7UrgencyBanner.swift` — journal urgency banner shown on day 7
- Added `EndingResult` struct to `GameState` — captures ending type, killer, narrative beat, evidence strength, fact count, days played
- Updated `RootView` routing — shows EndingOverlay when run ends (replaces inline AccusationView result overlay)
- Wired `.metKiller` ending — day 7 meet invitation now uses `ChatMessageKind.day7MeetInvitation` with Accept/Decline buttons in chat
- Updated `PhoneStatusBar` — day 7 shows warning color and "LAST DAY" sub-banner
- Added `Day7UrgencyBanner` to `ClueJournalView`
- Added `isDay7`, `canAdvanceDay` computed properties to `GameState`
- Updated `AccusationResolver` — added `isLuckyGuess` flag, evidence strength calculation
- Enhanced edge case: zero-evidence accusation shows warning before proceeding
- AccusationView auto-dismisses after 4 seconds to let EndingOverlay display
- Replaced all 18 `print()` statements with `os.Logger` across AudioEngine, VoiceManifest, ContentSchema, NarrativeHookRouter, DateSceneLoader
- Debug killer picker now hidden behind long-press gesture on splash screen
- Added `ChatMessageMeta.isDay7Meet` field for day 7 meet invitation identification

### What was learned

- `CaseEnding.metKiller` was defined but never triggered — now wired through day 7 chat invitation acceptance
- `EndingResult` decouples the ending display from the accusation resolution, allowing metKiller and killerEscaped endings to share the same overlay
- The day 7 meet invitation must use a distinct `ChatMessageKind` (not `.system`) so the ChatBubble can render Accept/Decline buttons
- VoicePlayer already handles audio interruption resume correctly — no changes needed
- SwipeView already has graceful empty state when all profiles swiped

### Files changed

- `catfish/Features/Ending/EndingOverlay.swift` (new)
- `catfish/Features/Ending/Day7UrgencyBanner.swift` (new)
- `catfish/Core/GameState.swift` (modified — EndingResult, narrativeBeat, evidenceStrength, isDay7, canAdvanceDay)
- `catfish/Core/AccusationResolver.swift` (modified — isLuckyGuess, evidenceStrengthFor)
- `catfish/RootView.swift` (modified — ending overlay routing)
- `catfish/Features/PhoneOS/StatusBar.swift` (modified — day 7 urgency display)
- `catfish/Features/Journal/ClueJournalView.swift` (modified — Day7UrgencyBanner)
- `catfish/Features/Journal/AccusationView.swift` (modified — auto-dismiss, zero-evidence warning)
- `catfish/Features/Matches/ChatView.swift` (modified — day 7 meet buttons, acceptDay7Meet)
- `catfish/Core/Models/ChatMessage.swift` (modified — day7MeetInvitation kind, isDay7Meet meta)
- `catfish/Core/Content/ContentScheduler.swift` (modified — day 7 meet uses day7MeetInvitation kind)
- `catfish/Audio/AudioEngine.swift` (modified — print → os.Logger)
- `catfish/Audio/VoiceManifest.swift` (modified — print → os.Logger)
- `catfish/Core/Content/ContentSchema.swift` (modified — print → os.Logger)
- `catfish/Core/Narrative/NarrativeHookRouter.swift` (modified — print → os.Logger)
- `catfish/Core/Date/DateSceneLoader.swift` (modified — print → os.Logger)
- `llm-wiki/features/ending-system.md` (new)
- `llm-wiki/index.md` (updated)
- `llm-wiki/_activity/changelog.md` (updated)

### Verification

- Build: **SUCCEEDED** (zero errors)

---

## 2026-04-28 — Phase 6: Narrative Hook Expansion + Arcade Polish

**Agent**: opencode (glm-5.1)
**Session type**: Implementation

### What happened

- Expanded `HookCatalog` from ~13 hooks to 72 hooks covering all 20 game×killer combinations
- Added `HookPriority` system to `NarrativeHook`: `.killerSpecific` (3), `.global` (2), `.generic` (1)
- Upgraded `NarrativeHookRouter` with priority sorting, kind deduplication, and 30-second cooldown per trigger source
- Created `ArcadeSharedUI.swift` with `ArcadeGameOverOverlay` and `ArcadeExitAlert`
- All 4 arcade games now use consistent game-over overlays and exit confirmation dialogs
- Created `PhotosGalleryView` — evidence gallery replacing the photos stub
- Wired Photos app into `PhoneShell` router

### What was learned

- `NarrativeHook` init needs a `priority` parameter — all existing call sites default to `.generic`
- The hook router's kind deduplication uses fingerprint strings ("toast", "wordSuggestion", etc.) to prevent multiple hooks of the same kind firing from one event
- Exit confirmation in arcade games requires showing the alert overlay above the game board, separate from the game-over overlay
- SugarCoat and SafeSpot both have `gamePhase` / `phase` state that affects exit behavior — the exit alert fires `didEnd(.exited)` on confirm

### Files changed

- `catfish/Core/Narrative/HookCatalog.swift` (rewritten — 72 hooks)
- `catfish/Core/Narrative/NarrativeHookRouter.swift` (rewritten — priority, dedup, cooldown)
- `catfish/Features/Apps/Arcade/ArcadeSharedUI.swift` (new)
- `catfish/Features/Apps/Photos/PhotosGalleryView.swift` (new)
- `catfish/Features/Apps/Arcade/WordLow/WordLowGame.swift` (modified — shared UI + exit alert)
- `catfish/Features/Apps/Arcade/EgoTrip/EgoTripGame.swift` (modified — shared UI + exit alert)
- `catfish/Features/Apps/Arcade/SugarCoat/SugarCoatGame.swift` (modified — shared UI + exit alert)
- `catfish/Features/Apps/Arcade/SafeSpot/SafeSpotGame.swift` (modified — shared UI + exit alert)
- `catfish/Features/PhoneOS/PhoneShell.swift` (modified — photos routes to PhotosGalleryView)

### Verification

- Build: **SUCCEEDED** (zero errors, zero warnings)

---

## 2026-04-28 — Phase 2: Fact Universe Authoring (Days 1-3)

**Agent**: opencode (glm-5.1)
**Session type**: Implementation

### What happened

- Implemented the full Clue Graph Schema v0.1 for the fact universe:
  - New enums: `FactKind` (static/variable/conditional), `FactSource` (with associated values), `FriendID` (dev/nia)
  - `FactPayload` upgraded with optional `voiceLineID`
  - `Fact` model rewritten: flat fields replaced with `kindRaw`, `sourceData` (encoded FactSource), `payloadData` (encoded FactPayload), `day`, `aboutCharacterRaw`
  - New `DiscoveredFact` model: `factID`, `discoveredAt`, `playerNote`, `linkedFactIDs` — the journal commit contract
  - `CaseRun` upgraded: added `rngSeed`, `discovered` relationship to DiscoveredFact, `discoveredFactIDs` computed property
  - `CaseEnding` aligned with schema: `caughtThem`, `wrongfulAccusation`, `metKiller`, `killerEscaped`
  - New `AccusationResolver` with evidence-based scoring: correct accusations get "evidence verified" vs "lucky guess" distinction; wrong accusations match red herring chains
- Updated `ContentSchema.swift`: `FactContent` now has `kind`, `source` (FactSourceContent), `payload` (FactPayloadContent) fields
- Rewrote `content.json` with full Days 1-3 fact universe (30 facts):
  - 12 Day 1 facts (bio profiles + friend observations) — all `staticFact`
  - 7 Day 2 facts (social posts + DMs + friend advice) — all `staticFact`
  - 11 Day 3 facts (investigation clues + conditional + variable + friend) — mix of `staticFact`, `variable`, `conditional`
  - Added missing facts: `jules_day2_late_reply`, `river_bootprint_size_swap`, `sam_medcart_log_edit`, `river_day3_unreachable`, `sam_pharmacy_receipt_odd`, `miles_cash_payment_note`, `kai_late_night_dropcloth`
- `RunBootstrapper` rewritten: properly handles three-layer fact system (static → always inserted, variable → payload overridden per killer, conditional → only inserted if killer's conditionalFactIDs contains the fact ID)
- `ContentScheduler` upgraded: auto-discovers day-gated facts by creating DiscoveredFact entries on advanceDay
- `GameState` upgraded: added `commitFact()`, `isFactDiscovered()`, `makeAccusation()` using AccusationResolver
- `ClueJournalView` rewritten: groups discovered facts by day, shows fact kind badge and source label
- `AccusationView` rewritten: uses AccusationResolver, shows evidence verification status
- `catfishApp.swift`: added DiscoveredFact to Schema, added automatic database recovery on schema mismatch (deletes old store and retries)

### What was learned

- SwiftData schema changes that remove/rename properties are destructive — the old database must be deleted. The ModelContainer now auto-recovers by deleting the old store on schema mismatch.
- `CFFont` only has `title`, `headline`, `body`, `caption` — no `caption2`. Use `caption` for small text.
- The three-layer fact system (static/variable/conditional) is fully functional: RunBootstrapper correctly applies variable overrides and filters conditional facts based on the active KillerIdentity
- The double-blind tell works: `miles_ig_window_reflection` is a variable fact whose payload changes per killer (suburban parking lot reflection when Miles is killer, generic downtown when others are killer)
- `FactSource` with associated values requires JSON encoding for SwiftData storage — stored as `Data` property, decoded via computed property
- Friend observations (`dev_d1_first_impression`, etc.) are now also facts with kind=`staticFact` and source=`friendText`, making them part of the evidence system

### Files changed

- `catfish/Core/Models/KillerIdentity.swift` (modified — added FactKind, FactSource, FriendID, updated FactPayload)
- `catfish/Core/Models/Fact.swift` (rewritten — schema-aligned with kindRaw, sourceData, payloadData)
- `catfish/Core/Models/DiscoveredFact.swift` (new)
- `catfish/Core/Models/CaseRun.swift` (modified — added rngSeed, discovered relationship, updated CaseEnding)
- `catfish/Core/AccusationResolver.swift` (new)
- `catfish/Core/Content/ContentSchema.swift` (modified — new FactContent, FactSourceContent, FactPayloadContent types)
- `catfish/Resources/Content/content.json` (rewritten — 30 facts with kind/source annotations)
- `catfish/Core/Content/RunBootstrapper.swift` (rewritten — three-layer fact system)
- `catfish/Core/Content/ContentScheduler.swift` (modified — auto-discover facts on day advance)
- `catfish/Core/GameState.swift` (modified — commitFact, makeAccusation, resolveAccusation)
- `catfish/catfishApp.swift` (modified — DiscoveredFact in Schema, auto-recovery on schema mismatch)
- `catfish/Features/Journal/ClueJournalView.swift` (rewritten — new model access)
- `catfish/Features/Journal/AccusationView.swift` (rewritten — AccusationResolver)

### Verification

- Build: **SUCCEEDED** (zero errors, zero warnings)
- Tests: **27/27 passed** (all existing tests still pass)
- Simulator: **App launches without crash** on iPhone 17 Pro

## 2026-04-28 — Phase 1: Content Pipeline Infrastructure

**Agent**: opencode (glm-5.1)
**Session type**: Implementation

### What happened

- Implemented the full content pipeline infrastructure:
  - `Core/Content/ContentSchema.swift` — `ContentStore` singleton + Codable types for JSON content universe
  - `Core/Content/RunBootstrapper.swift` — Seeds facts, friend threads, and day-1 events on new run creation
  - `Core/Content/ContentScheduler.swift` — Emits day-gated content (friend messages, match messages) on day advance
  - `Resources/Content/content.json` — 5 character profiles, 23 facts (base + conditional + variable), day events for all 7 days
- Updated `catfishApp.swift`: Added `Fact.self` and `ChatMessage.self` to SwiftData Schema, removed `Item.self`, added `ContentStore.shared.load()` bootstrap
- Updated `GameState.swift`: Removed inline RunBootstrapper/ContentScheduler stubs (now in Core/Content/)
- Updated `SwipeDeckViewModel.swift`: Loads profiles from ContentStore with fallback to hardcoded data

### What was learned

- Xcode build target auto-discovers files under `catfish/` — new files in `Core/Content/` compiled without manual project changes
- `Item.swift` is dead code (Xcode template leftover) — removed from Schema but file still exists
- Test runner crashes with "Early unexpected exit at <external symbol>" — pre-existing simulator infrastructure issue, not code-related
- The JSON content schema uses fact IDs as keys, matching the `conditionalFactIDs` pattern in `KillerImplementations.swift`
- `RunBootstrapper` merges JSON content (fact text/assets) with Swift logic (which facts are conditional, variable overrides)

### What's still uncertain

- Whether `content.json` needs to be added to Xcode project file explicitly for bundle inclusion
- Whether the new files need to be added to the Xcode target membership manually (they compiled, so probably auto-discovered)
- Test runner crash root cause — may need CI-specific investigation

### Files changed

- `catfish/Core/Content/ContentSchema.swift` (new)
- `catfish/Core/Content/RunBootstrapper.swift` (new)
- `catfish/Core/Content/ContentScheduler.swift` (new)
- `catfish/Resources/Content/content.json` (new)
- `catfish/Core/GameState.swift` (modified)
- `catfish/catfishApp.swift` (modified)
- `catfish/Features/Swipe/SwipeDeckViewModel.swift` (modified)

---

## 2026-04-26 — Wiki Bootstrap

**Agent**: opencode (glm-5.1)
**Session type**: Setup

### What happened

- Bootstrapped the LLM Wiki from scratch based on the v2 guide and existing
  project documentation (README.md, file structure).
- Created `AGENTS.md` with project schema and wiki conventions.
- Seeded 12 initial pages covering architecture, features, and decisions.
- Created page templates for future use (generic, ADR, gotcha, feature).

### What was learned

- Project uses PhoneOS meta-UI metaphor wrapping game features as phone apps
- Arcade mini-games surface narrative hooks through a dedicated hook system
- Voice pipeline has both pre-generated (known lines) and on-demand (Eastworld) paths
- DateDirector is a full async state machine with checkpoint save/restore

### What's still uncertain

- Exact details of Arcade mini-game mechanics (not yet read in depth)
- PhoneOSState management details (not yet read in depth)
- Whether any gotchas have been discovered in previous sessions
- Content of `Docs/voice_pipeline.md` cost guardrails

### Pages created

- `AGENTS.md`
- `llm-wiki/index.md`
- `llm-wiki/architecture/overview.md`
- `llm-wiki/architecture/data-models.md`
- `llm-wiki/features/swipe.md`
- `llm-wiki/features/date-mode.md`
- `llm-wiki/features/phone-os.md`
- `llm-wiki/features/arcade.md`
- `llm-wiki/features/voice-pipeline.md`
- `llm-wiki/decisions/player-paced-days.md`
- `llm-wiki/decisions/killer-stamped-at-start.md`
- `llm-wiki/decisions/journal-commit-contract.md`
- `llm-wiki/decisions/hybrid-swiftui-spritekit.md`
- `llm-wiki/decisions/voice-cloudflare-worker.md`
- `llm-wiki/_templates/generic.md`
- `llm-wiki/_templates/adr.md`
- `llm-wiki/_templates/gotcha.md`
- `llm-wiki/_templates/feature.md`

## 2026-04-29 — Profile image schema expansion

### What was changed

- Expanded `ProfileContent` to include five additional portrait asset IDs (`flirty`, `sinister`, `uneasy`, `smile`, `curious`) plus `fullBodyFormalAssetID`.
- Expanded `CandidateProfile` and content-to-profile mapping in `SwipeDeckViewModel` to carry the same new image fields.
- Updated all `profiles` entries in `catfish/Resources/Content/content.json` for Kai, River, Miles, Sam, and Jules with the new fields.
- Kept Sam and River asset references aligned with current catalog naming (`A052_sam_portrait_...` style and `A068_river-full-body_formal`).

### Validation

- Xcode build completed successfully after changes.

## 2026-04-29 — Kai chat fallback repetition debug

### What was changed

- Updated `catfish/Features/EastworldChatService.swift` fallback behavior to rotate through multiple per-character fallback lines instead of repeating a single hardcoded line.
- Added actor-tracked fallback cursor state so fallback variation is deterministic across consecutive failures.
- Preserved `(connection unstable)` tagging on alternating fallback turns and when budget is at limit.
- Updated `catfish/Features/Matches/ChatView.swift` to keep a persistent `ProductionDateEastworldClient` instance for the life of the chat view instead of recreating one per message.

### Why

- When the Eastworld chat endpoint fails, the prior implementation always returned the same Kai fallback line, which looked like an infinite repetition bug to the player.

### Validation

- `XcodeRefreshCodeIssuesInFile` reported no issues in edited files.
- Xcode build completed successfully.
