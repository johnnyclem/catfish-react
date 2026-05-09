---
confidence: 0.9
sources: [README.md]
last-confirmed: 2026-04-26
status: active
---

# ADR-004: Hybrid SwiftUI / SpriteKit

## Decision

SwiftUI for all chrome, chat, and UI. SpriteKit for Date mode scene rendering.

## Rationale

- SwiftUI handles forms, lists, navigation natively
- Date scenes need richer visual rendering (character sprites, environments)
- SpriteKit can be embedded in SwiftUI via `SpriteView`

## Status

Locked. SwiftUI is in use. SpriteKit is not yet imported — Date mode currently
uses a SwiftUI scaffold that will be swapped later.

## Migration Path

When SpriteKit is added (Pass 7), `DateSceneView` will wrap a `SpriteView`
instead of rendering SwiftUI directly. The `DateDirector` state machine stays
the same — only the rendering layer changes.
