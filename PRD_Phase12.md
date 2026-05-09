# Phase 12 — Audio: Music Authoring, SFX Bundle, Ambience Engine

## Summary

Author and integrate the full audio catalog: 12 BGM tracks, all SFX, 8 ambience loops, and voice line playback across all features. Wire the audio engine into every gameplay surface.

## Motivation

`AudioCatalog` defines 12 BGM tracks, 22 UI SFX, 11 diegetic SFX, 4 narrative SFX, and 8 ambience loops — but none of these assets actually exist in the bundle. The `AudioEngine` gracefully handles missing assets by logging and skipping, meaning the entire game is currently silent. Audio is critical for atmosphere: the phone OS metaphor, date tension, arcade energy, and investigation ambiance all depend on sound.

## Deliverables

### 12.1 BGM Tracks
Author or source 12 background music tracks:

| ID | Context | Style |
|----|---------|-------|
| `bgm_main_theme` | Title screen | Lo-fi suspense, 90s synth |
| `bgm_phone_os` | PhoneShell home | Chill idle, minimal |
| `bgm_swipe` | Swipe/Discover | Playful, dating-app vibes |
| `bgm_chat` | Messaging | Soft ambient, notification-friendly |
| `bgm_date_coffee` | Coffee shop date | Warm, acoustic |
| `bgm_date_restaurant` | Restaurant date | Elegant, slightly tense |
| `bgm_date_park` | Park date | Open, gentle, nature textures |
| `bgm_date_bar` | Bar date | Upbeat, crowded energy |
| `bgm_date_apartment` | Apartment date | Intimate, minimal, quiet |
| `bgm_arcade_wordlow` | WordLow game | Puzzle tension |
| `bgm_arcade_ego_trip` | EgoTrip game | Fast-paced, energetic |
| `bgm_arcade_general` | SugarCoat/SafeSpot | Casual arcade loop |

All tracks: loopable, 16-bit inspired, 44.1kHz, AAC or MP3, ~2-4MB total.

### 12.2 UI Sound Effects
Author/source 22 UI SFX:

| Category | SFX | Description |
|----------|-----|-------------|
| Swipe | `swipe_left`, `swipe_right` | Quick whoosh |
| Match | `match_celebration`, `match_first_message_tone` | Celebration chime |
| Navigation | `tab_switch`, `app_open`, `app_close`, `back_button` | Click/tap sounds |
| Journal | `fact_discover`, `evidence_link` | Discovery chime, click |
| Accusation | `accusation_correct`, `accusation_wrong` | Triumph, failure |
| Day | `day_advance`, `level_complete_day_advance` | Transition sting |
| Phone | `phone_buzz`, `notification_chime` | Vibration, ding |
| Chat | `message_send`, `message_receive` | Send whoosh, receive ding |

All SFX: short (<1s), 44.1kHz, AAC, ~500KB total.

### 12.3 Diegetic & Narrative SFX
- 11 diegetic SFX (phone buzz, traffic, coffee shop ambient, etc.)
- 4 narrative SFX (saint mask tone, focus shift sting, etc.)

### 12.4 Ambience Loops
8 ambience loops matching date scene locations:
- `amb_coffee_shop`, `amb_restaurant`, `amb_park`, `amb_bar`
- `amb_apartment`, `amb_alley`, `amb_hospital`, `amb_killer_reveal`

### 12.5 Audio Integration Across Features
Wire `AudioEngine` calls into every feature:

**PhoneShell**: `bgm_phone_os` on home, crossfade on app transitions
**SwipeView**: `bgm_swipe` + swipe/match SFX
**ChatView**: `bgm_chat` + message send/receive SFX
**DateSceneView**: Scene-specific BGM + ambience, voice playback, focus shift sting
**Arcade games**: Game-specific BGM + game SFX
**Journal**: `fact_discover` on new fact, `evidence_link` on chain creation
**Accusation**: `accusation_correct` / `accusation_wrong`
**RootView**: `bgm_main_theme` on title, `day_advance` sting on day change

### 12.6 Settings Integration
- Wire settings volume sliders to `AudioEngine` buses
- Mute toggle immediately silences all buses
- Settings persist via UserDefaults

## Acceptance Criteria

1. All 12 BGM tracks play in correct contexts
2. All SFX trigger at appropriate moments
3. Ambience loops play during date scenes
4. Volume controls in settings work in real-time
5. Crossfade between BGM tracks is smooth (<1s)
6. Voice ducking works (BGM/ambience lower during voice playback)
7. Total audio bundle < 15MB
8. Build succeeds, all tests pass

## Files to Modify

- New: `catfish/Resources/Audio/BGM/*.mp3` — 12 tracks
- New: `catfish/Resources/Audio/SFX/*.mp3` — 37 SFX
- New: `catfish/Resources/Audio/Ambience/*.mp3` — 8 loops
- `catfish/Features/Swipe/SwipeView.swift` — SFX integration
- `catfish/Features/Apps/LotsOFish/ChatView.swift` — SFX integration
- `catfish/Features/Date/DateSceneView.swift` — BGM/ambience wiring
- `catfish/Features/Apps/Arcade/*/` — all 4 games get audio
- `catfish/Features/Journal/ClueJournalView.swift` — discovery SFX
- `catfish/Features/Journal/AccusationView.swift` — result SFX
- `catfish/Features/PhoneOS/PhoneShell.swift` — home BGM, transitions
- `catfish/RootView.swift` — title BGM, day advance sting

## Token Budget Estimate
~55K tokens (mostly asset sourcing/integration, moderate code)

## Dependencies
- Phase 4, 5 (arcade games need to exist to add audio)
- Phase 7 (date scenes need BGM/ambience)
- Phase 11 (settings screen for volume controls)
