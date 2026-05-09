---
confidence: 0.9
sources: [catfish/Features/Date/, docs/date-mode-prd-v0.1.md]
last-confirmed: 2026-04-26
status: active
---

# Date Mode

Interactive date scenes with scripted beats, Eastworld ambient dialogue, and
player choices.

## Components

| File | Role |
|------|------|
| `Features/Date/DateMode.swift` | Feature entry point / state |
| `Features/Date/DateDirector.swift` | Async state-machine orchestrator |
| `Features/Date/DateSceneView.swift` | SwiftUI rendering of scenes |
| `Features/Date/DateScene.swift` | Scene definitions |
| `Features/Date/DateVoicePlayback.swift` | Voice line playback during dates |
| `Core/Models/DateModeModels.swift` | Codable DateScene schema |

## Beat Types

The `DateScene` supports these beat variants:

| Beat | Description |
|------|------------|
| `scripted` | Pre-authored dialogue line |
| `eastworld` | AI-generated ambient turn |
| `choice` | Player branching decision |
| `focusShift` | Camera/attention shift moment |
| `factReveal` | Clue discovery side effect |
| `end` | Scene termination |

## DateDirector Features

- Async state-machine with scripted playback and choice branching
- Scripted-clue interception (skip next ambient beat on clue-tagged choices)
- Affinity updates and fact reveal side effects via persistence hooks
- Checkpoint save/restore for crash recoverability
- Eastworld timeout fallback lines to preserve pacing

## Status

Scaffolded. Demo scene runs with scripted + ambient hybrid. Not yet connected
to real Eastworld API or SpriteKit rendering.

## Related Pages

- [[features/voice-pipeline]] — Eastworld TTS integration
- [[architecture/data-models]] — DateModeModels schema
- [[decisions/hybrid-swiftui-spritekit]] — Future SpriteKit migration
