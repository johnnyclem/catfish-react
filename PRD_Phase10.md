# Phase 10 — Journal Deduction System + Evidence Visualization

## Summary

Upgrade the ClueJournalView from a flat fact list to an interactive deduction board with fact linking, evidence chains, suspect elimination, and a guided accusation flow.

## Motivation

The current journal shows discovered facts as a scrollable list grouped by day. There's no way for players to connect facts, build theories, or see which evidence points toward which suspect. The accusation flow is a raw character picker with no guidance. For beta, the journal needs to be the investigation hub — where players think, not just read.

## Deliverables

### 10.1 Suspect Board
- Top section: 5 suspect cards (portrait, name, status)
- Each suspect card shows: evidence count pointing toward them, evidence count clearing them
- Color coding: green (cleared), yellow (some evidence), red (strong evidence against)
- Tap suspect card → filter journal to facts about that character

### 10.2 Evidence Chain Builder
- Players can "link" two discovered facts to form an evidence chain
- Example: link "river_bootprint_size_swap" + "river_trailcam_blur" → "River's bootprint doesn't match the scene"
- Pre-authored chain definitions in content.json (~20 chains)
- When player links the right facts, chain "clicks" with visual/audio feedback
- Wrong links show "these facts don't connect" toast
- Chains contribute to suspect guilt/clear scores

### 10.3 Deduction Notes
- Player can type free-form notes attached to any fact
- Notes field already exists on `DiscoveredFact.playerNote` — just needs UI
- Notes visible on fact detail view
- Optional: auto-suggest connections based on shared character tags

### 10.4 Evidence Strength Indicator
- Pre-accusation screen shows: "Your case against [character]:"
  - Strong evidence: N facts pointing toward them
  - Contradictions: N facts that clear them
  - Unexplained: N facts that don't fit either way
- Visual: evidence bar (0-100% confidence)
- Warning if attempting accusation with <30% evidence: "Are you sure? You don't have much to go on."

### 10.5 Guided Accusation Flow
Replace the raw character picker with a 3-step flow:
1. **Review Evidence**: Show summary of all evidence chains built
2. **Name the Killer**: Character selection with evidence preview
3. **Present Your Case**: Player selects their top 3 evidence chains as "proof"
   - If chains match `solvingDeduction.requiredFactIDs`: "evidence verified"
   - If some match: "partial evidence"
   - If none match: "weak case" (can still accuse)

### 10.6 Fact Detail View
- Expand fact card to full-screen detail
- Shows: fact text, source (with icon), kind badge, day discovered
- Image viewer for facts with `imageAssetID`
- Linked facts (bidirectional)
- Player note field
- "Related facts" section: same character, same source, or same evidence chain

### 10.7 Journal App on Home Screen
- Add `AppID.journal` case to PhoneOSState
- Journal accessible as its own app (not just inside LotsOFish)
- Same content, different entry point (from home screen or from LotsOFish tab)

## Acceptance Criteria

1. Suspect board shows evidence counts per character
2. Evidence chains can be built by linking facts
3. Pre-accusation screen shows evidence strength
4. Guided accusation flow works end-to-end
5. Fact detail view shows all metadata + links
6. Journal accessible from home screen
7. Build succeeds, all tests pass

## Files to Modify

- `catfish/Features/Journal/ClueJournalView.swift` — major rewrite
- `catfish/Features/Journal/AccusationView.swift` — guided flow
- New: `catfish/Features/Journal/SuspectBoardView.swift`
- New: `catfish/Features/Journal/EvidenceChainBuilder.swift`
- New: `catfish/Features/Journal/FactDetailView.swift`
- `catfish/Core/Models/DiscoveredFact.swift` — add linked fact IDs
- `catfish/Core/Content/ContentSchema.swift` — evidence chain definitions
- `catfish/Resources/Content/content.json` — chain definitions
- `catfish/Features/PhoneOS/PhoneOSState.swift` — journal app ID
- `catfish/Features/PhoneOS/PhoneShell.swift` — journal routing

## Token Budget Estimate
~70K tokens (new views + content authoring)

## Dependencies
- Phase 3 (all facts authored — evidence chains reference them)
- Phase 7 (date-scene facts available for chains)
