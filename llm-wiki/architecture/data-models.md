---
confidence: 0.95
sources: [catfish/Core/Models/, catfish/Core/Content/RunBootstrapper.swift, catfish/Core/GameState.swift]
last-confirmed: 2026-04-30
status: active
---

# Data Models

All SwiftData models live in `catfish/Core/Models/`. They use `@Model` with
`JSONEncoder` for complex enum payloads.

## Core Models

### CaseRun
Represents a single playthrough. Contains:
- Day counter (player-paced)
- Killer identity (stamped at creation, immutable)
- Run state / progress tracking
- Journal notification state (`journalLastSeenClueCount`) for unread clue badge behavior

### CharacterID
Enum identifying the five suspect characters. Used across all models as a
foreign-key-like reference.

### KillerIdentity
Protocol + 5 implementations (only Miles has full content). Each implementation
defines the narrative beats, clue payloads, and behavioral patterns for when
that character is the killer.

### MatchRelationship
Created when the player right-swipes a profile. Persists across app launches.
Links a `CharacterID` to the current `CaseRun`.

### ChatThread
Stub for Pass 2. Will hold scripted + Eastworld chat messages per match.

### DateModeModels
`DateScene` (Codable) with beat variants: `scripted`, `eastworld`, `choice`,
`focusShift`, `factReveal`, `end`. Used by `DateDirector`.

### VoicePlayer
Runtime audio wrapper for playing TTS voice lines.

## Encoding Convention

Enums with associated values are encoded to `Data` via `JSONEncoder`:

```swift
// Example pattern
@Attribute(.transformable(by: JSONValueTransformer()))
var payload: Data
```

This keeps the schema portable and avoids SwiftData's limitations with complex
enum types.

## Related Pages

- [[architecture/overview]] — Full architecture
- [[decisions/killer-stamped-at-start]] — Why killer identity is immutable
- [[features/date-mode]] — DateModeModels usage
