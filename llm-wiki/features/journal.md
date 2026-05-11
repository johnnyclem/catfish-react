---
confidence: 0.95
sources: [artifacts/catfish/features/journal/JournalScreen.tsx, artifacts/catfish/features/journal/FactCard.tsx, artifacts/catfish/features/journal/SuspectGroup.tsx, artifacts/catfish/core/factBootstrap.ts, artifacts/catfish/core/models.ts]
last-confirmed: 2026-05-09
status: active
---

# Journal Feature

The Journal surfaces committed Facts (both player-captured and world-authored) in a per-suspect layout with filter/sort controls and an accusation entry point.

## Components

| File | Role |
|------|------|
| `features/journal/JournalScreen.tsx` | Main screen: authored section + captured-grouped section + summary stats + accusation button |
| `features/journal/FactCard.tsx` | Unified card rendering: authored (auto-logged, no discard) vs captured (player-extracted, ✕ discard chip) |
| `features/journal/SuspectGroup.tsx` | Header (portrait + name + fact count) + stack of FactCards for one candidate |
| `features/journal/JournalControls.tsx` | Horizontal suspect filter chips + sort toggle (newest/byDay) |
| `features/journal/EmptyState.tsx` | Empty state when no matches or no facts captured yet |
| `features/journal/UndoDiscardBanner.tsx` | Undo toast for the most recently discarded captured fact |
| `features/accusation/AccusationSheet.tsx` | Bottom-sheet accuse modal — shown when player taps "Accuse A Suspect" |

## Two-Class Fact System (P2)

`CaseRun.facts` holds two distinct classes of committed Facts:

**Authored Facts** (kinds: `static`, `variable`, `conditional`)
- Materialized by `buildAuthoredFacts()` at `startNewRun`
- Pre-committed world-logged facts — no player action required
- Rendered in a flat chronological section at the top of the Journal screen
- Each `FactCard` shows: day stamp, source badge (bio/IG/portrait expression/dev/friend/chat/narration), `payload.text`
- No discard affordance — world-logged facts are permanent evidence

**Captured Facts** (kind: `captured`)
- Extracted from chat messages via long-press gesture in ThreadView
- Belong to exactly one suspect (via `capturedFromCandidateId`)
- Grouped into `SuspectGroup` sections (same as original Journal behavior)
- `FactCard` shows: day stamp, `capturedQuote`, `✕` discard chip
- Discardable — `removeFact(factId)` called on ✕ tap

## FactCard Content Logic

```
fact.kind === "captured"
  → show capturedQuote (from long-press gesture), day from capturedOnDay, ✕ discard chip
  → SourceBadge: not shown (chat origin is implied by location in Journal)
fact.kind !== "captured"
  → show payload.text (from factUniverse.json), day from fact.day, SourceBadge
  → no discard chip
```

## Summary Strip

Three-column stat panel:
- **captured** — count of `kind === "captured"` committed facts
- **authored** — count of committed facts where `kind !== "captured"`
- **suspects** — number of `SuspectGroup` sections (captured-only suspects, since authored facts have no per-candidate grouping)

## Filtering & Sorting

`JournalControls` (suspect filter chips + sort pills) appear below the summary only when captured facts exist. Authored facts are shown in their own unpaginated section above the controls and are always fully visible.

Filter: clicking a suspect chip narrows `SuspectGroup` rows to that candidate. Clicking active chip or "All" clears filter.

Sort modes:
- `newest` — sort groups by most-recent `capturedAt`, facts within groups by `capturedAt` descending
- `byDay` — sort groups by `capturedOnDay` ascending, facts within groups by `capturedOnDay` ascending

## Risk Meter (SuspectBoardScreen)

`SuspectBoardScreen` computes risk per candidate from committed fact counts:
- 0 facts → `???` (iron gray)
- 1–2 facts → `low` (cyan)
- 3–5 facts → `elevated` (cyanHot)
- 6+ facts → `high` (redHot)

Killer candidate card has red border + "suspect" badge (`isKillerCandidate: true`).

## State Dependencies

- `committed = run.facts.filter(f => f.committed)` — all committed facts from active run
- `authoredFacts = committed.filter(f => f.kind !== "captured")` — authored subset
- `capturedFacts = committed.filter(f => f.kind === "captured")` — captured subset
- `buildAuthoredFacts(runId, killer)` from `factBootstrap.ts` — produces the authored fact set at run start with `variableOverrides` already applied per killer identity

## Related Pages

- [[features/phone-os]] — Phone shell + app routing
- [[architecture/data-models]] — Fact model schema
- [[decisions/journal-commit-contract]] — Why facts require explicit journal commit