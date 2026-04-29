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

### Audio (Pass 1.1)

Three independent channels — voice (existing ElevenLabs flow) plus new music + SFX — each persisted as a separate `*_muted` boolean in `gameStore.ts` (`catfish/prefs/{voice,sfx,music}_muted/v1`) and toggled from the Profile tab via three side-by-side cells (`voice-mute-toggle` / `sfx-mute-toggle` / `music-mute-toggle`).

- `features/audio/AudioProvider.tsx` — single root mount inside `<GestureHandlerRootView>`. Owns one looping `useAudioPlayer` for the noir pad loop plus a fixed 4-voice SFX pool. Music starts immediately on native; on web it waits for the first user gesture (any `emitSfx` call) and retries `play()` on every subsequent SFX in case the first attempt was autoplay-blocked. In `__DEV__` only, exposes `window.__catfishAudio` with live state for the e2e test agent.
- `features/audio/audioEvents.ts` — pub-sub bus so the store/helpers can fire `emitSfx(name)` without depending on `expo-audio`.
- `features/audio/sfxManifest.ts` — Metro `require()` map for the 8 chiptune WAVs and the music loop.
- Assets generated by `scripts/sfx-pregen.mts` and `scripts/music-pregen.mts` (run via `pnpm run sfx:pregen` / `pnpm run music:pregen`); both are deterministic so re-runs produce byte-identical files. Outputs land in `assets/audio/sfx/*.wav` and `assets/audio/music/noir_loop.wav`.
- Wiring sites: `SwipeView.handleCommit` (`swipe_like` / `swipe_pass`, fired only after the store accepts the swipe), `SwipeView` day-change effect (`day_end`, keyed off `{runId, day}` so a fresh case doesn't false-trigger on day 1), `MatchCelebration` mount (`match`), `MessageFactGesture.handleCapture` (`fact_filed`), `AccusationSheet.submit` (`accuse`), `EndOfRunCard` ending effect (`win` for `caughtThem`, `lose` otherwise).

### Parody mini-game persistence (Task #44)

Each parody game (WordLow / SafeSpot / EgoTrip / SugarCoat) saves its in-progress run so a crash or quick app-switch doesn't wipe the player's progress. State lives under one AsyncStorage row (`catfish/prefs/parody-session/v1`) and is *independent* from the existing `parody` high-score row — long writes on one chain can't stall the other.

- `core/parodySessions.ts` — typed snapshot shapes (`SafeSpotSession`, `EgoTripSession`, `SugarCoatSession`), `ParodySessions` aggregate, `EMPTY_PARODY_SESSIONS`, `todayDateKey()` (local-time `YYYY-MM-DD`), `isSameLocalDay`, and defensive parsers (`parseSafeSpotSession` / `parseEgoTripSession` / `parseSugarCoatSession` / `parseParodySessions`). Parsers drop any snapshot whose `dateKey` isn't today — same-day gating per the task spec. `wordLowStreak` is intentionally *not* date-gated: a win streak is a continuous achievement, not a half-finished run, and the spec says it must survive across reloads until a loss resets it.
- `core/gameStore.ts` — added a `parodySessions` slice plus four actions: `setWordLowStreak(n)`, `saveSafeSpotSession(snap | null)`, `saveEgoTripSession(snap | null)`, `saveSugarCoatSession(snap | null)`. Each updates memory synchronously (UI never lags the disk) and queues onto `parodySessionWriteChain` (separate from `parodyWriteChain`) for serialized AsyncStorage writes. Hydrate loads the row in parallel with the existing prefs.
- `WordLow.tsx` — seeds `streakRef` once from the persisted streak on mount; persists via `setWordLowStreak()` on win (+1) and loss (reset 0). The win-overlay reads from a mirrored `streakDisplay` state so it never flashes the pre-bump value.
- `SafeSpot.tsx` — snapshots on each defender placement and each wave milestone (coarse triggers — not per 100ms tick — so AsyncStorage isn't hammered). The READY card shows a `RESUME · WAVE N` button when a same-day snapshot exists; `FRESH START` clears it. Game-over voids the snapshot. Resume rebuilds defenders + sanity + pom + wave + waveTick; enemies/projectiles intentionally start empty (no ambush on resume).
- `EgoTrip.tsx` — snapshots on each pillar passed (the only progress unit). READY card adds `RESUME · {score}` / `FRESH START` buttons when a same-day snapshot exists; tap-to-flap is suppressed while the buttons are shown. Crash clears the snapshot. Resume preloads the score; bird Y/velocity start fresh mid-field (a teleporting bird would feel worse than a clean reset).
- `SugarCoat.tsx` — silently restores the same-day board/score/moves on mount (no READY phase). Snapshots after each *settled* swap (post-cascade, via the existing 180ms resolve boundary using a `boardRef` mirror); skips no-op swaps. Game-over and Replay both clear the snapshot.
- `pnpm --filter @workspace/catfish test:parody-session` — exercises hydrate's date gate (stale snapshots dropped, WordLow streak preserved), same-day round-trip for all three game snapshots, the independent write chains, the serialized session-save chain, sibling-clear isolation, and a regression check that `recordParodyScore` still updates memory synchronously.

### Expo SDK version drift

`scripts/check-expo-versions.mjs` runs as part of `pnpm --filter @workspace/catfish run dev`
and refuses to start the dev server when any installed Expo package falls
outside the band the SDK expects. To re-run the check on demand and fix any
drift:

1. `pnpm --filter @workspace/catfish exec expo install --check` — list any
   mismatches.
2. `pnpm --filter @workspace/catfish exec expo install --fix` — pin each
   mismatched package to the SDK-recommended version.
   - The workspace pnpm config sets `minimumReleaseAge: 1440` (24h
     embargo on brand-new releases). If `--fix` errors with
     `ERR_PNPM_NO_MATURE_MATCHING_VERSION`, append the embargo bypass for
     this one install only (scoped to the catfish package), e.g.:
     `pnpm --filter @workspace/catfish --config.minimumReleaseAge=0 add -D expo@~X.Y.Z ...`
     for devDependencies (the bulk of `expo-*` packages live there) and the
     same flag without `-D` for runtime dependencies.
3. Commit the resulting `package.json` / `pnpm-lock.yaml` changes.

Do NOT set `SKIP_EXPO_VERSION_CHECK=1` (or the matching `SKIP_EXPO_DOCTOR=1`)
in `.replit-artifact/artifact.toml` to paper over a real mismatch — the dev
server runs both gates green by default and the env-var bypass exists only
for CI/e2e flows that host the prebuilt web bundle.

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
