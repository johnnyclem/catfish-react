---
confidence: 0.95
sources:
  - artifacts/catfish/features/audio/AudioProvider.tsx
  - artifacts/catfish/features/audio/bgmManifest.ts
  - artifacts/catfish/features/audio/sfxManifest.ts
  - artifacts/catfish/features/audio/ambienceManifest.ts
  - artifacts/catfish/features/audio/audioEvents.ts
  - artifacts/catfish/features/voice/useDialogueVoice.ts
  - artifacts/catfish/scripts/generate-bgm.mts
  - artifacts/catfish/scripts/generate-sfx.mts
  - artifacts/catfish/app/home.tsx
  - artifacts/catfish/core/gameStore.ts
  - artifacts/catfish/features/settings/SettingsScreen.tsx
  - artifacts/catfish/components/PixelSlider.tsx
  - llm-wiki/activity/changelog.md
last-confirmed: 2026-05-12
supersedes: features/handoff-phase11-to-12
status: active
---

# Handoff: Phase 12 (Audio Pipeline) → Phase 13

## What Phase 12 Delivered

The full audio pipeline: BGM crossfade engine, SFX bus, ambience layer, volume controls with persistence, voice ducking, and ElevenLabs generation scripts.

## Current State

### Audio Architecture

| Layer | File | Status |
|-------|------|--------|
| **BGM Engine** | `features/audio/AudioProvider.tsx` | Dual-player crossfade, context-based track resolution via `resolveBgm()`, loop support |
| **SFX Bus** | `features/audio/audioEvents.ts` | Fire-and-forget pub-sub, `emitSfx(name)` + `subscribeSfx(listener)` |
| **Ambience** | `features/audio/AudioProvider.tsx` | Single loop player, `resolveAmbience()` currently returns null (no ambience mapped yet) |
| **Volume State** | `core/gameStore.ts` | `bgmVolume(0.32)`, `sfxVolume(0.85)`, `voiceVolume(0.9)`, `ambienceVolume(0.25)` — each AsyncStorage-persisted |
| **Voice Ducking** | `features/voice/useDialogueVoice.ts` + AudioProvider's `audioDuckRef` | Ducks BGM/ambience to 30% during TTS playback |

### Manifests (all use `require()` for Metro compatibility)

- `bgmManifest.ts` — 12 `BgmName` keys, requires `.wav`
- `ambienceManifest.ts` — 8 `AmbienceName` keys, requires `.wav`
- `sfxManifest.ts` — 26 `SfxName` keys, requires `.wav`

### Volume UI

- `SettingsScreen.tsx` — Per-bus `PixelSlider` rows (BGM/SFX/Voice/Ambience) with mute toggles
- `PixelSlider.tsx` — Custom slider with gesture handling, pixel-art cyan/bone aesthetic

### SFX Wiring — All 71 call sites

| SfxName | Trigger File |
|---------|-------------|
| `swipe_pass` / `swipe_like` | SwipeView |
| `swipe_left` / `swipe_right` | SwipeView |
| `day_end` / `day_advance` | SwipeView |
| `match` | MatchCelebration, WordLow, SafeSpot, EgoTrip, SugarCoat |
| `match_first_message_tone` | *(unwired)* |
| `fact_filed` | MessageFactGesture, SugarCoat |
| `tab_switch` | LotsOfFishApp |
| `app_open` / `app_close` | home.tsx mount/unmount |
| `back_button` | home.tsx HomeIndicator, ThreadView.tsx back |
| `evidence_link` | EvidenceChainBuilder |
| `accuse` / `lose` | EvidenceChainBuilder (invalid link), AccusationSheet, AccusationStep3 |
| `accusation_correct` / `accusation_wrong` | EndOfRunCard |
| `win` / `lose` | EndOfRunCard, WordLow, various games |
| `choiceSelect` | DateSceneView |
| `dateEnd` | DateSceneView |
| `focusShift` | core/dateDirector |
| `clueDiscovered` | core/dateDirector |
| `message_send` | ThreadView |
| `message_receive` | ThreadView |
| `notification_chime` | *(unwired)* |
| `phone_buzz` | *(unwired)* |

### ElevenLabs Generation Scripts

