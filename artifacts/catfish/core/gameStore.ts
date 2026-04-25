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
  Fact,
  FactId,
  KillerIdentity,
  MatchRelationship,
  MessageId,
  newFactId,
  newMatchId,
  newRunId,
  newThreadId,
  SwipeRecord,
  ThreadId,
} from "./models";
import { loadActiveRun, saveActiveRun } from "./repository";

/**
 * Pass 3 — Journal capture input.
 *
 * Pass 2's chat UI calls `commitFact` with the message it wants to
 * promote into the case file. `messageId` is optional only because
 * Pass 2 hasn't shipped the wire format yet — once chat lands, every
 * capture should pass it through so we can de-dupe re-captures.
 */
export interface CommitFactInput {
  candidateId: CandidateId;
  threadId?: ThreadId;
  messageId?: MessageId;
  quote: string;
}

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
  /** Promote a chat message into the Journal as a captured Fact. */
  commitFact: (input: CommitFactInput) => Promise<Fact | null>;
  /** Discard a previously captured Fact. */
  removeFact: (factId: FactId) => Promise<void>;
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

  commitFact: async ({ candidateId, threadId, messageId, quote }) => {
    const prev = get().run;
    if (!prev) return null;

    const trimmed = quote.trim();
    if (!trimmed) return null;

    // Sanity: the candidate must belong to the active run's deck so a
    // stale capture can't pollute the case file with a phantom suspect.
    const candidate = prev.deck.find((c) => c.id === candidateId);
    if (!candidate) return null;

    // De-dupe — re-capturing the same message is a no-op so the player
    // can't stack identical entries by long-pressing twice.
    if (messageId) {
      const existing = prev.facts.find(
        (f) => f.committed && f.capturedFromMessageId === messageId,
      );
      if (existing) return existing;
    }

    const at = nowIso();
    const fact: Fact = {
      id: newFactId(),
      runId: prev.id,
      authoringKey: messageId ? `captured_${messageId}` : `captured_${at}`,
      payloadJson: JSON.stringify({
        kind: "captured",
        quote: trimmed,
        threadId: threadId ?? null,
        messageId: messageId ?? null,
      }),
      committed: true,
      capturedFromCandidateId: candidateId,
      capturedFromMessageId: messageId,
      capturedQuote: trimmed,
      capturedOnDay: prev.day,
      capturedAt: at,
    };

    const next: CaseRun = { ...prev, facts: [...prev.facts, fact] };
    set({ run: next });
    await saveActiveRun(next);
    return fact;
  },

  removeFact: async (factId) => {
    const prev = get().run;
    if (!prev) return;
    const filtered = prev.facts.filter((f) => f.id !== factId);
    if (filtered.length === prev.facts.length) return;
    const next: CaseRun = { ...prev, facts: filtered };
    set({ run: next });
    await saveActiveRun(next);
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
