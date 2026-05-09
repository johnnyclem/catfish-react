---
confidence: 0.9
sources: [catfish/Features/EastworldVoiceService.swift, catfish/Audio/, catfish/Cloudflare/]
last-confirmed: 2026-04-26
status: active
---

# Voice Pipeline

On-demand TTS via Cloudflare Worker with pre-generation for known lines.

## Components

| Component | Location |
|-----------|----------|
| Voice manifest + schema | `Resources/Voice/voice_manifest.json`, `.schema.json` |
| Pre-generation script | `Scripts/pregen_voice_lines.py` |
| Bundle audit for CI | `Scripts/audit_voice_bundle.py` |
| Runtime voice player | `Core/Models/VoicePlayer.swift` |
| Preload queue | `Features/VoicePreloadQueue.swift` |
| Eastworld voice service | `Features/EastworldVoiceService.swift` |
| Cloudflare Worker | `Cloudflare/voice-worker.js` |
| Audio engine | `Audio/AudioEngine.swift` |
| Audio catalog | `Audio/AudioCatalog.swift` |
| Voice manifest parser | `Audio/VoiceManifest.swift` |
| Date voice playback | `Features/Date/DateVoicePlayback.swift` |

## Architecture

1. **Known lines** are pre-generated at build time via `pregen_voice_lines.py`
2. **Dynamic lines** (Eastworld ambient dialogue) are generated on-demand via
   the Cloudflare Worker
3. `VoicePreloadQueue` manages loading voice clips before they're needed
4. `VoicePlayer` handles runtime AVFoundation playback
5. Cost guardrails documented in `Docs/voice_pipeline.md`

## Related Pages

- [[features/date-mode]] — Voice playback during dates
- [[architecture/overview]] — Full architecture