| Script | Endpoint | Tracks | Cost | Run Command |
|--------|----------|--------|------|-------------|
| `scripts/generate-bgm.mts` | ElevenLabs Music API | 12 BGM | $0.30/min | `pnpm bgm:gen` |
| `scripts/generate-sfx.mts` | ElevenLabs Sound Effects API | 19 SFX + 8 ambience | $0.12/gen | `pnpm sfx:gen` |

Both require `ELEVENLABS_API_KEY` in env. Hash-sidecar idempotency in `assets/audio/audio-*-hashes.json`.

## What's Still Missing (Candidate Phase 13 Work)

### 1. Notification Chime + Phone Buzz Triggers
- `notification_chime` should fire when a suspect message arrives while the player is NOT in the thread
- `phone_buzz` should fire on match announcements, day-advance events, pending notifications
- Best handled in `MatchesScreen` or a thread-level effect in the LOF tab bar

### 2. Ambience Mapping
- `resolveAmbience()` in `AudioProvider.tsx:128` currently returns `null` for all surfaces
- Could map phone shell context (rain for rainy scenes, coffee shop for chat, etc.)
- Needs ambience manifest keys and crossfade from `null`→track→`null`

### 3. ElevenLabs Generation Execution
- Both scripts built but never run — need API key configured and execution
- Output files (`.mp3` for BGM, `.wav` for SFX/ambience) will overwrite the silent stubs
- `swipe_right` in `sfxManifest.ts:45` currently aliases to `swipe_like` asset — after generation it should be updated to point to the dedicated `swipe_right.wav`

### 4. BGM Edge Cases
- `noir_loop` fallback in `resolveBgm()` (line 124) — this was the procedural placeholder. Should be `bgm_main_theme` or removed after ElevenLabs run
- Check if any phone shell surface is missing a mapping (settings, browser, photos, facetime)

### 5. Testing
- No audio tests exist yet. Consider:
  - SFX bus subscription test (emit → listener fires)
  - Volume persistence round-trip
  - Duck/unduck state transitions
  - BGM crossfade timing (manual QA)

### 6. Numbered Asset Migration
- The current procedural WAV stubs use the old numbered format (`bgm_1.wav` etc.) — the new manifest uses semantic names (`bgm_swipe`, `bgm_chat`). After ElevenLabs generation, the numbered stubs should be cleaned up

### 7. Web Audio Workaround
- `AudioProvider.tsx:44` `REQUIRES_USER_GESTURE` flag enables web-specific gesture gating — first SFX is held until user interaction. This may need refinement for web builds

### 8. SpriteKit Date Mode Audio
- Date scenes currently use `emitSfx("choiceSelect")` and `emitSfx("dateEnd")` — future SpriteKit integration may need direct audio channel access instead of the event bus

## Key Files Reference

```
artifacts/catfish/
├── features/
│   ├── audio/
│   │   ├── AudioProvider.tsx       # Core audio engine (BGM/ambience/SFX/duck)
│   │   ├── audioEvents.ts          # SFX pub-sub bus
│   │   ├── bgmManifest.ts          # BGM track manifest
│   │   ├── sfxManifest.ts          # SFX manifest
│   │   └── ambienceManifest.ts     # Ambience manifest
│   ├── voice/
│   │   └── useDialogueVoice.ts     # Voice playback + ducking integration
│   ├── settings/
│   │   └── SettingsScreen.tsx       # Volume sliders + mute toggles
│   └── chat/ThreadView.tsx         # SFX wired (send/receive/back)
├── components/
│   └── PixelSlider.tsx             # Custom volume slider
├── core/
│   └── gameStore.ts                # Volume state + persistence
├── app/
│   └── home.tsx                    # app_open/close/back wired
├── assets/audio/
│   ├── music/                      # BGM WAV stubs (12 files)
│   ├── ambience/                   # Ambience WAV stubs (8 files)
│   └── sfx/                        # SFX WAV stubs (26 files)
└── scripts/
    ├── generate-bgm.mts            # ElevenLabs BGM generation
    ├── generate-sfx.mts            # ElevenLabs SFX + ambience generation
    ├── sfx-pregen.mts              # Procedural fallback (chiptune)
    └── music-pregen.mts            # Procedural fallback (noir loop)
```
