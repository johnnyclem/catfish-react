# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/catfish run dev` — run the Catfish Expo dev server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Catfish (mobile app)

Pixel-art dating-detective game. Pass 1 of 7 implemented:

- 4-tab shell (Swipe / Matches / Journal / Profile) with custom pixel chrome
- Persistent CaseRun state in `core/gameStore.ts` (Zustand + AsyncStorage, JSON-encoded). `useGameHydration()` is mounted once in the root layout to rehydrate on cold start.
- Immutable killer identity stamped at first match (6 killers in `core/identities.ts` — Miles and Jules fully authored, four others are stubs)
- Swipe deck (`features/swipe/`) — 110pt drag-to-commit, right-swipe = match + celebration overlay. Each killer's deck is 1 killer + 4 decoys; decoys come from the shared NPC pool in `core/decoyPool.ts` (10 personas Lola/Ari/Onyx/Micah/Sienna/Eli/Penny/Cam/Zora/Reyn backed by portraits A085–A094). `decoysForKiller(identity)` picks 4 unique entries deterministically per killer (FNV-1a seeded Fisher-Yates) so the cast varies between killers but stays stable across reloads of the same run.
- DEBUG menus on both the title screen and the Profile tab — force killer, reset run
- Press Start 2P pixel font (`@expo-google-fonts/press-start-2p`)
- Neon palette in `constants/colors.ts` (#0a0420 navy, #ff2f8f pink, #22e0ff cyan, #7a3cff purple)
- 10 PNGs in `assets/images/` wired through `AssetImage` with labeled placeholder fallback
- UUIDs via `Date.now() + Math.random()` (no `uuid` package — that crashes on RN)

### Clue Graph (Pass 4)

Three-layer fact model — `static | variable | conditional` authored facts (in `core/factUniverse.json`) plus `captured` facts surfaced by the player long-pressing chat messages:

- `core/factBootstrap.ts` — `buildAuthoredFacts(runId, killer)` materializes the per-run authored set on `startNewRun`. Conditional facts are gated by the killer's `conditionalFactIDs`; variable facts swap payloads via `variableOverrides` (the doc's "double-blind tell").
- `core/identities.ts` — every `IdentityModule` carries `conditionalFactIDs / variableOverrides / solvingDeduction / redHerrings`. Miles is the fully-authored worked example with a 4-fact deduction; Jules has the matching 4-fact deduction and overrides for the worked example's mirror; the other 6 killers use the `stubGraph()` helper for a single-fact placeholder deduction.
- `core/accusation.ts` — pure `resolveAccusation({accused, run, discoveredFactIds, outcome?})` covers all four `CaseEnding`s (`caughtThem` / `wrongfulAccusation` / `metKillerStub` / `escapedStub`). `discoveredFactIds` is a set of authoring keys (e.g. `"miles_bio_downtown_view"`), not the random per-row `Fact.id`.
- `core/gameStore.ts` — `commitFact` populates the new typed fields (`kind: "captured"`, `source`, `day`, `aboutCharacter`, `payload`) alongside the legacy `payloadJson` / `captured*` breadcrumbs. `migrateRun` backfills these for pre-Pass-4 persisted runs without retroactively injecting authored facts.
- `pnpm --filter @workspace/catfish test:clue-graph` — verifies bootstrapper inclusion rules, double-blind variable swap, `commitFact` shape, all four endings, and the legacy migration round-trip.

### Replit preview iframe

The `artifacts/catfish: expo` workflow runs Metro on local port `8000`, which
is mapped to external port `3000` via the `[[ports]]` table in the root
`.replit` file. The dev wrapper (`scripts/dev.mjs`) launches `expo start` with
the default LAN binding (no `--localhost`) so the platform's port-readiness
probe can reach Metro from the proxy. The artifact still uses the
`expo-domain` router, so Expo Go users continue to scan the QR code at
`$REPLIT_EXPO_DEV_DOMAIN`, while the workspace iframe loads the web build at
`/`.

If the preview ever breaks again with `DIDNT_OPEN_A_PORT`, check that:
1. `scripts/dev.mjs` is NOT passing `--localhost` (that flag restricts Metro
   to 127.0.0.1, which the readiness probe cannot reach).
2. `.replit` still contains the `[[ports]]` entry for `localPort = 8000`.
   If that entry is missing, the readiness probe will never see the port open
   even though Metro is listening.
3. `artifact.toml` still pins `localPort = 8000` and `PORT = "8000"`.
