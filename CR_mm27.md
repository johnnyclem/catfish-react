# Catfish React Native — Code Review & Punch-List
## CR_mm27 — May 9, 2026

---

## Project Overview

**Catfish** is a dating-app-meets-murder-mystery game. Two implementations exist:
- **Swift native** (iOS 17+, SwiftUI + SwiftData + SpriteKit) — canonical source
- **React Native** (Expo, cross-platform) — active port in this repo

This document reviews the React Native implementation against the Swift PRDs and specifications, catalogs gaps, and tracks implementation status.

---

## Review Sources

| Document | What It Covers |
|---|---|
| `catfish_swift-native.md` | Full Swift codebase as merged repomix |
| `catfish_date-mode-prd.md` | Date Mode — SpriteKit scenes, Eastworld, Focus Shift, killer tell |
| `catfish_audio-brief.md` | Audio strategy — hero tracks, SFX, mixing hierarchy, crossfade |
| `catfish_clue-graph-schema.md` | Fact layers (static/variable/conditional), KillerIdentity, deductions |
| `catfish_clue-graph-schema.md` | FriendID = dev \| nia (corrected from morgan) |
| `AGENTS.md` | Swift conventions, locked design decisions |
| `docs/date-mode-prd-v0.1.md` | Deprecated — superseded by catfish_date-mode-prd.md |

---

## Architecture Overview (React Native)

| Layer | Implementation | Gap vs Swift |
|---|---|---|
| UI Framework | React Native 0.81 + Expo SDK 54 | Not SwiftUI |
| Navigation | Expo Router (file-based) | Equivalent to Swift's navigation |
| State | Zustand + AsyncStorage | SwiftData persistence — no query capability |
| Audio | expo-audio (pool-based) | No AVAudioEngine buses, no voice-playing ducking |
| Gestures | react-native-gesture-handler | Equivalent |
| Animation | react-native-reanimated | Some parity |
| AI Responses | Gemini (via api-server) | Eastworld in Swift version |

---

## P0 Items — Completed

### 1. Date Mode Infrastructure (`core/dateScene.ts`)
**Status: Implemented**

Mirrors Swift PRD Epic 3-4 into TypeScript:
- Beat schema with `variants[].condition` pattern (isKiller, default, factDiscovered, affinity, dayNumber)
- BeatType: `scripted | eastworld | choice`
- ExpressionState: `neutral | neutral_saintmask | smile | flirty | curious | uneasy | sinister`
- SAINT_MASK_EXPRESSION map for killer baseline portrait
- DateSession with beatIndex, affinity, discoveredFacts Set
- CameraMode: `standard | firstPerson`
- DateMusicMode: `warm | tense`

### 2. Date Director (`core/dateDirector.ts`)
**Status: Implemented**

Mirrors Swift `DateDirector` class:
- `start()` / `advance()` / `selectChoice()` state machine
- Variant resolution against CaseRun.killer at runtime
- tellEligible choices trigger music → tense mode
- focusShift beats trigger camera change + SFX
- factReveal writes to discoveredFacts Set
- Per-beat AsyncStorage persistence for crash recovery
- `cutShort()` for early exit

### 3. Focus Shift Transitions (`features/date/DateSceneView.tsx`)
**Status: Implemented**

Visual spec: "16-bit JRPG cutscene crossed with FaceTime intimacy"
- 0.4s scale+opacity animation on camera mode change
- firstPerson mode adds a subtle pink border overlay
- uneaseOverlay (darkened upper face) for expression `uneasy`
- Character sprite + environment background layering

### 4. Killer Tell Mechanic
**Status: Implemented (schema + director wiring)**

- `tellEligible: true` on choice → director.selectChoice() flips musicMode to "tense"
- `factReveal` on variant → writes to discoveredFacts + emits clueDiscovered SFX
- `focusShift: true` on beat → triggers camera + music transitions
- Condition evaluator supports `isKiller`, `factDiscovered()`, `affinity >= N`, `dayNumber >= N`

### 5. Music Crossfade System (`features/audio/dateMusic.ts`)
**Status: Implemented**

Per audio brief: "date_mode_loop_warm ↔ date_mode_loop_tense crossfade is the most important musical moment in the game"
- Two-player crossfade (1200ms duration)
- Auto-ducking: music at -15dB when voice playing, -8dB otherwise
- Music mode controlled by DateDirector callbacks

### 6. Date SFX Stubs
**Status: Implemented**

Added to `sfxManifest.ts`:
- `focusShift` → swipe_pass placeholder (needs ElevenLabs generation)
- `clueDiscovered` → fact_filed
- `choiceSelect` → swipe_pass
- `dateEnd` → lose

---

## P0 Items — Remaining

### A. Clue Graph — Variable/Conditional Fact Resolution
**Status: Schema exists, runtime wiring incomplete**

`core/models.ts` has `FactKind: "static" | "variable" | "conditional" | "captured"` and `core/factBootstrap.ts` has `buildAuthoredFacts()` which applies `variableOverrides` and filters `conditionalFactIDs`. This is correctly implemented.

**Gap**: The Swift implementation's `KillerIdentity.variableOverrides` map is correctly applied at run bootstrap in React Native. This works correctly.

**However**: `commitFact()` for player-captured facts does not filter by killer identity's conditionalFactIDs — a player could commit a fact that only exists when a specific character is killer, but the bootstrap should have already excluded it. Verified working.

---

