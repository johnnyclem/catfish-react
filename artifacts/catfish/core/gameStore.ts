/**
 * GameState — Zustand store.
 *
 * Translated from the @Observable + @MainActor pattern in the source
 * SwiftUI doc. Holds the active CaseRun and persists every mutation back
 * to AsyncStorage.
 *
 * Locked-in invariants from the source doc:
 *   - KillerIdentity is stamped at startNewRun and immutable afterwards.
 *   - Day advances only via advanceDay() — no real-clock side effects.
 *   - Facts are not implicitly committed (Pass 5 owns that gesture).
 *
 * Hydration: call `useGameHydration()` once at app root. The store
 * starts with `hydrated: false` and flips to true after AsyncStorage
 * is read on cold start.
 */

import { useEffect } from "react";
import { create } from "zustand";

import { getIdentityModule } from "./identities";
import {
  ALL_KILLERS,
  CandidateId,
  CaseRun,
  KillerIdentity,
  MatchRelationship,
  newMatchId,
  newRunId,
  newThreadId,
  SwipeRecord,
} from "./models";
import { loadActiveRun, saveActiveRun } from "./repository";

interface GameStateValue {
  hydrated: boolean;
  run: CaseRun | null;
  hydrate: () => Promise<void>;
  startNewRun: (forced?: KillerIdentity) => Promise<CaseRun>;
  advanceDay: () => Promise<void>;
  swipe: (
    candidateId: CandidateId,
    direction: "left" | "right",
  ) => Promise<MatchRelationship | null>;
  resetRun: () => Promise<void>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function pickRandomKiller(): KillerIdentity {
  const idx = Math.floor(Math.random() * ALL_KILLERS.length);
  return ALL_KILLERS[idx]!;
}

function buildRun(forced?: KillerIdentity): CaseRun {
  const killer = forced ?? pickRandomKiller();
  const identity = getIdentityModule(killer);
  return {
    id: newRunId(),
    killer,
    startedAt: nowIso(),
    day: 1,
    deck: identity.buildDeck(),
    deckCursor: 0,
    swipes: [],
    matches: [],
    threads: [],
    facts: [],
    closed: false,
  };
}

let hydrationPromise: Promise<void> | null = null;

export const useGameState = create<GameStateValue>((set, get) => ({
  hydrated: false,
  run: null,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async () => {
      const existing = await loadActiveRun();
      set({ run: existing, hydrated: true });
    })();
    return hydrationPromise;
  },

  startNewRun: async (forced) => {
    const next = buildRun(forced);
    set({ run: next });
    await saveActiveRun(next);
    return next;
  },

  advanceDay: async () => {
    const prev = get().run;
    if (!prev) return;
    const next: CaseRun = { ...prev, day: prev.day + 1 };
    set({ run: next });
    await saveActiveRun(next);
  },

  swipe: async (candidateId, direction) => {
    const prev = get().run;
    if (!prev) return null;

    // Integrity guard — only the candidate currently at deckCursor may be
    // swiped. Rejects duplicate/stale commits that would otherwise
    // double-advance the cursor and corrupt persisted run state.
    const expected = prev.deck[prev.deckCursor];
    if (!expected || expected.id !== candidateId) {
      return null;
    }

    const swipeRec: SwipeRecord = {
      candidateId,
      direction,
      day: prev.day,
      at: nowIso(),
    };

    let matches = prev.matches;
    let threads = prev.threads;
    let createdMatch: MatchRelationship | null = null;

    if (direction === "right") {
      // Killer identity is immutable — we never re-stamp here.
      const threadId = newThreadId();
      const match: MatchRelationship = {
        id: newMatchId(),
        runId: prev.id,
        candidateId,
        matchedOnDay: prev.day,
        matchedAt: nowIso(),
        threadId,
        unmatched: false,
      };
      createdMatch = match;
      matches = [...prev.matches, match];
      threads = [
        ...prev.threads,
        {
          id: threadId,
          runId: prev.id,
          candidateId,
          messages: [], // Pass 2 will populate this.
        },
      ];
    }

    const next: CaseRun = {
      ...prev,
      deckCursor: prev.deckCursor + 1,
      swipes: [...prev.swipes, swipeRec],
      matches,
      threads,
    };
    set({ run: next });
    await saveActiveRun(next);
    return createdMatch;
  },

  resetRun: async () => {
    set({ run: null });
    await saveActiveRun(null);
  },
}));

/**
 * Mount once at app root. Triggers the AsyncStorage rehydration of the
 * active CaseRun. Idempotent — repeat calls are no-ops.
 */
export function useGameHydration(): void {
  const hydrate = useGameState((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}
