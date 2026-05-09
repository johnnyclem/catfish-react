---
confidence: 0.95
sources: [catfish/catfishApp.swift, catfish/RootView.swift, catfish/Core/]
last-confirmed: 2026-04-26
status: active
---

# Architecture Overview

Catfish is a SwiftUI + SwiftData iOS 17+ game built with an MVVM-lite architecture.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | SwiftUI (iOS 17+) |
| Persistence | SwiftData (`@Model`) |
| State | `@Observable` macro |
| Concurrency | `@MainActor` for all mutations |
| Audio | AVFoundation via `AudioEngine` |
| Voice TTS | Cloudflare Worker (on-demand) |
| Future scenes | SpriteKit (not yet imported) |

## Directory Structure

```
catfish/
├── catfishApp.swift          # App entry, SwiftData container setup
├── RootView.swift            # Root navigation router
├── ContentView.swift         # Placeholder / debug view
├── Core/
│   ├── Models/               # SwiftData @Model classes
│   │   ├── CaseRun.swift
│   │   ├── CharacterID.swift
│   │   ├── ChatThread.swift
│   │   ├── DateModeModels.swift
│   │   ├── KillerIdentity.swift
│   │   ├── MatchRelationship.swift
│   │   └── VoicePlayer.swift
│   ├── GameState.swift       # @Observable central game clock
│   ├── KillerImplementations.swift
│   └── Narrative/            # HookCatalog, NarrativeHook, HookRouter
├── Features/
│   ├── Swipe/                # SwipeDeck, SwipeCard, SwipeView
│   ├── Date/                 # DateDirector, DateSceneView, DateMode
│   ├── PhoneOS/              # PhoneShell, HomeScreen, StatusBar
│   ├── Apps/                 # Arcade games, LotsOFish
│   └── EastworldVoiceService.swift
├── DesignSystem/             # CFColor, CFFont, PhoneTheme, Theme
├── Audio/                    # AudioEngine, AudioCatalog, VoiceManifest
├── Cloudflare/               # voice-worker.js
├── Scripts/                  # Python build/audit scripts
└── Resources/                # Assets, voice manifests, JSON content
```

## Key Patterns

- **@Observable over ObservableObject** — No Combine. All view models use the Swift 5.9 observation macro.
- **JSONEncoder for complex payloads** — SwiftData can't store enums with associated values directly. Encode to `Data`.
- **AssetImage** — Custom view that shows a labeled placeholder when an asset isn't in the catalog yet.
- **Player-paced day model** — `GameState.advanceDay()` is called explicitly, no real-time clock.
- **Killer stamped at run start** — `CaseRun` gets a `KillerIdentity` that's immutable for the run's lifetime.

## Data Flow

```
catfishApp (SwiftData container)
  → RootView (routes based on game state)
    → PhoneShell (meta-UI metaphor)
      → Feature views (Swipe, Date, Apps, etc.)
        → Core models (persisted via SwiftData)
          → GameState (in-memory clock + run lifecycle)
```

## Related Pages

- [[features/swipe]] — Swipe feature details
- [[features/date-mode]] — Date mode orchestration
- [[features/phone-os]] — PhoneOS meta-UI
- [[decisions/player-paced-days]] — Day model ADR
- [[architecture/data-models]] — SwiftData model details
