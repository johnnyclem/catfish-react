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
- Swipe deck (`features/swipe/`) — 110pt drag-to-commit, right-swipe = match + celebration overlay
- DEBUG menus on both the title screen and the Profile tab — force killer, reset run
- Press Start 2P pixel font (`@expo-google-fonts/press-start-2p`)
- Neon palette in `constants/colors.ts` (#0a0420 navy, #ff2f8f pink, #22e0ff cyan, #7a3cff purple)
- 10 PNGs in `assets/images/` wired through `AssetImage` with labeled placeholder fallback
- UUIDs via `Date.now() + Math.random()` (no `uuid` package — that crashes on RN)

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
