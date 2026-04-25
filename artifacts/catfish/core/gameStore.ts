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

import { getIdentityModule, getScriptForCandidate } from "./identities";
import {
  ALL_KILLERS,
  CandidateId,
  CaseRun,
  ChatThread,
  Fact,
  FactId,
  KillerIdentity,
  MatchRelationship,
  Message,
  MessageId,
  newFactId,
  newMatchId,
  newMessageId,
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
  /**
   * In-memory only — the most recent Fact removed via `removeFact`,
   * stashed so the Journal tab can offer a brief undo affordance.
   * Cleared when the player either undoes the discard, discards
   * another fact, or the undo window times out. Not persisted to
   * AsyncStorage on purpose: a re-discardable fact across cold start
   * would feel like ghost data.
   */
  recentlyDiscarded: Fact | null;
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
  /**
   * Idempotent — pushes the opening suspect turn for a thread that the
   * player has never opened. Safe to call on every focus.
   */
  openThread: (threadId: ThreadId) => Promise<void>;
  /**
   * Records a player reply and pushes the next scripted suspect turn (if
   * any). Returns the updated thread.
   */
  sendReply: (
    threadId: ThreadId,
    replyText: string,
  ) => Promise<ChatThread | null>;
  /**
   * Restore the most recent fact removed via `removeFact`, provided
   * `recentlyDiscarded` still matches. Acts as the undo handler for
   * the Journal's discard banner.
   */
  restoreFact: (factId: FactId) => Promise<void>;
  /**
   * Drop the recently-discarded slot without restoring. Called when
   * the undo window expires or the banner is dismissed. No-op if
   * `recentlyDiscarded` doesn't match `factId`, so a stale timer can't
   * blow away a freshly stashed entry.
   */
  clearRecentlyDiscarded: (factId: FactId) => void;
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

/**
 * Forward-compatible coercion for runs persisted before Pass 2 widened the
 * thread schema. Old threads stored `messages: unknown[]` (always empty)
 * and had no `turnIndex`. We patch them in-place on load so the rest of
 * the store can assume the new shape.
 */
function migrateRun(run: CaseRun | null): CaseRun | null {
  if (!run) return null;
  const threads = run.threads.map((t) => {
    const rawMessages = Array.isArray(t.messages) ? t.messages : [];
    // Defensively coerce — anything that doesn't look like a Message gets
    // dropped instead of crashing the chat renderer.
    const messages: Message[] = rawMessages.filter(
      (m): m is Message =>
        !!m &&
        typeof m === "object" &&
        typeof (m as Message).id === "string" &&
        typeof (m as Message).text === "string" &&
        ((m as Message).sender === "suspect" ||
          (m as Message).sender === "player"),
    );
    const turnIndex =
      typeof (t as ChatThread).turnIndex === "number"
        ? (t as ChatThread).turnIndex
        : 0;
    return { ...t, messages, turnIndex } satisfies ChatThread;
  });
  return { ...run, threads };
}

let hydrationPromise: Promise<void> | null = null;

/**
 * Window for the Journal's "fact discarded" undo affordance. Owned by
 * the store (not the banner component) so expiry is enforced even if
 * the player navigates away from the Journal tab before tapping undo.
 */
export const UNDO_WINDOW_MS = 4500;

/**
 * Module-level timer that clears `recentlyDiscarded` after the undo
 * window. Lives outside the Zustand state because it's pure side
 * effect — putting timers in state forces unnecessary re-renders and
 * makes serialization awkward.
 */
let discardClearTimer: ReturnType<typeof setTimeout> | null = null;

function cancelDiscardTimer(): void {
  if (discardClearTimer) {
    clearTimeout(discardClearTimer);
    discardClearTimer = null;
  }
}

export const useGameState = create<GameStateValue>((set, get) => ({
  hydrated: false,
  run: null,
  recentlyDiscarded: null,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async () => {
      const existing = migrateRun(await loadActiveRun());
      // Cold-start invariant: undo state is in-memory only, so a
      // dangling stash from a prior process is impossible. Still,
      // explicitly clearing here documents the contract.
      cancelDiscardTimer();
      set({ run: existing, hydrated: true, recentlyDiscarded: null });
    })();
    return hydrationPromise;
  },

  startNewRun: async (forced) => {
    const next = buildRun(forced);
    // Starting a fresh run forfeits any pending undo — a fact stashed
    // against the previous run must not be restorable into the new one.
    cancelDiscardTimer();
    set({ run: next, recentlyDiscarded: null });
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
          // openThread() will lazily push the opening salvo on first view.
          messages: [],
          turnIndex: 0,
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
    const removed = prev.facts.find((f) => f.id === factId);
    if (!removed) return;
    const filtered = prev.facts.filter((f) => f.id !== factId);
    const next: CaseRun = { ...prev, facts: filtered };
    // Stash the removed fact so the Journal can offer a brief undo.
    // Replacing any prior stash is intentional — only the latest
    // discard is recoverable, matching standard mobile snackbar UX.
    cancelDiscardTimer();
    set({ run: next, recentlyDiscarded: removed });
    await saveActiveRun(next);
    // Schedule expiry from the store itself so the undo window stays
    // honest even if the player navigates away from the Journal tab.
    discardClearTimer = setTimeout(() => {
      discardClearTimer = null;
      const current = get().recentlyDiscarded;
      if (current && current.id === removed.id) {
        set({ recentlyDiscarded: null });
      }
    }, UNDO_WINDOW_MS);
  },

  openThread: async (threadId) => {
    const prev = get().run;
    if (!prev) return;
    const thread = prev.threads.find((t) => t.id === threadId);
    if (!thread) return;
    // Already opened — nothing to push.
    if (thread.messages.length > 0 || thread.turnIndex > 0) return;

    const candidate = prev.deck.find((c) => c.id === thread.candidateId);
    if (!candidate) return;
    const script = getScriptForCandidate(candidate);
    const turn = script[0];
    if (!turn) return;

    const opening: Message[] = turn.suspectMessages.map((text) => ({
      id: newMessageId(),
      sender: "suspect",
      text,
      sentAt: nowIso(),
      beatKey: turn.beatKey,
    }));

    const updatedThread: ChatThread = {
      ...thread,
      messages: [...thread.messages, ...opening],
      turnIndex: 1,
    };

    const next: CaseRun = {
      ...prev,
      threads: prev.threads.map((t) => (t.id === threadId ? updatedThread : t)),
    };
    set({ run: next });
    await saveActiveRun(next);
  },

  sendReply: async (threadId, replyText) => {
    const prev = get().run;
    if (!prev) return null;
    const thread = prev.threads.find((t) => t.id === threadId);
    if (!thread) return null;

    const candidate = prev.deck.find((c) => c.id === thread.candidateId);
    if (!candidate) return null;
    const script = getScriptForCandidate(candidate);

    // Bound check — once we run out of authored turns the player can't
    // reply (the UI hides the picker too, but guard here as well).
    const replyTurn = script[thread.turnIndex - 1];
    if (!replyTurn) return null;

    const playerMsg: Message = {
      id: newMessageId(),
      sender: "player",
      text: replyText,
      sentAt: nowIso(),
      beatKey: replyTurn.beatKey,
    };

    const nextTurn = script[thread.turnIndex];
    const suspectMsgs: Message[] = nextTurn
      ? nextTurn.suspectMessages.map((text) => ({
          id: newMessageId(),
          sender: "suspect",
          text,
          sentAt: nowIso(),
          beatKey: nextTurn.beatKey,
        }))
      : [];

    const updatedThread: ChatThread = {
      ...thread,
      messages: [...thread.messages, playerMsg, ...suspectMsgs],
      turnIndex: thread.turnIndex + 1,
    };

    const next: CaseRun = {
      ...prev,
      threads: prev.threads.map((t) => (t.id === threadId ? updatedThread : t)),
    };
    set({ run: next });
    await saveActiveRun(next);
    return updatedThread;
  },

  restoreFact: async (factId) => {
    const { run: prev, recentlyDiscarded } = get();
    if (!prev || !recentlyDiscarded || recentlyDiscarded.id !== factId) {
      return;
    }
    // Run-identity guard — a stash from an earlier run must not be
    // injected into the active one. Belt-and-braces with the
    // startNewRun/hydrate clears, in case anything ever schedules a
    // restore across run boundaries.
    if (recentlyDiscarded.runId !== prev.id) {
      cancelDiscardTimer();
      set({ recentlyDiscarded: null });
      return;
    }
    cancelDiscardTimer();
    // Guard against the rare race where the same fact id was already
    // re-added (e.g. a re-capture beat the undo tap).
    if (prev.facts.some((f) => f.id === factId)) {
      set({ recentlyDiscarded: null });
      return;
    }
    const next: CaseRun = {
      ...prev,
      facts: [...prev.facts, recentlyDiscarded],
    };
    set({ run: next, recentlyDiscarded: null });
    await saveActiveRun(next);
  },

  clearRecentlyDiscarded: (factId) => {
    const current = get().recentlyDiscarded;
    if (!current || current.id !== factId) return;
    cancelDiscardTimer();
    set({ recentlyDiscarded: null });
  },

  resetRun: async () => {
    cancelDiscardTimer();
    set({ run: null, recentlyDiscarded: null });
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
