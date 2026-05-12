# Changelog

## 2026-05-12 — Phase 12 Audio: SFX Wiring + ElevenLabs Scripts + Voice Ducking

Completed the remaining Phase 12 audio pipeline across all game surfaces.

### SFX Wiring (5 files)
- **home.tsx**: `app_open` on mount, `app_close` on unmount, `back_button` on HomeIndicator press
- **EvidenceChainBuilder.tsx**: Changed `emitSfx("accuse")` → `emitSfx("evidence_link")` on successful chain link
- **EndOfRunCard.tsx**: Added `accusation_correct`/`accusation_wrong` alongside existing `win`/`lose` on ending card
- **ThreadView.tsx**: `message_send` after reply, `message_receive` on new suspect messages, `back_button` on back nav
- **LotsOfFishApp.tsx**: `tab_switch` on tab press

### ElevenLabs Generation Scripts (2 new files)
- `scripts/generate-bgm.mts` — 12 BGM tracks via ElevenLabs Music API (`pnpm bgm:gen`)
- `scripts/generate-sfx.mts` — 19 SFX + 8 ambience loops via Sound Effects API (`pnpm sfx:gen`)
- Both use hash sidecars (`audio-music-hashes.json`, `audio-sfx-hashes.json`, `audio-ambience-hashes.json`) for idempotency
- Output MP3/WAV to respective asset directories
- Added `package.json` script entries

### Voice Ducking
- **useDialogueVoice.ts**: Integrated `audioDuckRef` from AudioProvider
  - `duck()` when playback starts (playingRef false→true)
  - `unduck()` when queue drains (playingRef true→false), on playback error, on mute toggle, and on `stop()`
  - Removed `playingRef = false` from `didJustFinish` effect so `playNext()` correctly detects queue-empty transitions

### Type Fix (1 file)
- **PixelSlider.tsx**: Fixed `cfPalette.white` → `cfPalette.bone` (pre-existing type error)

### Uncanny
- `swipe_right` still shares asset with `swipe_like` in sfxManifest — ElevenLabs gen script has a separate `swipe_right` prompt but the manifest alias should be updated to point to the new dedicated file after generation

### Still Unwired
- `notification_chime` — no trigger point yet (should fire when a suspect message arrives while the player is NOT in the thread; best handled in matches screen or thread level)
- `phone_buzz` — no trigger point yet

### Key Design Notes for Phase 13
- BGM BgmName values in `bgmManifest.ts` use underscore names (`bgm_swipe`, `bgm_chat`, etc.) — the `resolveBgm()` in AudioProvider maps phone shell apps to these. The ElevenLabs gen script outputs `bgm_*.mp3` matching the manifest keys
- AudioProvider crossfades between BGM tracks (fade-out slot A + fade-in slot B over ~320ms)
- Duck factor = 0.3 (BGM/ambience drops to 30% during TTS)
- `generate-bgm.mts` and `generate-sfx.mts` are author-time scripts (not bundled) — run manually before production builds
- The procedural `sfx-pregen.mts` / `music-pregen.mts` still exist as fallback; ElevenLabs scripts are the real-audio pipeline
