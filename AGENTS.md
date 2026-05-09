# AGENTS.md — Catfish Project Schema & Wiki Conventions

This file is the single source of truth for how AI agents work on the Catfish
codebase. Every agent (opencode, Claude, Copilot, etc.) must read this file
before making changes. It encodes project conventions, wiki operations, and
quality standards.

---

## Project Overview

Catfish is a SwiftUI + SwiftData iOS 17+ mobile game — a dating-app-meets-
murder-mystery. The player swipes through suspect profiles, matches with them,
goes on "dates" (interactive scenes), and eventually accuses the killer.

- **Language**: Swift 5.9+, SwiftUI, SwiftData, SpriteKit (future)
- **Min target**: iOS 17
- **Architecture**: MVVM-lite with `@Observable` + SwiftData persistence
- **Concurrency**: `@MainActor` for all GameState and SwiftData mutations

---

## LLM Wiki

The project maintains a living knowledge base at `llm-wiki/`. This is how
agents accumulate and share knowledge across sessions without re-deriving
everything from scratch.

### Directory Layout

```
llm-wiki/
├── index.md              # Catalog of every wiki page (auto-updated)
├── architecture/          # System design, data models, state management
├── features/              # Feature-specific pages (Swipe, Date, PhoneOS, etc.)
├── decisions/             # ADRs and locked-in design decisions
├── gotchas/               # Bugs found, workarounds, sharp edges
├── _templates/            # Page templates for new entries
└── _activity/             # Session logs and changelog
```

### Operations

#### Ingest (`wiki-ingest`)
When you learn something new about the project that isn't in the wiki yet:
1. Check if a relevant page already exists via `index.md`.
2. If yes, update it. If no, create a new page using the appropriate template.
3. Add metadata: `confidence`, `sources`, `last-confirmed`, `supersedes`.
4. Update `index.md` with the new or changed entry.

#### Query (`wiki-query`)
When you need project knowledge:
1. Check `index.md` for the most relevant page.
2. Read the page. Follow wikilinks to related pages.
3. If the knowledge is stale or missing, note it for later ingestion.

#### Lint (`wiki-lint`)
Periodically (or after significant changes):
1. Check every page has metadata (confidence, sources, last-confirmed).
2. Find orphan pages not listed in `index.md`.
3. Find broken wikilinks.
4. Flag contradictions between pages.
5. Mark stale entries (not confirmed in >30 days).

### Page Metadata Convention

Every wiki page must include this frontmatter block at the top:

```
---
confidence: 0.0–1.0
sources: [list of files, docs, or sessions]
last-confirmed: YYYY-MM-DD
supersedes: [optional — page this replaces]
status: active | stale | deprecated
---
```

### Confidence Scoring

- `0.9–1.0` — Confirmed by multiple sources or direct code inspection
- `0.7–0.89` — Single strong source or verified by one session
- `0.4–0.69` — Inferred or partially verified
- `0.0–0.39` — Unverified claim or speculation

Confidence decays over time. Re-verification resets the clock.

### When to Create a Page

- You discovered a non-obvious pattern or gotcha
- You made an architectural decision worth recording
- You spent time figuring out how a subsystem works
- You resolved a confusing bug
- You onboarding-knowledge that the next agent will need

### When NOT to Create a Page

- The information is trivially available from reading one file
- It's a temporary debugging note (use `_activity/` for that)
- It duplicates existing wiki content

### Session Workflow

1. **Session start**: Read `AGENTS.md` → scan `llm-wiki/index.md` → load
   relevant pages for the task at hand.
2. **During work**: Ingest new knowledge as you discover it. Update existing
   pages when you confirm or contradict them.
3. **Session end**: Append a summary to `_activity/changelog.md` with what
   you did, what you learned, and what's still uncertain.

---

## Code Conventions

### File Organization
- App entry: `catfish/catfishApp.swift`, `catfish/RootView.swift`
- Core models: `catfish/Core/Models/`
- Feature modules: `catfish/Features/<FeatureName>/`
- Design system: `catfish/DesignSystem/`
- Audio: `catfish/Audio/`
- Scripts: `catfish/Scripts/`

### Swift Style
- Use `@Observable` macro (not ObservableObject/Combine)
- All SwiftData mutations on `@MainActor`
- Complex enum payloads → encode to `Data` via `JSONEncoder` for SwiftData
- Use `AssetImage` for all asset references (graceful placeholder fallback)
- No comments unless explicitly requested
- Follow existing naming patterns in each directory

### SwiftData Models
- Encode associated-value enums into `Data` properties
- Models live in `Core/Models/`
- Use `@Model` macro with explicit `@Attribute` annotations

### Testing
- Test target: `catfishTests/`
- UI test target: `catfishUITests/`

---

## Build & Run

```bash
# Build from CLI (if needed)
xcodebuild -project catfish.xcodeproj -scheme catfish \
  -destination 'platform=iOS Simulator,name=iPhone 16' build

# Run tests
xcodebuild test -project catfish.xcodeproj -scheme catfish \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

Or use the xcsift MCP tools: `xcsift_mcp_xcodebuild` / `xcsift_mcp_swift_build`.

---

## Key Design Decisions (Locked)

See `llm-wiki/decisions/` for full ADRs. Summary:

1. **Player-paced day model** — Day advances via `GameState.advanceDay()`, not
   real-time clock. Playable in one session or across a week.
2. **KillerIdentity stamped at run start, immutable** — Mid-run flip would
   invalidate all discovered fact payloads.
3. **Journal commit = discovery contract** — Facts must be logged to count.
4. **Hybrid SwiftUI / SpriteKit** — SwiftUI for chrome/chat; SpriteKit for
   Date mode scenes (not yet imported).
5. **Voice pipeline via Cloudflare Worker** — On-demand Eastworld TTS with
   pre-generation for known lines.
