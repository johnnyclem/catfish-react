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
- Immutable killer identity stamped at first match (5 killer stubs in `core/identities.ts`, Miles fleshed out)
- Swipe deck (`features/swipe/`) — 110pt drag-to-commit, right-swipe = match + celebration overlay
- DEBUG menus on both the title screen and the Profile tab — force killer, reset run
- Press Start 2P pixel font (`@expo-google-fonts/press-start-2p`)
- Neon palette in `constants/colors.ts` (#0a0420 navy, #ff2f8f pink, #22e0ff cyan, #7a3cff purple)
- 10 PNGs in `assets/images/` wired through `AssetImage` with labeled placeholder fallback
- UUIDs via `Date.now() + Math.random()` (no `uuid` package — that crashes on RN)

### Known limitation: Replit preview iframe

The `artifacts/catfish: expo` workflow currently fails the Replit port-readiness
check (`DIDNT_OPEN_A_PORT` on 21328) even though the dev server binds the port
correctly (verified via `/proc/net/tcp` and `curl localhost:21328`). The cause
is that this artifact's registry entry has a path-style ID
(`id = "artifacts/catfish"`) instead of a UUID, so port 21328 was never added
to the root `.replit` file's `[[ports]]` table. There is no agent-callable
mechanism to repair this — `verifyAndReplaceArtifactToml` validates the toml
but does not reallocate the port, and `createArtifact` rejects re-creation
because a mobile app already exists. The agent cannot edit `.replit` directly.

The app itself is fully functional — use **Expo Go** to scan the QR code in
the workflow logs (run `pnpm --filter @workspace/catfish run dev` in a shell)
and the React Native experience works as designed.
