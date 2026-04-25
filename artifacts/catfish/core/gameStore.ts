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

import AsyncStorage from "@react-native-async-storage/async-storage";
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
  MatchId,
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
   * Persistent voice-mute preference. Lives at the top of the store
   * (not on CaseRun) because it must survive `resetRun()` and span
   * runs — the player should not have to re-mute every cold start.
   * Backed by its own AsyncStorage key so the larger CaseRun blob
   * isn't rewritten on every toggle.
   */
  voiceMuted: boolean;
  /**
   * In-memory only — Facts removed via `removeFact`, stashed so the
   * Journal tab can offer a brief undo affordance. A small queue (not
   * a single slot) so a player triaging several facts in quick
   * succession can undo each one independently. Order is oldest →
   * newest; each entry has its own expiry timer (see
   * `discardClearTimers`) so the windows don't share fate. Capped at
   * `MAX_RECENT_DISCARDS` — beyond that the oldest entry is silently
   * dropped to keep the on-screen banner stack manageable.
   *
   * Not persisted to AsyncStorage on purpose: a re-discardable fact
   * across cold start would feel like ghost data.
   */
  recentlyDiscarded: Fact[];
  hydrate: () => Promise<void>;
  /** Toggle voice playback. Persists to AsyncStorage immediately. */
  setVoiceMuted: (muted: boolean) => Promise<void>;
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
   * Restore a previously-discarded fact by id, provided it's still in
   * the `recentlyDiscarded` queue. Acts as the undo handler for the
   * Journal's discard banner stack — restoring one entry leaves any
   * other queued discards untouched.
   */
  restoreFact: (factId: FactId) => Promise<void>;
  /**
   * Drop a single entry from the `recentlyDiscarded` queue without
   * restoring it. Called when an undo window expires or the banner is
   * dismissed. No-op if `factId` isn't in the queue, so a stale timer
   * can't blow away a freshly stashed entry that happens to share the
   * same id (which can't actually happen — fact ids are unique — but
   * the guard is cheap).
   */
  clearRecentlyDiscarded: (factId: FactId) => void;
  /**
   * Flip a match's `unmatched` flag to true. The thread itself is
   * preserved on the run so Pass 3's Journal can still cite anything
   * the suspect said. Idempotent — re-calling on an already-unmatched
   * row is a no-op.
   */
  unmatchThread: (matchId: MatchId) => Promise<void>;
  /**
   * Clears the unread suspect-message counter on a thread. Idempotent —
   * safe to call on every focus / message update from the chat screen.
   */
  markThreadRead: (threadId: ThreadId) => Promise<void>;
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
    const unreadCount =
      typeof (t as ChatThread).unreadCount === "number" &&
      (t as ChatThread).unreadCount >= 0
        ? (t as ChatThread).unreadCount
        : 0;
    return {
      ...t,
      messages,
      turnIndex,
      unreadCount,
    } satisfies ChatThread;
  });
  return { ...run, threads };
}

let hydrationPromise: Promise<void> | null = null;

/**
 * AsyncStorage key for the voice-mute preference. Versioned so a
 * future "v2" with a richer audio prefs object can migrate from
 * the boolean shape without losing the player's choice.
 */
const VOICE_MUTED_KEY = "catfish/prefs/voice_muted/v1";

async function loadVoiceMuted(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VOICE_MUTED_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

async function saveVoiceMuted(muted: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(VOICE_MUTED_KEY, muted ? "1" : "0");
  } catch {
    // Persistence failure is non-fatal — the in-memory toggle still
    // works for the rest of the session.
  }
}

/**
 * Window for the Journal's "fact discarded" undo affordance. Owned by
 * the store (not the banner component) so expiry is enforced even if
 * the player navigates away from the Journal tab before tapping undo.
 */
export const UNDO_WINDOW_MS = 4500;

/**
 * Soft cap on how many discarded facts can be queued for undo at once.
 * Beyond this we drop the oldest entry (cancelling its timer) so the
 * banner stack can't grow without bound if the player goes on a
 * discard spree.
 */
export const MAX_RECENT_DISCARDS = 5;

/**
 * Module-level per-fact expiry timers for `recentlyDiscarded`. Lives
 * outside the Zustand state because timers are pure side effect —
 * putting them in state forces unnecessary re-renders and makes
 * serialization awkward. Keyed by FactId so each queued discard
 * expires on its own schedule, independent of any later discards.
 */
const discardClearTimers = new Map<FactId, ReturnType<typeof setTimeout>>();

function cancelDiscardTimer(factId: FactId): void {
  const t = discardClearTimers.get(factId);
  if (t) {
    clearTimeout(t);
    discardClearTimers.delete(factId);
  }
}

function cancelAllDiscardTimers(): void {
  for (const t of discardClearTimers.values()) {
    clearTimeout(t);
  }
  discardClearTimers.clear();
}

