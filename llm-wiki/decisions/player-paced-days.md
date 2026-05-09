---
confidence: 0.95
sources: [README.md, catfish/Core/GameState.swift]
last-confirmed: 2026-04-26
status: active
---

# ADR-001: Player-Paced Day Model

## Decision

Day advances via explicit `GameState.advanceDay()` call, not real-time clock.

## Rationale

- Game should be playable in a single 45-minute session or across a week
- No real-time gating prevents frustration and accommodates all play styles
- Explicit control makes testing deterministic

## Implications

- `GameState` is `@Observable` and `@MainActor`
- All day-dependent content checks go through `GameState.currentDay`
- Content scheduling (`ContentScheduler`) fires based on day number, not time

## Status

Locked. This decision is foundational to the game loop.
