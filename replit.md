# Workspace

## Overview

This project is a pnpm workspace monorepo built with TypeScript, focusing on a pixel-art dating-detective mobile game called "Catfish". The game features a 4-tab shell (Swipe, Matches, Journal, Profile), persistent game state management, and a unique clue graph mechanic for solving cases. The overarching goal is to deliver an engaging narrative-driven mobile game experience.

## User Preferences

I prefer simple language and clear, concise explanations. When making changes, please prioritize iterative development, asking for confirmation before major architectural shifts. Do not make changes to the `.replit-artifact/artifact.toml` file.

## System Architecture

The project utilizes a monorepo structure managed by pnpm workspaces. It runs on Node.js 24 with TypeScript 5.9.

**Core Technologies:**
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Validation:** Zod (`zod/v4`) and `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild (CJS bundle)

**Catfish (Mobile App) Specifics:**
- **UI/UX:** Features a custom pixel-art chrome with a neon color palette (`#0a0420`, `#ff2f8f`, `#22e0ff`, `#7a3cff`) and the "Press Start 2P" pixel font. Uses `AssetImage` for PNG assets.
- **Game State Management:** Persistent `CaseRun` state is managed in `core/gameStore.ts` using Zustand and AsyncStorage (JSON-encoded). `useGameHydration()` handles rehydration on cold starts.
- **Swipe Mechanic:** Implements an 110pt drag-to-commit swipe deck where right-swipes result in a match and a celebration overlay. Killer identities and decoy pools are deterministically selected.
- **Clue Graph (Pass 4):** Features a three-layer fact model (static, variable, conditional) and `captured` facts from player interactions. `core/factBootstrap.ts` materializes per-run authored facts, and `core/identities.ts` defines killer-specific fact deductions and red herrings. `core/accusation.ts` handles case endings based on discovered facts.
- **Chat System:** NPC chat replies are humanized with randomized 2-6 second delays between lines. `ChatThread` manages `pendingSuspectQueue` and `postDelivery` actions for turn advancement and reply option unlocking.
- **Audio (Pass 1.1):** Three independent audio channels (voice, music, SFX) are managed via `AudioProvider.tsx` and `audioEvents.ts`, with mute toggles in the Profile tab. Assets are pre-generated via scripts.
- **Parody Mini-game Persistence (Task #44):** Each mini-game (WordLow, SafeSpot, EgoTrip, SugarCoat) saves its in-progress run to AsyncStorage (`catfish/prefs/parody-session/v1`) independently, with same-day gating for most sessions, except for WordLow streaks.
- **Development Environment:** The Replit preview iframe is configured to run Metro on local port `8000` (mapped to external `3000`). `scripts/check-expo-versions.mjs` enforces Expo SDK version consistency.

## External Dependencies

- **pnpm:** Monorepo management and package manager.
- **Node.js:** Runtime environment (version 24).
- **TypeScript:** Language (version 5.9).
- **Express:** API server framework (version 5).
- **PostgreSQL:** Database.
- **Drizzle ORM:** Object-Relational Mapper for PostgreSQL.
- **Zod:** Schema declaration and validation library (`zod/v4`).
- **drizzle-zod:** Zod integration for Drizzle ORM schemas.
- **Orval:** OpenAPI spec code generator for API hooks and Zod schemas.
- **esbuild:** JavaScript bundler.
- **Expo:** Mobile app development framework.
- **Zustand:** State management library (for `core/gameStore.ts`).
- **AsyncStorage:** Persistent data storage for React Native/Expo.
- **@expo-google-fonts/press-start-2p:** Custom font.
- **ElevenLabs:** Voice generation service (for in-game audio).