export const useGameState = create<GameStateValue>((set, get) => ({
  hydrated: false,
  run: null,
  voiceMuted: false,
  recentlyDiscarded: [],

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async () => {
      // Load run + voice prefs in parallel — they live in different
      // AsyncStorage rows and have no ordering dependency.
      const [existing, muted] = await Promise.all([
        loadActiveRun().then(migrateRun),
        loadVoiceMuted(),
      ]);
      // Cold-start invariant: undo state is in-memory only, so a
      // dangling stash from a prior process is impossible. Still,
      // explicitly clearing here documents the contract.
      cancelAllDiscardTimers();
      set({
        run: existing,
        hydrated: true,
        voiceMuted: muted,
        recentlyDiscarded: [],
      });
    })();
    return hydrationPromise;
  },

  setVoiceMuted: async (muted) => {
    // Update local state synchronously so the toggle UI flips
    // instantly; persist asynchronously in the background.
    set({ voiceMuted: muted });
    await saveVoiceMuted(muted);
  },

  startNewRun: async (forced) => {
    const next = buildRun(forced);
    // Starting a fresh run forfeits any pending undos — facts stashed
    // against the previous run must not be restorable into the new one.
    cancelAllDiscardTimers();
    set({ run: next, recentlyDiscarded: [] });
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
          unreadCount: 0,
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

    // Append to the discard queue so the Journal can offer a brief
    // undo on each one independently. If the player has already
    // queued the cap, evict the oldest (and cancel its timer) so the
    // banner stack stays bounded.
    const prevQueue = get().recentlyDiscarded;
    const nextQueue = [...prevQueue, removed];
    while (nextQueue.length > MAX_RECENT_DISCARDS) {
      const evicted = nextQueue.shift();
      if (evicted) cancelDiscardTimer(evicted.id);
    }

    set({ run: next, recentlyDiscarded: nextQueue });
    await saveActiveRun(next);

    // Schedule this entry's expiry from the store itself so the undo
    // window stays honest even if the player navigates away from the
    // Journal tab. Each entry has its own timer so an earlier
    // discard's countdown isn't reset by a later one.
    const timer = setTimeout(() => {
      discardClearTimers.delete(removed.id);
      const current = get().recentlyDiscarded;
      if (current.some((f) => f.id === removed.id)) {
        set({
          recentlyDiscarded: current.filter((f) => f.id !== removed.id),
        });
      }
    }, UNDO_WINDOW_MS);
    discardClearTimers.set(removed.id, timer);
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
      // Player is actively viewing — opening salvo lands as already read.
      unreadCount: 0,
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
      // Bump unread for any new suspect lines. ThreadView clears it back
      // to 0 on the next render via markThreadRead so a player who is
      // actively in the thread never sees a stale badge — but a player
      // who navigated away mid-conversation will.
      unreadCount: thread.unreadCount + suspectMsgs.length,
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
    const target = recentlyDiscarded.find((f) => f.id === factId);
    if (!prev || !target) return;

    // Cancel this entry's timer up-front; every exit path below
    // removes it from the queue, so leaving the timer to fire later
    // would just invite a stale set() race.
    cancelDiscardTimer(factId);
    const trimmedQueue = recentlyDiscarded.filter((f) => f.id !== factId);

    // Run-identity guard — a stash from an earlier run must not be
    // injected into the active one. Belt-and-braces with the
    // startNewRun/hydrate clears, in case anything ever schedules a
    // restore across run boundaries.
    if (target.runId !== prev.id) {
      set({ recentlyDiscarded: trimmedQueue });
      return;
    }
    // Guard against the rare race where the same fact id was already
    // re-added (e.g. a re-capture beat the undo tap).
    if (prev.facts.some((f) => f.id === factId)) {
      set({ recentlyDiscarded: trimmedQueue });
      return;
    }
    const next: CaseRun = {
      ...prev,
      facts: [...prev.facts, target],
    };
    set({ run: next, recentlyDiscarded: trimmedQueue });
    await saveActiveRun(next);
  },

  clearRecentlyDiscarded: (factId) => {
    const current = get().recentlyDiscarded;
    if (!current.some((f) => f.id === factId)) return;
    cancelDiscardTimer(factId);
    set({ recentlyDiscarded: current.filter((f) => f.id !== factId) });
  },

  unmatchThread: async (matchId) => {
    const prev = get().run;
    if (!prev) return;
    const target = prev.matches.find((m) => m.id === matchId);
    // No-op if the match is gone or already unmatched — saves a write
    // and keeps the action idempotent for double-tap callers.
    if (!target || target.unmatched) return;
    const matches = prev.matches.map((m) =>
      m.id === matchId ? { ...m, unmatched: true } : m,
    );
    // NB: we deliberately leave run.threads untouched. Pass 3's Journal
    // still needs to be able to cite messages from dropped suspects.
    const next: CaseRun = { ...prev, matches };
    set({ run: next });
    await saveActiveRun(next);
  },

  markThreadRead: async (threadId) => {
    const prev = get().run;
    if (!prev) return;
    const thread = prev.threads.find((t) => t.id === threadId);
    if (!thread || thread.unreadCount === 0) return;
    const updatedThread: ChatThread = { ...thread, unreadCount: 0 };
    const next: CaseRun = {
      ...prev,
      threads: prev.threads.map((t) => (t.id === threadId ? updatedThread : t)),
    };
    set({ run: next });
    await saveActiveRun(next);
  },
  resetRun: async () => {
    cancelAllDiscardTimers();
    set({ run: null, recentlyDiscarded: [] });
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