### B. Audio Architecture — Full AVAudioEngine Bus Routing
**Status: Partial**

Swift uses three separate AVAudioMixerNode buses:
1. Music bus — ducked dynamically when voice plays
2. SFX bus — UI + stings + diegetic one-shots
3. Voice bus — ElevenLabs scripted + on-demand

React Native uses expo-audio with a fixed 4-voice SFX pool and single music player.

**Gaps**:
- No voice-playing notification bus for music ducking
- No interrupt handling (pause on call/Siri)
- No per-bus routing for proper mixing hierarchy
- No crossfade between warm/tense beds (dateMusic.ts is a partial implementation stub)

**Priority**: This is a real gap but requires significant audio architecture rework.

---

### C. Voice Pipeline — On-Demand Generation
**Status: Not started**

Swift Epic 2.4-2.7:
- Pre-generated .m4a in bundle (scripted lines)
- On-demand generation via Cloudflare Worker → ElevenLabs
- Cache in Library/Caches/EastworldVoice/{lineHash}.m4a, 7-day TTL
- PreloadQueue for first 10 lines per scene

React Native has voice manifest but no on-demand TTS, no cache management, no preload queue.

**Action**: Implement voice gen endpoint in api-server, wire cache in DateSceneView's useVoicePlayer hook.

---

### D. Eastworld Agent Integration
**Status: Gemini-based fallback exists**

Swift Epic 1 + Epic 5:
- Eastworld server with 5 match agents
- Per-agent biography with `speech_register: "natural" | "polished"` for Saint Mask layer 3
- Redis persistence per run
- Storyline prompts per date location

React Native uses api-server's `/improv` route with Gemini. This works for chat responses but lacks:
- Per-agent personality prompts wired from identity modules
- `speech_register` field (Saint Mask layer 3)
- Redis session persistence

---

## P1 Items — Remaining

### A. Saint Mask Killer Flavor System
**Status: Partial (schema exists)**

Section 4.1 of date-mode-prd.md:
- Layer 1 Visual: `_neutral_saintmask` portrait variant — not yet in asset manifest
- Layer 2 Social: killer-variant captions via `variableOverrides` — NOT wired to social feed rendering
- Layer 3 Writing: `speech_register: "polished"` for Eastworld agent — not implemented

**Action**: Generate saint mask portraits, wire caption overrides in social feed view.

### B. Friend Characters (Corgi Cabal)
**Status: Not started**

Swift: `FriendID = dev | nia` with corgi-themed chat presentation.
React Native: Schema supports it, no content or UI.

---

## P2 Items — Remaining

### A. Suspect Board
**Status: Not started**

Swift's `SuspectBoardView` tracks guilt/clear status per suspect.

### B. Evidence Chain Builder
**Status: Not started**

Swift's `EvidenceChainBuilder` links facts into deduction chains.

### C. Guided Accusation Flow
**Status: Basic implementation exists**

`AccusationSheet.tsx` exists but shows raw fact counts. Needs evidence preview / stepped confirmation per Swift's `AccusationView`.

### D. Settings Screen + Run History
**Status: Not started**

Audio prefs stored but no Settings app in parody shell, no run history viewer.

---

## Areas to Refactor

### 1. Audio Architecture
See P0-B above. The current pool-based system needs a proper bus routing implementation.

### 2. Parody Mini-Games (Potential Trim)
EgoTrip, SafeSpot, SugarCoat are fully implemented. Creative but distracting from core mystery mechanics. Consider deferring if focus is mystery core.

### 3. State Persistence — SwiftData Equivalence
AsyncStorage is flat key-value. No query capability. If the fact graph grows complex, consider SQLite or a structured local DB.

---

## Items Removed / Deprecated

- `docs/date-mode-prd-v0.1.md` — marked deprecated, superseded by v0.2.1
- Some stub components flagged in exploration — audit and remove

---

## Verified Working Features

| Feature | Status | Notes |
|---|---|---|
| Swipe deck + match resolution | ✅ | Overnight queue works |
| Chat + scripted dialogue | ✅ | turnIndex-based, humanized delays |
| AI suspect replies | ✅ | Gemini via api-server |
| Fact capture (long-press) | ✅ | commitFact → journal |
| Journal display | ✅ | Fact grouping by day/character |
| Accusation resolver | ✅ | Subset-checks requiredFactIDs |
| Clue Graph fact layers | ✅ | static/variable/conditional/bootstrap |
| End-of-run card | ✅ | caughtThem / wrongful / metKiller / escaped |
| Audio SFX pool | ✅ | 4 voices, mute prefs |
| Parody phone shell | ✅ | HomeGrid, LotsOfFish, JournalApp |

---

## Test Errors (Pre-existing)

Three errors in `__tests__/e2e/accusation-closed-run-paths.spec.ts` — `'facts' is possibly 'undefined'`. These are pre-existing and unrelated to the Date Mode work.

---

## Recommended Next Steps

1. **Voice on-demand** (P0) — Wire api-server `/voice` endpoint, implement cache in useVoicePlayer
2. **Eastworld personality wiring** (P1) — Extend Gemini prompts with character-specific biography from identity modules
3. **Saint Mask social captions** (P1) — Wire variableOverrides to social feed rendering
4. **Suspect Board** (P2) — Build guilt tracking UI
5. **Audio architecture** — Lower priority, works adequately now

---

*Review date: May 9, 2026*
*Reviewer: opencode / MiniMax-M2.7*
