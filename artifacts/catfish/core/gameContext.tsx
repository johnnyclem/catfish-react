/**
 * GameState — translated from the @Observable + @MainActor pattern in the
 * source SwiftUI doc. Single React Context owns the active CaseRun and
 * persists every mutation back to AsyncStorage.
 *
 * Locked-in invariants from the source doc:
 *   - KillerIdentity is stamped at startNewRun and immutable afterwards.
 *   - Day advances only via advanceDay() — no real-clock side effects.
 *   - Facts are not implicitly committed (Pass 5 owns that gesture).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  startNewRun: (forced?: KillerIdentity) => Promise<CaseRun>;
  advanceDay: () => Promise<void>;
  swipe: (
    candidateId: CandidateId,
    direction: "left" | "right",
  ) => Promise<MatchRelationship | null>;
  resetRun: () => Promise<void>;
}

const GameStateContext = createContext<GameStateValue | null>(null);

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

export function GameStateProvider({ children }: { children: React.ReactNode }) {
  const [run, setRun] = useState<CaseRun | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadActiveRun()
      .then((existing) => {
        if (!mounted) return;
        setRun(existing);
      })
      .finally(() => {
        if (mounted) setHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback(async (next: CaseRun | null) => {
    setRun(next);
    await saveActiveRun(next);
  }, []);

  const startNewRun = useCallback(
    async (forced?: KillerIdentity) => {
      const next = buildRun(forced);
      await persist(next);
      return next;
    },
    [persist],
  );

  const advanceDay = useCallback(async () => {
    setRun((prev) => {
      if (!prev) return prev;
      const next: CaseRun = { ...prev, day: prev.day + 1 };
      void saveActiveRun(next);
      return next;
    });
  }, []);

  const swipe = useCallback<GameStateValue["swipe"]>(
    async (candidateId, direction) => {
      let createdMatch: MatchRelationship | null = null;
      let nextRun: CaseRun | null = null;

      setRun((prev) => {
        if (!prev) return prev;

        // Integrity guard — only the candidate currently at deckCursor may be
        // swiped. Rejects duplicate/stale commits that would otherwise
        // double-advance the cursor and corrupt persisted run state.
        const expected = prev.deck[prev.deckCursor];
        if (!expected || expected.id !== candidateId) {
          return prev;
        }

        const swipeRec: SwipeRecord = {
          candidateId,
          direction,
          day: prev.day,
          at: nowIso(),
        };

        let matches = prev.matches;
        let threads = prev.threads;

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
        nextRun = next;
        return next;
      });

      if (nextRun) await saveActiveRun(nextRun);
      return createdMatch;
    },
    [],
  );

  const resetRun = useCallback(async () => {
    await persist(null);
  }, [persist]);

  const value = useMemo<GameStateValue>(
    () => ({ hydrated, run, startNewRun, advanceDay, swipe, resetRun }),
    [hydrated, run, startNewRun, advanceDay, swipe, resetRun],
  );

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState(): GameStateValue {
  const ctx = useContext(GameStateContext);
  if (!ctx) {
    throw new Error("useGameState must be used inside <GameStateProvider />");
  }
  return ctx;
}
