---
confidence: 0.95
sources: [README.md, catfish/Core/Models/KillerIdentity.swift]
last-confirmed: 2026-04-26
status: active
---

# ADR-002: Killer Identity Stamped at Run Start

## Decision

`CaseRun` gets a `KillerIdentity` at creation that is immutable for the
entire run.

## Rationale

- Mid-run killer flip would invalidate every discovered fact's payload
- Clue graph schema depends on a fixed killer to resolve fact implications
- Player trust: changing the killer retroactively would feel unfair

## Implications

- 5 `KillerIdentity` implementations (only Miles has full content)
- Other four are compilable stubs with TODO narrative beats
- Fact payloads can safely encode killer-specific information

## Status

Locked. Fundamental to the clue/discovery system.
