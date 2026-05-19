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

import { AccusationOutcome, resolveAccusation } from "./accusation";
import { freshDecoysForDay } from "./decoyPool";
import { getFaceTimeCallsForDay } from "./facetimeContent";
import { buildAuthoredFacts, isFactRevealedYet } from "./factBootstrap";
import { getIdentityModule, getScriptForThread } from "./identities";
import { INNOCENT_TREE_IDS } from "./innocentTrees";
import { getVoicemailsForDay, materializeVoicemail } from "./voicemailContent";
import {
  AccusationResult,
  ALL_KILLERS,
  CandidateId,
  CaseRun,
  ChatThread,
  FriendID,
  RunId,
  Fact,
  FactId,
  FactPayload,
  FactSource,
  KillerIdentity,
  LikeRecord,
  MatchId,
  MatchRelationship,
  Message,
  MessageId,
  newFactId,
  newMatchId,
  newMessageId,
  newRunId,
  newThreadId,
  newVoicemailId,
  newFacetimeCallId,
  PendingSuspectLine,
  RunSummary,
  SwipeRecord,
  ThreadId,
  EvidenceChain,
} from "./models";
import {
  EgoTripSession,
  EMPTY_PARODY_SESSIONS,
  ParodySessions,
  parseParodySessions,
  SafeSpotSession,
  SugarCoatSession,
} from "./parodySessions";
import { loadActiveRun, loadRunArchive, saveActiveRun, saveRunArchive } from "./repository";
import { voiceForCandidate } from "./voiceProfiles";

/**
 * Task #39 — Parody mini-game persistent best scores.
 *
 * Each parody app on the new "Apps" tab tracks one durable stat. We
 * keep the slice intentionally flat (one number per game) so the
 * persistence shape is small and the migration story is trivial.
 * Lives at the top of the store (not on `CaseRun`) because these
 * scores must survive `resetRun()` and span runs — they're meta
 * progress, not case progress.
 */
export type ParodyGame =
  | "wordLow"
  | "safeSpot"
  | "egoTrip"
  | "sugarCoat";

export interface ParodyScores {
  /** Best win streak in Word-Low (Wordle parody). */
  wordLowBestStreak: number;
  /** Highest wave-survived in Safe Spot (PvZ parody). */
  safeSpotBestWave: number;
  /** Highest pillar-passed score in Ego Trip (Flappy parody). */
  egoTripHighScore: number;
  /** Highest CLOUT score in Sugar Coat (match-3 parody). */
  sugarCoatHighClout: number;
}

export const EMPTY_PARODY_SCORES: ParodyScores = {
  wordLowBestStreak: 0,
  safeSpotBestWave: 0,
  egoTripHighScore: 0,
  sugarCoatHighClout: 0,
};

function parodyKeyFor(game: ParodyGame): keyof ParodyScores {
  switch (game) {
    case "wordLow":
      return "wordLowBestStreak";
    case "safeSpot":
      return "safeSpotBestWave";
    case "egoTrip":
      return "egoTripHighScore";
    case "sugarCoat":
      return "sugarCoatHighClout";
  }
}

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

/**
 * Input to the run-end accusation.
 *
 * `outcome` defaults to `"accuse"` (the player explicitly fingered a
 * candidate). Adjacent flows pass `"escaped"` (the player walked away
 * before nailing it) — `"metKiller"` is wired internally by
 * `advanceDay` when the Day 7 face-to-face fires, not by external
 * callers.
 *
 * Two ways to identify the accused:
 *
 *  - `accusedCandidateId` — preferred. The AccusationSheet keys off
 *    the candidate row's id, so decoys and the killer-candidate are
 *    distinguishable even though decoys carry no `KillerIdentity`.
 *    The store reads `Candidate.isKillerCandidate` to decide whether
 *    to forward the run's `killer` slot or a sentinel "wrong slot"
 *    to the resolver.
 *  - `accused` — legacy. Pre-audit callers, the Day-7 face-to-face
 *    beat in `advanceDay`, and headless test scripts pass an
 *    identity directly. Still honored verbatim.
 *
 * For `outcome === "escaped"` neither is required — the resolver
 * always returns `escapedStub`. For "accuse"/"metKiller", at least
 * one of the two must be set or the call is a no-op.
 */
export interface AccuseInput {
  accused?: KillerIdentity;
  accusedCandidateId?: CandidateId;
  outcome?: AccusationOutcome;
}

/**
 * Day clock cap. The source doc's case window runs through Day 6 —
 * any tick that would land on Day 7 trips the face-to-face beat
 * instead. Lifted as a const so the swipe-deck UI and the resolver
 * test agree on the boundary.
 */
export const FACE_TO_FACE_DAY = 7;

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
   * Persistent SFX-mute preference. Same shape and rationale as
   * `voiceMuted` — separate AsyncStorage row so a toggle doesn't
   * rewrite the run blob, survives `resetRun()`, default-off so a
   * fresh install has full audio. Honored by the `useSfx` hook.
   */
  sfxMuted: boolean;
  /**
   * Persistent music-mute preference. Same persistence contract as
   * `voiceMuted` and `sfxMuted`. Honored by the `MusicProvider`,
   * which pauses/resumes the looping pad track in response.
   */
  musicMuted: boolean;
  /**
   * Persistent per-bus volume levels (0.0–1.0). Each backed by its
   * own AsyncStorage key so a single slider change doesn't rewrite
   * the full run blob. Defaults match the old hardcoded constants
   * in AudioProvider.
   */
  bgmVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  ambienceVolume: number;
  /**
   * Persistent display preference — CRT scanline overlay visibility.
   * Lives at the top of the store (not on CaseRun) so it survives
   * `resetRun()`. Defaults to true (scanlines on). Backed by its own
   * AsyncStorage key.
   */
  scanlinesEnabled: boolean;
  /**
   * Persistent display preference — screen shake on interactions.
   * Default true. Same persistence contract as `scanlinesEnabled`.
   */
  screenShakeEnabled: boolean;
  /**
   * Persistent accessibility preference — reduce motion (disables
   * non-essential animations). Default false. Same persistence
   * contract as `scanlinesEnabled`.
   */
  reduceMotionEnabled: boolean;
  /**
   * Persistent accessibility preference — high contrast text.
   * Default false. Same persistence contract as `scanlinesEnabled`.
   */
  highContrastTextEnabled: boolean;
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
  /**
   * Per-session count of facts captured since the player last opened
   * the Journal app from the parody phone home grid. Drives the red
   * notification badge on the Journal tile so the player can see
   * "you have new evidence to triage" at a glance from the home
   * screen. Cleared to zero by `markJournalVisited` (called the
   * moment the Journal app is opened from the shell). Not persisted
   * — a per-session counter is enough; survival across cold start
   * isn't required and would feel like ghost data.
   */
  journalNewSinceLastVisit: number;
  /**
   * Persistent high-score slice for the parody mini-games on the
   * Apps tab. Survives `resetRun()` because these scores are meta
   * progress, not case progress. Backed by its own AsyncStorage key
   * so a score bump doesn't rewrite the whole CaseRun blob.
   */
  parody: ParodyScores;
  /**
   * Per-game session snapshots — Task #44. Holds WordLow's active
   * win streak (which survives reload until a loss resets it) plus
   * an in-progress run snapshot for each of the other three parody
   * games (Safe Spot / Ego Trip / Sugar Coat). The non-WordLow slots
   * are gated to the local calendar day on hydrate so a player who
   * comes back the next day starts fresh — the snapshot was already
   * written, but `parseParodySessions` drops it when its `dateKey`
   * doesn't match today.
   *
   * Lives at the top of the store (not on `CaseRun`) for the same
   * reason `parody` does: these are meta-progress slices that must
   * outlive `resetRun()`.
   */
  parodySessions: ParodySessions;
  /** Persisted archive of closed-run summaries for the Run History screen. */
  runArchive: RunSummary[];
  hydrate: () => Promise<void>;
  /** Toggle voice playback. Persists to AsyncStorage immediately. */
  setVoiceMuted: (muted: boolean) => Promise<void>;
  /** Toggle UI sound effects. Persists to AsyncStorage immediately. */
  setSfxMuted: (muted: boolean) => Promise<void>;
  /** Toggle background music. Persists to AsyncStorage immediately. */
  setMusicMuted: (muted: boolean) => Promise<void>;
  /** Set BGM volume (0–1). Persists to AsyncStorage immediately. */
  setBgmVolume: (v: number) => Promise<void>;
  /** Set SFX volume (0–1). Persists to AsyncStorage immediately. */
  setSfxVolume: (v: number) => Promise<void>;
  /** Set voice volume (0–1). Persists to AsyncStorage immediately. */
  setVoiceVolume: (v: number) => Promise<void>;
  /** Set ambience volume (0–1). Persists to AsyncStorage immediately. */
  setAmbienceVolume: (v: number) => Promise<void>;
  /** Toggle CRT scanline overlay. Persists to AsyncStorage immediately. */
  setScanlinesEnabled: (enabled: boolean) => Promise<void>;
  /** Toggle screen shake. Persists to AsyncStorage immediately. */
  setScreenShakeEnabled: (enabled: boolean) => Promise<void>;
  /** Toggle reduce-motion accessibility mode. Persists to AsyncStorage immediately. */
  setReduceMotionEnabled: (enabled: boolean) => Promise<void>;
  /** Toggle high-contrast text. Persists to AsyncStorage immediately. */
  setHighContrastTextEnabled: (enabled: boolean) => Promise<void>;
  /**
   * Record a parody mini-game result. No-op (returns `false`) if the
   * supplied value isn't strictly higher than the current best —
   * keeps the bookkeeping monotonic so callers can fire it after
   * every game-over without worrying about regressions. Returns
   * `true` and persists when the new value wins, so the UI can play
   * a "new high" sting only on a real beat.
   */
  recordParodyScore: (game: ParodyGame, value: number) => Promise<boolean>;
  /**
   * Update WordLow's persisted active win streak — Task #44. Persists
   * the new value to the parody-sessions blob via the same serialized
   * write chain that protects the high-score blob, so a sequence of
   * win→win→loss writes can never land out of order.
   *
   * No-op (returns without writing) if `value` is unchanged from the
   * in-memory slot, so a re-render that re-fires the effect doesn't
   * spam AsyncStorage.
   */
  setWordLowStreak: (value: number) => Promise<void>;
  /**
   * Stash an in-progress Safe Spot run so a cold start within the
   * same calendar day can offer a RESUME affordance. Pass `null` to
   * clear (game-over, fresh start). Same write-chain as above.
   */
  saveSafeSpotSession: (snap: SafeSpotSession | null) => Promise<void>;
  /** Stash / clear an in-progress Ego Trip run. See `saveSafeSpotSession`. */
  saveEgoTripSession: (snap: EgoTripSession | null) => Promise<void>;
  /** Stash / clear an in-progress Sugar Coat run. See `saveSafeSpotSession`. */
  saveSugarCoatSession: (snap: SugarCoatSession | null) => Promise<void>;
  startNewRun: (forced?: KillerIdentity) => Promise<CaseRun>;
  /**
   * Player-paced clock tick.
   *
   * If the resulting day would land on Day 7, the run instead closes
   * with a `metKiller` `AccusationResult` — the source doc's "Day 7
   * face-to-face" beat — so the player never enters a Day 7 swipe deck.
   * No-ops if the run is already closed.
   */
  advanceDay: () => Promise<void>;
  /**
   * File the run-end accusation. Calls the pure `resolveAccusation`
   * resolver against the player's currently-discovered fact set,
   * stamps `closed = true` and the resolved `ending` onto the run,
   * persists, and returns the result for the run-end card to render.
   *
   * No-ops (returns `null`) if the run is missing or already closed.
   */
  accuse: (input: AccuseInput) => Promise<AccusationResult | null>;
  /**
   * Dismiss the run-end card without starting a new run. Sets
   * `run.endingDismissed = true` so the overlay disappears; leaves
   * `closed = true` AND keeps `ending` populated so the Journal's
   * closed-run recovery panel can re-open the same card via
   * `reopenEnding`. A fresh run is still required to play again.
   */
  dismissAccusation: () => Promise<void>;
  /**
   * Re-mount the End-of-Run overlay for a closed run that was
   * previously dismissed via `dismissAccusation`. Flips
   * `endingDismissed` back to `false`. No-op if the run isn't closed
   * or has no `ending` payload.
   */
  reopenEnding: () => Promise<void>;
  /**
   * Records a swipe. A right-swipe is now a "like" — it appends a
   * pending `LikeRecord` and a `SwipeRecord` and advances the cursor,
   * but does NOT mint a `MatchRelationship` or `ChatThread`. Match
   * resolution happens in `advanceDay()` (the Sleep button), which
   * walks `pendingLikes` and reciprocates every story candidate.
   *
   * Returns `true` if the swipe was accepted, `false` if rejected
   * (closed run, stale candidate id, etc).
   */
  swipe: (
    candidateId: CandidateId,
    direction: "left" | "right",
  ) => Promise<boolean>;
  /**
   * Dequeue a single match-celebration announcement after the Swipe
   * tab has shown its overlay. Idempotent — calling with an unknown
   * id (already acknowledged, or never queued) is a no-op so the UI
   * doesn't have to guard against double-fires.
   */
  acknowledgeMatchAnnouncement: (matchId: MatchId) => Promise<void>;
  /** Promote a chat message into the Journal as a captured Fact. */
  commitFact: (input: CommitFactInput) => Promise<Fact | null>;
  /** Discard a previously captured Fact. */
  removeFact: (factId: FactId) => Promise<void>;
  /**
   * Force-reveal an authored fact in the Journal regardless of its
   * day/source gate. Wired from the DateDirector when a `factReveal`
   * beat fires — the player earned the clue, so it shouldn't slip
   * back into the fog because the calendar hasn't caught up yet.
   * Idempotent.
   */
  revealAuthoredFact: (factId: FactId) => Promise<void>;
  /**
   * Enter a date with the named candidate. Stamps a date checkpoint on
   * the run for cold-start resume; the in-memory active scene lives on
   * `usePhoneShell` so the phone shell can mount the date overlay.
   * No-op if the run is missing, closed, or the candidate is not a
   * current match.
   */
  startDate: (candidateId: CandidateId) => Promise<void>;
  /**
   * Clear the date checkpoint. Called when the player either completes
   * the scene normally or cuts it short. The phone shell unmounts the
   * date overlay separately via its own state.
   */
  endDate: () => Promise<void>;
  /**
   * Reset the per-session "new facts captured since the player last
   * opened the Journal" counter back to zero. The phone-home shell
   * fires this whenever the player opens the Journal app surface so
   * the home-grid badge clears the moment the player engages with it.
   */
  markJournalVisited: () => void;
  /**
   * Idempotent — pushes the opening suspect turn for a thread that the
   * player has never opened. Safe to call on every focus.
   */
  openThread: (threadId: ThreadId) => Promise<void>;
  /**
   * Records a player reply and pushes the next scripted suspect turn (if
   * any). Returns the updated thread.
   *
   * For non-killer threads that just consumed the final scripted turn,
   * this also flips `improvPending = true` so the UI knows to fetch the
   * first improv reply via `requestImprovTurn`.
   */
  sendReply: (
    threadId: ThreadId,
    replyText: string,
  ) => Promise<ChatThread | null>;
  /**
   * Task #58 — fetch the next improv suspect turn for a thread that has
   * exhausted its scripted tree (or has just been picked from after the
   * tree ended). Pushes the suspect lines into the transcript and stages
   * three reply options on `thread.improvReplyOptions`. Idempotent: a
   * second call while one is already in flight is a no-op. Returns the
   * updated thread, or null on failure (with `improvError = true`).
   */
  requestImprovTurn: (threadId: ThreadId) => Promise<ChatThread | null>;
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
   * Task #10.2 — attempt to build an evidence chain by linking two
   * committed facts. Validated against chain definitions from
   * `content.json`. Returns the built chain on success, null if the
   * link isn't a valid chain (wrong pair, already built, etc).
   */
  buildChain: (factIdA: FactId, factIdB: FactId) => Promise<EvidenceChain | null>;
  /**
   * Task #10.3 — write or clear a player's free-form note on a fact.
   * Idempotent — calling with an empty string clears the note.
   */
  updateFactNote: (factId: FactId, note: string) => Promise<void>;
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
  /**
   * Task #9 — mark a voicemail as listened. Fires when the player opens
   * the voicemail detail view. Idempotent — re-calling on an already-listened
   * voicemail is a no-op.
   */
  markVmListened: (voicemailId: string) => Promise<void>;
  /**
   * Task #9 — spend one phone credit to initiate an outgoing call to a
   * friend. Deducts from the appropriate budget and triggers a dialogue
   * tree. No-op if the budget is already zero for that friend.
   */
  makeFriendCall: (friend: FriendID) => Promise<void>;
  resetRun: () => Promise<void>;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Probability that a non-story / pure-decoy candidate reciprocates a
 * like once `advanceDay()` resolves the overnight queue. Chosen at 60%
 * so most likes still pay off — the swipe deck still feels generous —
 * while leaving enough quiet "no reply" outcomes to make a match feel
 * earned once the future "wider city pool" of pure decoys lands.
 *
 * Story candidates (the killer plus the four authored `decoyPool`
 * decoys today, anyone with `isStoryCandidate !== false` tomorrow)
 * are unaffected by this — they always reciprocate.
 */
export const DECOY_RECIPROCATION_PROBABILITY = 0.6;

/**
 * 32-bit FNV-1a — same flavour as `core/decoyPool.ts`. Inlined here
 * (rather than imported) so the like-resolver doesn't take a dep on
 * the deck-pool module just to seed a decision.
 */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Deterministic "does this pure-decoy candidate reciprocate?" decision.
 *
 * Seeded with `runId + candidateId` so the answer is stable across
 * cold starts — a player who quits mid-night and comes back to Sleep
 * later sees the same outcome they would have seen pressing Sleep
 * immediately. The threshold defaults to
 * `DECOY_RECIPROCATION_PROBABILITY`; the parameter is exposed so
 * tests can probe edge values (0/1) without monkey-patching the const.
 *
 * Used only for candidates with `isStoryCandidate === false`. Story
 * candidates skip this entirely — they always match back.
 */
export function decideDecoyReciprocation(
  runId: RunId,
  candidateId: CandidateId,
  threshold: number = DECOY_RECIPROCATION_PROBABILITY,
): boolean {
  const seed = fnv1a32(`catfish:like-match-back:v1:${runId}:${candidateId}`);
  // Fold the 32-bit hash into the unit interval. Dividing by 2^32
  // keeps the ratio in [0, 1) so a `threshold` of 0 always passes
  // (no candidate reciprocates) and a `threshold` of 1 always matches
  // (every candidate reciprocates) — useful for the test harness.
  const ratio = seed / 0x1_0000_0000;
  return ratio < threshold;
}

function pickRandomKiller(): KillerIdentity {
  const idx = Math.floor(Math.random() * ALL_KILLERS.length);
  return ALL_KILLERS[idx]!;
}

function buildRun(forced?: KillerIdentity): CaseRun {
  const killer = forced ?? pickRandomKiller();
  const identity = getIdentityModule(killer);
  const runId = newRunId();
  // Pass 4 — materialize the authored fact universe up front so the
  // rest of the store sees a single homogeneous `facts` array.
  // Captured Facts (Pass 3 long-press extracts) are appended later
  // via `commitFact` and coexist with these by `kind`.
  const authoredFacts = buildAuthoredFacts(runId, killer);
  return {
    id: runId,
    killer,
    startedAt: nowIso(),
    day: 1,
    deck: identity.buildDeck(),
    deckCursor: 0,
    swipes: [],
    matches: [],
    threads: [],
    facts: authoredFacts,
    pendingLikes: [],
    pendingMatchAnnouncements: [],
    closed: false,
    ending: null,
    usedInnocentScriptIds: [],
    earlyRevealedFactIds: [],
  };
}

/**
 * Forward-compatible coercion for runs persisted before Pass 2 widened the
 * thread schema. Old threads stored `messages: unknown[]` (always empty)
 * and had no `turnIndex`. We patch them in-place on load so the rest of
 * the store can assume the new shape.
 */
export function migrateRun(run: CaseRun | null): CaseRun | null {
  if (!run) return null;
  const threads = run.threads.map((t) => {
    const rawMessages = Array.isArray(t.messages) ? t.messages : [];
    const messages: Message[] = (rawMessages as unknown[])
      .filter(
        (m): m is Record<string, unknown> =>
          !!m &&
          typeof m === "object" &&
          (m as Message).id != null &&
          (m as Message).text != null &&
          ((m as Message).sender === "suspect" ||
            (m as Message).sender === "player"),
      )
      .map((m) => {
        const msg = m as unknown as Message;
        return { ...msg, id: String(msg.id), text: String(msg.text) };
      });
    const rawTurnIndex = Number((t as ChatThread).turnIndex);
    const turnIndex = Number.isNaN(rawTurnIndex) ? 0 : Math.floor(rawTurnIndex);
    const rawUnreadCount = Number((t as ChatThread).unreadCount);
    const unreadCount =
      Number.isNaN(rawUnreadCount) || rawUnreadCount < 0
        ? 0
        : Math.floor(rawUnreadCount);
    // Task #58 — preserve the innocent-tree assignment + improv state
    // for threads that already had them; legacy threads without these
    // fields stay undefined and fall back to INNOCENT_SCRIPT.
    const tt = t as ChatThread;
    const coercedScriptId =
      tt.innocentScriptId != null ? String(tt.innocentScriptId) : "";
    const innocentScriptId =
      coercedScriptId.length > 0 ? coercedScriptId : undefined;
    const improvReplyOptions = Array.isArray(tt.improvReplyOptions)
      ? tt.improvReplyOptions
          .filter((opt) => opt != null)
          .map((opt) => String(opt))
      : undefined;
    // `improvPending` never persists across cold starts — a request
    // that was in flight when the app was killed cannot be resumed,
    // so we drop the flag and let the player tap to refetch.
    const improvError = tt.improvError ? !!tt.improvError : undefined;

    // Task #62 — flush any in-flight typing-delay queue immediately on
    // cold start. The setTimeout chain that would have drained it is
    // gone with the dead JS context, and silently dropping the lines
    // would lose narrative beats the player has already "earned" by
    // sending the reply that triggered them. So we land every queued
    // line into the transcript right now and apply the cumulative
    // postDelivery effects (turnIndex bump, improv reply unlock).
    const rawQueue = Array.isArray(tt.pendingSuspectQueue)
      ? tt.pendingSuspectQueue
      : [];
    let flushedMessages = messages;
    let flushedTurnIndex = turnIndex;
    let flushedImprovReplyOptions = improvReplyOptions;
    let flushedUnreadCount = unreadCount;
    if (rawQueue.length > 0) {
      const flushedExtras: Message[] = [];
      for (const raw of rawQueue) {
        if (
          !raw ||
          typeof raw !== "object" ||
          (raw as PendingSuspectLine).id == null ||
          (raw as PendingSuspectLine).text == null
        ) {
          continue;
        }
        const line = raw as PendingSuspectLine;
        flushedExtras.push({
          id: String(line.id),
          sender: "suspect",
          text: String(line.text),
          sentAt: nowIso(),
          beatKey: line.beatKey != null ? String(line.beatKey) : undefined,
        });
        if (line.postDelivery) {
          if (line.postDelivery.advanceTurnIndexBy) {
            flushedTurnIndex =
              flushedTurnIndex + line.postDelivery.advanceTurnIndexBy;
          }
          if (line.postDelivery.setImprovReplyOptions !== undefined) {
            flushedImprovReplyOptions = line.postDelivery.setImprovReplyOptions;
          }
        }
      }
      flushedMessages = [...messages, ...flushedExtras];
      // Honor the "unread bumps when a line lands" invariant — the
      // cold-start flush is a delivery, just an instantaneous one.
      // ThreadView's markThreadRead effect will clear the badge the
      // moment the player focuses this thread, so an actively-viewed
      // thread doesn't stay stuck on a stale count.
      flushedUnreadCount = unreadCount + flushedExtras.length;
    }

    return {
      ...t,
      messages: flushedMessages,
      turnIndex: flushedTurnIndex,
      unreadCount: flushedUnreadCount,
      innocentScriptId,
      improvReplyOptions: flushedImprovReplyOptions,
      improvPending: false,
      improvError,
      pendingSuspectQueue: undefined,
    } satisfies ChatThread;
  });

  // Audit fix — scrub the legacy decoy-identity stamp from any deck
  // row that isn't the killer-candidate. Pre-fix builds wrote
  // `identity: <killer>` onto every decoy, which (a) collapsed the
  // AccusationSheet selection model and (b) made every accusation
  // auto-resolve as `caughtThem`. The new code keeps `identity`
  // strictly opt-in for killer-candidates, so the safe move on a
  // cold start is to drop any stray slot from a non-killer row even
  // if the persisted blob still has one.
  const deck = run.deck.map((c) =>
    c.isKillerCandidate ? c : { ...c, identity: undefined },
  );

  // Use the post-scrub deck when reasoning about the source candidate
  // for a captured fact — so legacy captures from decoys correctly
  // see `isKillerCandidate === false` and drop their stale
  // `aboutCharacter` stamp during migration.
  const runForFactMigration: CaseRun = { ...run, deck };

  // Pass 4 — backfill the new Clue Graph fields onto pre-schema Fact
  // rows so cold start of an in-flight run can't crash on a missing
  // `kind`/`source`/`day`/`aboutCharacter`/`payload`. We do *not*
  // retroactively inject authored facts here — those only land via
  // `startNewRun`, per the task spec, so an in-flight run keeps the
  // exact captured-facts list it had before the upgrade.
  const facts: Fact[] = run.facts.map((f) =>
    migrateFact(f, runForFactMigration),
  );

  // Task #29 — default the like-then-match queues so runs persisted
  // before this field landed continue to load. An in-flight run that
  // already has matches keeps them; only the new `pendingLikes` /
  // `pendingMatchAnnouncements` queues are filled in.
  const pendingLikes: LikeRecord[] = Array.isArray(run.pendingLikes)
    ? (run.pendingLikes as unknown[])
        .filter(
          (l): l is Record<string, unknown> =>
            !!l &&
            typeof l === "object" &&
            (l as LikeRecord).candidateId != null &&
            (l as LikeRecord).at != null &&
            ((l as LikeRecord).status === "pending" ||
              (l as LikeRecord).status === "matched" ||
              (l as LikeRecord).status === "passed"),
        )
        .map((l) => {
          const lr = l as unknown as LikeRecord;
          const rawDay = Number(lr.day);
          return {
            ...lr,
            candidateId: String(lr.candidateId),
            day: Number.isNaN(rawDay) ? 0 : rawDay,
            at: String(lr.at),
          };
        })
    : [];
  const pendingMatchAnnouncements: MatchId[] = Array.isArray(
    run.pendingMatchAnnouncements,
  )
    ? run.pendingMatchAnnouncements
        .filter((id) => id != null)
        .map((id) => String(id) as MatchId)
    : [];

  // Task #58 — backfill the per-run check-out set. Anything a thread
  // already claims gets reflected here even if the persisted run
  // pre-dates the field, so two innocent matches still can't collide
  // after a cold start.
  const persistedUsed = Array.isArray(run.usedInnocentScriptIds)
    ? run.usedInnocentScriptIds
        .filter((id) => id != null)
        .map((id) => String(id))
    : [];
  // Safe: innocentScriptId values are already coerced to string | undefined
  // by the thread migration above, so the typeof narrowing here cannot
  // silently drop a truthy non-string value.
  const claimedFromThreads = threads
    .map((t) => t.innocentScriptId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const usedInnocentScriptIds = Array.from(
    new Set<string>([...persistedUsed, ...claimedFromThreads]),
  );

  // Task #68 — coerce `endingDismissed` to a strict boolean so a
  // malformed persisted blob (legacy save with the field absent, or
  // a corrupted truthy non-boolean) can never wedge the End-of-Run
  // overlay's visibility gate. Default for legacy runs is `false`
  // (overlay shows whenever `closed && ending` is set), which matches
  // the pre-#68 semantics for any save that still has an `ending`.
  const endingDismissed = !!run.endingDismissed;

  // Task #71 — apply the same strict-boolean coercion to `closed`.
  // A corrupted save could set `closed` to a truthy non-boolean
  // (e.g. `"true"` or `1`) and break downstream `=== true` checks.
  const closed = !!run.closed;

  const rawDay = Number(run.day);
  const day = Number.isNaN(rawDay) || rawDay < 1 ? 1 : Math.floor(rawDay);

  const rawDeckCursor = Number(run.deckCursor);
  const deckCursor =
    Number.isNaN(rawDeckCursor) || rawDeckCursor < 0
      ? 0
      : Math.floor(rawDeckCursor);

  return {
    ...run,
    day,
    deckCursor,
    deck,
    threads,
    facts,
    pendingLikes,
    pendingMatchAnnouncements,
    usedInnocentScriptIds,
    endingDismissed,
    closed,
    // Task #10.2 — default evidenceChains for runs persisted before
    // the field existed.
    evidenceChains: Array.isArray(run.evidenceChains)
      ? run.evidenceChains.filter(
          (c): c is EvidenceChain =>
            !!c &&
            typeof c === "object" &&
            typeof c.id === "string" &&
            typeof c.factIdA === "string" &&
            typeof c.factIdB === "string",
        )
      : [],
    // Default the early-reveal set for runs persisted before progressive
    // clue reveal landed. Empty array means the player hasn't earned
    // any date-revealed facts yet; the journal still shows everything
    // the day+source gate naturally lets through.
    earlyRevealedFactIds: Array.isArray(run.earlyRevealedFactIds)
      ? run.earlyRevealedFactIds
          .filter((id): id is string => typeof id === "string")
      : [],
  };
}

/**
 * Backfill missing Clue Graph fields on a single Fact row. Pre-schema
 * captured Facts only carried `payloadJson` plus the `captured*`
 * fields; this fills in `kind`, `source`, `day`, `aboutCharacter`,
 * and `payload` so the rest of the store can assume the new shape.
 */
function migrateFact(raw: Fact, run: CaseRun): Fact {
  const f = raw as Partial<Fact> & Fact;

  // `kind` — old rows had no kind at all. They were always captured
  // facts (the only ones the Pass 3 store could produce), so default
  // to "captured" for anything missing.
  const kind: Fact["kind"] =
    f.kind === "static" ||
    f.kind === "variable" ||
    f.kind === "conditional" ||
    f.kind === "captured"
      ? f.kind
      : "captured";

  // `source` — reconstruct from the `captured*` breadcrumbs when
  // possible, fall back to a chatMessage row with no ids.
  let source: FactSource;
  if (
    f.source &&
    typeof f.source === "object" &&
    typeof (f.source as { kind?: unknown }).kind === "string"
  ) {
    source = f.source;
  } else if (kind === "captured") {
    source = {
      kind: "chatMessage",
      messageId: f.capturedFromMessageId,
    };
  } else {
    // Authored row without a source — degrade to a narrator beat so
    // we don't drop the row, but log via the comment so a future
    // pass can investigate.
    source = { kind: "narratorBeat" };
  }

  const rawFactDay =
    typeof f.day === "number"
      ? f.day
      : typeof f.capturedOnDay === "number"
        ? f.capturedOnDay
        : run.day;
  const day: number = Math.floor(rawFactDay);

  // `aboutCharacter` — for an authored fact this is always set on the
  // raw row and we honor it verbatim. For a captured fact, only the
  // killer-candidate carries an `identity`, so we leave the field
  // undefined when the source candidate is a decoy — even if the
  // legacy persisted row has a stale `aboutCharacter: <killer>` stamp
  // from the pre-fix builds (where every decoy shared the killer's
  // slot). Per-suspect grouping in the journal / AccusationSheet
  // keys off `capturedFromCandidateId` instead, so dropping the stale
  // stamp is the consistent move.
  let aboutCharacter: Fact["aboutCharacter"];
  if (kind === "captured" && f.capturedFromCandidateId) {
    const cand = run.deck.find((c) => c.id === f.capturedFromCandidateId);
    aboutCharacter = cand?.isKillerCandidate ? cand.identity : undefined;
  } else if (f.aboutCharacter) {
    aboutCharacter = f.aboutCharacter;
  } else if (f.capturedFromCandidateId) {
    // Captured fact whose source candidate has been removed from the
    // deck — can't tell if it was a decoy or the killer-candidate, so
    // drop the field rather than guess.
    aboutCharacter = undefined;
  } else {
    aboutCharacter = undefined;
  }

  // `payload` — prefer the typed field, else lift the captured
  // quote, else parse the legacy JSON. Always end up with at least
  // `text: ""` so callers never have to null-check.
  let payload: FactPayload;
  if (f.payload && typeof f.payload === "object" && "text" in f.payload) {
    payload = f.payload;
  } else if (typeof f.capturedQuote === "string") {
    payload = { text: f.capturedQuote };
  } else if (typeof f.payloadJson === "string") {
    try {
      const parsed = JSON.parse(f.payloadJson) as { quote?: string };
      payload = { text: typeof parsed?.quote === "string" ? parsed.quote : "" };
    } catch {
      payload = { text: "" };
    }
  } else {
    payload = { text: "" };
  }

  const payloadJson =
    typeof f.payloadJson === "string"
      ? f.payloadJson
      : JSON.stringify(payload);

  return {
    ...f,
    kind,
    source,
    day,
    aboutCharacter,
    payload,
    payloadJson,
  };
}

let hydrationPromise: Promise<void> | null = null;

/**
 * AsyncStorage key for the voice-mute preference. Versioned so a
 * future "v2" with a richer audio prefs object can migrate from
 * the boolean shape without losing the player's choice.
 */
const VOICE_MUTED_KEY = "catfish/prefs/voice_muted/v1";
const SFX_MUTED_KEY = "catfish/prefs/sfx_muted/v1";
const MUSIC_MUTED_KEY = "catfish/prefs/music_muted/v1";
const SCANLINES_KEY = "catfish/prefs/scanlines/v1";
const SCREEN_SHAKE_KEY = "catfish/prefs/screen_shake/v1";
const REDUCE_MOTION_KEY = "catfish/prefs/reduce_motion/v1";
const HIGH_CONTRAST_KEY = "catfish/prefs/high_contrast/v1";
const BGM_VOLUME_KEY = "catfish/prefs/bgm_volume/v1";
const SFX_VOLUME_KEY = "catfish/prefs/sfx_volume/v1";
const VOICE_VOLUME_KEY = "catfish/prefs/voice_volume/v1";
const AMBIENCE_VOLUME_KEY = "catfish/prefs/ambience_volume/v1";
/**
 * AsyncStorage row for the parody mini-game high scores. Versioned
 * (`/v1`) so a future schema change (e.g. per-day Wordle history,
 * leaderboards) can migrate forward without losing today's scores.
 */
const PARODY_SCORES_KEY = "catfish/prefs/parody/v1";
/**
 * AsyncStorage row for the parody session snapshots — Task #44.
 * Separate from `PARODY_SCORES_KEY` so a session-snapshot write (much
 * more frequent: per-swap in Sugar Coat, per-pillar in Ego Trip)
 * doesn't rewrite the high-score blob on every keystroke.
 */
const PARODY_SESSIONS_KEY = "catfish/prefs/parody-session/v1";

async function loadBoolPref(key: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === "1";
  } catch {
    return false;
  }
}

async function saveBoolPref(key: string, value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Persistence failure is non-fatal — the in-memory toggle still
    // works for the rest of the session.
  }
}

async function loadFloatPref(key: string, fallback: number): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    const v = parseFloat(raw);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
  } catch {
    return fallback;
  }
}

async function saveFloatPref(key: string, value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(key, String(Math.max(0, Math.min(1, value))));
  } catch {
    // Persistence failure is non-fatal.
  }
}

async function loadVoiceMuted(): Promise<boolean> {
  return loadBoolPref(VOICE_MUTED_KEY);
}

async function saveVoiceMuted(muted: boolean): Promise<void> {
  await saveBoolPref(VOICE_MUTED_KEY, muted);
}

/**
 * Load the parody score blob, defaulting any missing field to 0 so a
 * forward-compatible new game added in a future task can hydrate
 * cleanly without dropping the existing scores.
 */
async function loadParodyScores(): Promise<ParodyScores> {
  try {
    const raw = await AsyncStorage.getItem(PARODY_SCORES_KEY);
    if (!raw) return { ...EMPTY_PARODY_SCORES };
    const parsed = JSON.parse(raw) as Partial<ParodyScores>;
    return {
      wordLowBestStreak: clampNonNegInt(parsed.wordLowBestStreak),
      safeSpotBestWave: clampNonNegInt(parsed.safeSpotBestWave),
      egoTripHighScore: clampNonNegInt(parsed.egoTripHighScore),
      sugarCoatHighClout: clampNonNegInt(parsed.sugarCoatHighClout),
    };
  } catch {
    return { ...EMPTY_PARODY_SCORES };
  }
}

/**
 * Tail of the in-flight parody-score write chain. Every save links
 * onto this promise so two writes can never overlap on disk —
 * `flushParodyScores` always waits for the prior link to finish before
 * serializing and writing the next one.
 *
 * Exported (test-only) via `__getParodyWriteChain` so the regression
 * test can `await` a settled chain instead of racing the event loop.
 */
let parodyWriteChain: Promise<void> = Promise.resolve();

/**
 * Serialize a parody-score persist. Two saves can never overlap —
 * each link waits for the prior write to settle, then snapshots the
 * latest in-memory `parody` slice via `getLatest` *right before*
 * stringifying. That late read is the safety net: if a second
 * `recordParodyScore` updated the store while an earlier write was
 * still in flight, the earlier write's link picks up the merged
 * state when it finally runs, so no field can be silently overwritten
 * by a stale snapshot.
 *
 * Per-link `try`/`catch` keeps a single failed write from poisoning
 * subsequent saves; the chain itself swallows rejections for the
 * same reason.
 */
function flushParodyScores(
  getLatest: () => ParodyScores,
): Promise<void> {
  const next = parodyWriteChain.then(async () => {
    const snapshot = getLatest();
    try {
      await AsyncStorage.setItem(
        PARODY_SCORES_KEY,
        JSON.stringify(snapshot),
      );
    } catch {
      // Persistence failure is non-fatal — the in-memory score still
      // shows the new high until the next cold start.
    }
  });
  parodyWriteChain = next.catch(() => undefined);
  return next;
}

/**
 * Test-only handle to the parody-write chain so the regression
 * harness can wait for every queued save to settle before
 * inspecting the on-disk blob. Not part of the public store API.
 */
export function __getParodyWriteChain(): Promise<void> {
  return parodyWriteChain;
}

/**
 * Same write-chain pattern as `flushParodyScores`, but for the
 * session-snapshot blob. Independent chain (instead of multiplexing
 * onto `parodyWriteChain`) so a long-running session save can't
 * delay a high-score persist and vice-versa.
 */
let parodySessionWriteChain: Promise<void> = Promise.resolve();

/**
 * Result shape for `loadParodySessions`. `needsRewrite` is set when the
 * on-disk blob carried a same-day-gated snapshot (Safe Spot, Ego Trip,
 * or Sugar Coat) that the parser dropped because its `dateKey` no
 * longer matches today (or the slot was structurally malformed). When
 * true, `hydrate` immediately persists the cleaned `parsed` slice so
 * the disk row stops carrying stale data forward indefinitely.
 *
 * WordLow's `wordLowStreak` is not date-gated, so it never triggers a
 * rewrite on its own — and the post-hydrate flush still re-serializes
 * the current streak verbatim, so the field is preserved.
 */
interface LoadedParodySessions {
  parsed: ParodySessions;
  needsRewrite: boolean;
}

async function loadParodySessions(): Promise<LoadedParodySessions> {
  try {
    const raw = await AsyncStorage.getItem(PARODY_SESSIONS_KEY);
    if (!raw) return { parsed: { ...EMPTY_PARODY_SESSIONS }, needsRewrite: false };
    const obj = JSON.parse(raw) as unknown;
    const parsed = parseParodySessions(obj);
    // Detect stale rows: any of the three same-day-gated slots that
    // had data on disk but the parser dropped to null. This catches
    // both the routine case (yesterday's blob) and the rare malformed
    // snapshot — either way the disk row is out of sync with what the
    // store is now serving, so we tell the caller to rewrite.
    const r =
      obj && typeof obj === "object"
        ? (obj as Partial<ParodySessions>)
        : ({} as Partial<ParodySessions>);
    const needsRewrite =
      (r.safeSpot != null && parsed.safeSpot === null) ||
      (r.egoTrip != null && parsed.egoTrip === null) ||
      (r.sugarCoat != null && parsed.sugarCoat === null);
    return { parsed, needsRewrite };
  } catch {
    return { parsed: { ...EMPTY_PARODY_SESSIONS }, needsRewrite: false };
  }
}

function flushParodySessions(getLatest: () => ParodySessions): Promise<void> {
  const next = parodySessionWriteChain.then(async () => {
    const snapshot = getLatest();
    try {
      await AsyncStorage.setItem(
        PARODY_SESSIONS_KEY,
        JSON.stringify(snapshot),
      );
    } catch {
      // Persistence failure is non-fatal — the in-memory snapshot still
      // serves the active app session.
    }
  });
  parodySessionWriteChain = next.catch(() => undefined);
  return next;
}

/**
 * Test-only handle to the parody-session write chain so the regression
 * harness can wait for every queued save to settle before inspecting
 * the on-disk blob. Mirrors `__getParodyWriteChain`.
 */
export function __getParodySessionWriteChain(): Promise<void> {
  return parodySessionWriteChain;
}

/**
 * Test-only escape hatch that clears the one-shot hydration promise so
 * a single Node process can simulate multiple cold starts in sequence
 * (the production runtime hydrates exactly once per app launch). Used
 * by the parody-session regression suite to verify that `hydrate()`
 * rewrites a stale on-disk blob.
 */
export function __resetHydrationForTests(): void {
  hydrationPromise = null;
}

function clampNonNegInt(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return 0;
  return Math.floor(v);
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

// ─── Task #62: humanized suspect typing-delay scheduling ─────────────
//
// Suspect lines no longer land synchronously. Each thread carries a
// `pendingSuspectQueue` of lines that the UI surfaces as an animated
// "is typing…" indicator; this module-level Map of timeouts drains
// the queue one line at a time on a randomized delay so multiple
// lines from one suspect can never appear in the same frame. Lives
// outside Zustand state for the same reason `discardClearTimers`
// does — timers are pure side effect and don't belong in serialized
// state. Per-thread keying lets unmatch / cold start cancel one
// thread without disturbing others.

const suspectDeliveryTimers = new Map<
  ThreadId,
  ReturnType<typeof setTimeout>
>();

/** 2–6 seconds — the per-line "typing" beat. */
const SUSPECT_DELAY_MIN_MS = 2_000;
const SUSPECT_DELAY_MAX_MS = 6_000;
/**
 * Task #63 — scale the typing beat by the line's character count so a
 * one-word retort doesn't sit behind the same delay as a paragraph.
 * 35ms/char puts the floor (~2s) at roughly a 57-char line and the
 * ceiling (~6s) at roughly 171 chars, which lines up with how long the
 * typing indicator used to drag on for those lengths anyway.
 */
const SUSPECT_DELAY_PER_CHAR_MS = 35;
/**
 * Symmetric jitter applied on top of the length-derived beat so even
 * lines that clamp to the floor/ceiling don't fire at the exact same
 * millisecond every time. Re-clamped after to preserve the 2–6s
 * contract.
 */
const SUSPECT_DELAY_JITTER_MS = 500;

function nextSuspectDelayMs(text?: string): number {
  const len = text?.length ?? 0;
  const perChar = SUSPECT_DELAY_PER_CHAR_MS * len;
  // Hold the per-character estimate inside the 2–6s window before
  // jitter so we don't accidentally schedule a 50ms or 12s beat for
  // pathological inputs.
  const clamped = Math.max(
    SUSPECT_DELAY_MIN_MS,
    Math.min(SUSPECT_DELAY_MAX_MS, perChar),
  );
  const jitter =
    Math.floor(Math.random() * (SUSPECT_DELAY_JITTER_MS * 2 + 1)) -
    SUSPECT_DELAY_JITTER_MS;
  // Re-clamp so jitter can't push us past the boundary, but the
  // boundary itself still gets a little wiggle from the additive
  // term (e.g. a "lol" lands somewhere in 2.0–2.5s rather than at a
  // dead-on 2000ms every time).
  return Math.max(
    SUSPECT_DELAY_MIN_MS,
    Math.min(SUSPECT_DELAY_MAX_MS, clamped + jitter),
  );
}

/**
 * Test-only re-export so `scripts/test-typing-delay.mts` can assert
 * the floor/ceiling/jitter math without going through the full
 * scheduleSuspectDelivery side-effect path.
 */
export const __nextSuspectDelayMsForTests = nextSuspectDelayMs;
export const __SUSPECT_DELAY_MIN_MS_FOR_TESTS = SUSPECT_DELAY_MIN_MS;
export const __SUSPECT_DELAY_MAX_MS_FOR_TESTS = SUSPECT_DELAY_MAX_MS;
export const __SUSPECT_DELAY_PER_CHAR_MS_FOR_TESTS = SUSPECT_DELAY_PER_CHAR_MS;
export const __SUSPECT_DELAY_JITTER_MS_FOR_TESTS = SUSPECT_DELAY_JITTER_MS;

function cancelSuspectDeliveryTimer(threadId: ThreadId): void {
  const t = suspectDeliveryTimers.get(threadId);
  if (t) {
    clearTimeout(t);
    suspectDeliveryTimers.delete(threadId);
  }
}

function cancelAllSuspectDeliveryTimers(): void {
  for (const t of suspectDeliveryTimers.values()) {
    clearTimeout(t);
  }
  suspectDeliveryTimers.clear();
}

/**
 * Schedule the next queued suspect line for `threadId` to land after
 * a randomized 2-6 second delay. Cancels any existing timer for the
 * same thread first so concurrent callers (e.g. a fresh script turn
 * landing on top of an in-flight improv burst) don't race.
 */
function scheduleSuspectDelivery(
  threadId: ThreadId,
  set: (
    partial:
      | Partial<GameStateValue>
      | ((state: GameStateValue) => Partial<GameStateValue>),
  ) => void,
  get: () => GameStateValue,
): void {
  cancelSuspectDeliveryTimer(threadId);
  // Task #63 — peek at the next queued line so the typing beat can
  // scale to its length. Falls back to the unscaled floor when the
  // queue is unexpectedly empty (defensive; deliverNextSuspectLine
  // also no-ops in that case).
  const cur = get().run;
  const thread = cur?.threads.find((x) => x.id === threadId);
  const headText = thread?.pendingSuspectQueue?.[0]?.text;
  const handle = setTimeout(() => {
    suspectDeliveryTimers.delete(threadId);
    void deliverNextSuspectLine(threadId, set, get);
  }, nextSuspectDelayMs(headText));
  suspectDeliveryTimers.set(threadId, handle);
}

/**
 * Pop the head of `pendingSuspectQueue`, append it as a real Message,
 * apply its `postDelivery` effects (turnIndex bump, improv reply
 * unlock), persist, and chain another timer if more lines remain.
 *
 * Defensively bails when:
 *   - the run has changed or closed since the timer was scheduled
 *   - the thread has been unmatched (queue is dropped silently)
 *   - the queue has already been drained by another path (cold-start
 *     flush, manual cancel)
 */
async function deliverNextSuspectLine(
  threadId: ThreadId,
  set: (
    partial:
      | Partial<GameStateValue>
      | ((state: GameStateValue) => Partial<GameStateValue>),
  ) => void,
  get: () => GameStateValue,
): Promise<void> {
  const cur = get().run;
  if (!cur || cur.closed) return;
  const t = cur.threads.find((x) => x.id === threadId);
  if (!t) return;
  const queue = t.pendingSuspectQueue ?? [];
  if (queue.length === 0) return;

  // Suspect was dropped while typing — silently discard the queue.
  // No new transcript noise from a relationship the player has
  // explicitly ended.
  const match = cur.matches.find((m) => m.threadId === threadId);
  if (match?.unmatched) {
    const cleared: ChatThread = { ...t, pendingSuspectQueue: undefined };
    const next: CaseRun = {
      ...cur,
      threads: cur.threads.map((x) => (x.id === threadId ? cleared : x)),
    };
    set({ run: next });
    await saveActiveRun(next);
    return;
  }

  const [head, ...rest] = queue;
  const landed: Message = {
    id: head.id,
    sender: "suspect",
    text: head.text,
    sentAt: nowIso(),
    beatKey: head.beatKey,
  };

  let turnIndex = t.turnIndex;
  let improvReplyOptions = t.improvReplyOptions;
  if (head.postDelivery) {
    if (head.postDelivery.advanceTurnIndexBy) {
      turnIndex = turnIndex + head.postDelivery.advanceTurnIndexBy;
    }
    if (head.postDelivery.setImprovReplyOptions !== undefined) {
      improvReplyOptions = head.postDelivery.setImprovReplyOptions;
    }
  }

// Bump every player message currently at "sent" → "delivered".
    // The player sees all their prior messages flip from a single-tick
    // to a double-tick at the same time the suspect bubble lands.
    const bumpedMessages = t.messages.map((m) =>
      m.sender === "player" && m.status === "sent"
        ? { ...m, status: "delivered" as const }
        : m,
    );

    const updatedThread: ChatThread = {
      ...t,
      messages: [...bumpedMessages, landed],
      unreadCount: t.unreadCount + 1,
      pendingSuspectQueue: rest.length > 0 ? rest : undefined,
      turnIndex,
      improvReplyOptions,
    };
  const next: CaseRun = {
    ...cur,
    threads: cur.threads.map((x) => (x.id === threadId ? updatedThread : x)),
  };
  set({ run: next });
  await saveActiveRun(next);

  if (rest.length > 0) {
    scheduleSuspectDelivery(threadId, set, get);
  }
}

/**
 * Turn a list of authored/generated suspect line strings into queued
 * `PendingSuspectLine` entries, optionally stamping `postDelivery`
 * effects onto the *last* line. Centralized so the openThread,
 * sendReply, and improv paths agree on how multi-line bursts are
 * shaped.
 */
function queueSuspectLines(
  texts: readonly string[],
  beatKey: string | undefined,
  lastPostDelivery?: PendingSuspectLine["postDelivery"],
): PendingSuspectLine[] {
  if (texts.length === 0) return [];
  return texts.map((text, i, arr) => ({
    id: newMessageId(),
    text,
    beatKey,
    postDelivery: i === arr.length - 1 ? lastPostDelivery : undefined,
  }));
}

export const useGameState = create<GameStateValue>((set, get) => ({
  hydrated: false,
  run: null,
  voiceMuted: false,
  sfxMuted: false,
  musicMuted: false,
  bgmVolume: 0.32,
  sfxVolume: 0.85,
  voiceVolume: 0.9,
  ambienceVolume: 0.25,
  scanlinesEnabled: true,
  screenShakeEnabled: true,
  reduceMotionEnabled: false,
  highContrastTextEnabled: false,
  recentlyDiscarded: [],
  journalNewSinceLastVisit: 0,
  parody: { ...EMPTY_PARODY_SCORES },
  parodySessions: { ...EMPTY_PARODY_SESSIONS },
  runArchive: [],

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async () => {
      // Load run + audio prefs in parallel — they live in different
      // AsyncStorage rows and have no ordering dependency.
      const [
        existing,
        voiceMuted,
        sfxMuted,
        musicMuted,
        bgmVolume,
        sfxVolume,
        voiceVolume,
        ambienceVolume,
        scanlinesEnabled,
        screenShakeEnabled,
        reduceMotionEnabled,
        highContrastTextEnabled,
        parody,
        sessionsLoaded,
        runArchive,
      ] = await Promise.all([
        loadActiveRun().then(migrateRun),
        loadVoiceMuted(),
        loadBoolPref(SFX_MUTED_KEY),
        loadBoolPref(MUSIC_MUTED_KEY),
        loadFloatPref(BGM_VOLUME_KEY, 0.32),
        loadFloatPref(SFX_VOLUME_KEY, 0.85),
        loadFloatPref(VOICE_VOLUME_KEY, 0.9),
        loadFloatPref(AMBIENCE_VOLUME_KEY, 0.25),
        loadBoolPref(SCANLINES_KEY),
        loadBoolPref(SCREEN_SHAKE_KEY),
        loadBoolPref(REDUCE_MOTION_KEY),
        loadBoolPref(HIGH_CONTRAST_KEY),
        loadParodyScores(),
        loadParodySessions(),
        loadRunArchive(),
      ]);
      // Cold-start invariant: undo state is in-memory only, so a
      // dangling stash from a prior process is impossible. Still,
      // explicitly clearing here documents the contract.
      cancelAllDiscardTimers();
      // Same contract for the typing-delay timers — `migrateRun`
      // already flushed every persisted suspect queue into the
      // transcript above, so nothing should still be due to fire,
      // but documenting the cold-start clear keeps the invariant
      // obvious.
      cancelAllSuspectDeliveryTimers();
      set({
        run: existing,
        hydrated: true,
        voiceMuted,
        sfxMuted,
        musicMuted,
        bgmVolume,
        sfxVolume,
        voiceVolume,
        ambienceVolume,
        scanlinesEnabled: scanlinesEnabled ?? true,
        screenShakeEnabled: screenShakeEnabled ?? true,
        reduceMotionEnabled: reduceMotionEnabled ?? false,
        highContrastTextEnabled: highContrastTextEnabled ?? false,
        recentlyDiscarded: [],
        parody,
        parodySessions: sessionsLoaded.parsed,
        runArchive,
      });
      // If the on-disk blob was carrying same-day-gated snapshots
      // that the parser just dropped (stale dateKey, malformed row),
      // rewrite the blob now so the disk row stops accumulating
      // stale slots indefinitely. Goes through the same serialized
      // write chain as every other session save, so it can never
      // race a concurrent `setWordLowStreak` / `saveXSession` call.
      // WordLow's streak is preserved because the flush re-reads the
      // current `parodySessions` slice (which kept the loaded value).
      if (sessionsLoaded.needsRewrite) {
        void flushParodySessions(() => get().parodySessions);
      }
    })();
    return hydrationPromise;
  },

  setVoiceMuted: async (muted) => {
    // Update local state synchronously so the toggle UI flips
    // instantly; persist asynchronously in the background.
    set({ voiceMuted: muted });
    await saveVoiceMuted(muted);
  },

  setSfxMuted: async (muted) => {
    set({ sfxMuted: muted });
    await saveBoolPref(SFX_MUTED_KEY, muted);
  },

  setMusicMuted: async (muted) => {
    set({ musicMuted: muted });
    await saveBoolPref(MUSIC_MUTED_KEY, muted);
  },

  setBgmVolume: async (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    set({ bgmVolume: clamped });
    await saveFloatPref(BGM_VOLUME_KEY, clamped);
  },
  setSfxVolume: async (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    set({ sfxVolume: clamped });
    await saveFloatPref(SFX_VOLUME_KEY, clamped);
  },
  setVoiceVolume: async (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    set({ voiceVolume: clamped });
    await saveFloatPref(VOICE_VOLUME_KEY, clamped);
  },
  setAmbienceVolume: async (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    set({ ambienceVolume: clamped });
    await saveFloatPref(AMBIENCE_VOLUME_KEY, clamped);
  },

  setScanlinesEnabled: async (enabled) => {
    set({ scanlinesEnabled: enabled });
    await saveBoolPref(SCANLINES_KEY, enabled);
  },
  setScreenShakeEnabled: async (enabled) => {
    set({ screenShakeEnabled: enabled });
    await saveBoolPref(SCREEN_SHAKE_KEY, enabled);
  },
  setReduceMotionEnabled: async (enabled) => {
    set({ reduceMotionEnabled: enabled });
    await saveBoolPref(REDUCE_MOTION_KEY, enabled);
  },
  setHighContrastTextEnabled: async (enabled) => {
    set({ highContrastTextEnabled: enabled });
    await saveBoolPref(HIGH_CONTRAST_KEY, enabled);
  },

  recordParodyScore: async (game, value) => {
    // Coerce caller-supplied junk (NaN, negative, fractional) into
    // the same shape the loader produces so the in-memory and
    // on-disk views never disagree.
    const safe = clampNonNegInt(value);
    const prev = get().parody;
    const key = parodyKeyFor(game);
    const current = prev[key];
    if (safe <= current) return false;
    const next: ParodyScores = { ...prev, [key]: safe };
    // Flip the in-memory state synchronously so subscribers (the
    // parody UIs, any "new high" sting) re-render immediately —
    // the disk write below is serialized through `flushParodyScores`
    // and never blocks the visual update.
    set({ parody: next });
    // Hand the persist to the serialized write chain. The closure
    // re-reads `get().parody` at the moment its turn comes up so a
    // sibling save queued behind a slow earlier write still merges
    // every later high score, instead of clobbering them with a
    // stale snapshot.
    await flushParodyScores(() => get().parody);
    return true;
  },

  setWordLowStreak: async (value) => {
    const safe = clampNonNegInt(value);
    const prev = get().parodySessions;
    if (prev.wordLowStreak === safe) return;
    const next: ParodySessions = { ...prev, wordLowStreak: safe };
    set({ parodySessions: next });
    await flushParodySessions(() => get().parodySessions);
  },

  saveSafeSpotSession: async (snap) => {
    const prev = get().parodySessions;
    // Identity-equal slot — no-op so a save loop in the game can't
    // accidentally rewrite the blob with the same data each frame.
    if (prev.safeSpot === snap) return;
    const next: ParodySessions = { ...prev, safeSpot: snap };
    set({ parodySessions: next });
    await flushParodySessions(() => get().parodySessions);
  },

  saveEgoTripSession: async (snap) => {
    const prev = get().parodySessions;
    if (prev.egoTrip === snap) return;
    const next: ParodySessions = { ...prev, egoTrip: snap };
    set({ parodySessions: next });
    await flushParodySessions(() => get().parodySessions);
  },

  saveSugarCoatSession: async (snap) => {
    const prev = get().parodySessions;
    if (prev.sugarCoat === snap) return;
    const next: ParodySessions = { ...prev, sugarCoat: snap };
    set({ parodySessions: next });
    await flushParodySessions(() => get().parodySessions);
  },

  startNewRun: async (forced) => {
    const prevRun = get().run;
    // Archive the previous run if it was closed — capture a summary
    // before overwriting so the Run History screen can show it.
    let archive = get().runArchive;
    if (prevRun?.closed) {
      const summary: RunSummary = {
        runId: prevRun.id,
        killer: prevRun.killer,
        startedAt: prevRun.startedAt,
        endedAt: prevRun.ending?.narrativeBeat
          ? new Date().toISOString()
          : prevRun.startedAt,
        outcome: prevRun.ending?.ending ?? "escapedStub",
        daysTaken: prevRun.day,
        factsDiscovered: prevRun.facts.filter((f) => f.committed).length,
        caughtKiller: prevRun.ending?.correct ?? false,
        accusedCandidateId: prevRun.ending?.accusedCandidateId,
        matchCount: prevRun.matches.length,
        swipeCount: prevRun.swipes.length,
      };
      archive = [summary, ...archive];
    }
    const next = buildRun(forced);
    // Starting a fresh run forfeits any pending undos — facts stashed
    // against the previous run must not be restorable into the new one.
    cancelAllDiscardTimers();
    // Task #62 — drop any in-flight suspect typing-delay timers from
    // the previous run. The new run has fresh threads, so the old
    // timers would either fire into nothing or (worse) try to
    // operate on a thread id that's been replaced.
    cancelAllSuspectDeliveryTimers();
    // Reset the per-session journal-new counter — the freshly seeded
    // run's authored facts are not "new evidence to triage", they're
    // the starting case file. The counter only tracks player-captured
    // facts going forward.
    set({
      run: next,
      recentlyDiscarded: [],
      journalNewSinceLastVisit: 0,
      runArchive: archive,
    });
    await Promise.all([saveActiveRun(next), saveRunArchive(archive)]);
    return next;
  },

  advanceDay: async () => {
    const prev = get().run;
    if (!prev) return;
    // Closed runs ignore further ticks — the End-of-Run card is up,
    // and we don't want a stale "Sleep" tap from before the close
    // to push the day past the face-to-face boundary.
    if (prev.closed) return;

    // ── Tasks #29 + #31: resolve overnight likes BEFORE the day-clock tick ──
    // Story candidates (the killer plus the four authored `decoyPool`
    // decoys today — anyone with `isStoryCandidate !== false`) always
    // reciprocate, preserving Task #29's killer-match-back guarantee.
    // Pure-decoy candidates (the future "wider city pool") reciprocate
    // with `DECOY_RECIPROCATION_PROBABILITY`, decided deterministically
    // per (runId, candidateId) so cold-starting between sleeps cannot
    // reroll the outcome — see `decideDecoyReciprocation` above.
    // Likes that do not reciprocate flip to `status: "passed"` so the
    // run record still tells the truth about what happened (the
    // Matches tab surfaces the count as a small "N didn't reply.").
    const pendingLikesIn: LikeRecord[] = prev.pendingLikes ?? [];
    const announcementsIn: MatchId[] = prev.pendingMatchAnnouncements ?? [];

    let matches = prev.matches;
    let threads = prev.threads;
    let announcements = announcementsIn;
    const resolvedLikes: LikeRecord[] = pendingLikesIn.map((like) => {
      if (like.status !== "pending") return like;
      const candidate = prev.deck.find((c) => c.id === like.candidateId);
      // Candidate not in the run's deck at all — leave the like
      // pending. Today this can't happen (every candidate the player
      // can swipe is in the run's deck), but the guard keeps the
      // resolver honest if a future task ever spawns out-of-deck likes.
      if (!candidate) return like;

      // Story candidates always reciprocate. `isStoryCandidate` is
      // optional + defaults to true for back-compat with runs persisted
      // before the field landed, so anything unmarked is treated as
      // story.
      const isStory = candidate.isStoryCandidate !== false;
      if (!isStory && !decideDecoyReciprocation(prev.id, like.candidateId)) {
        // Pure decoy that rolled past the threshold — no reply.
        return { ...like, status: "passed" };
      }

      const threadId = newThreadId();
      const matchId = newMatchId();
      const match: MatchRelationship = {
        id: matchId,
        runId: prev.id,
        candidateId: like.candidateId,
        // Stamp the day on which the match actually formed, not the
        // day the player swiped — the suspect "decided overnight".
        matchedOnDay: prev.day + 1,
        matchedAt: nowIso(),
        threadId,
        unmatched: false,
      };
      matches = [...matches, match];
      threads = [
        ...threads,
        {
          id: threadId,
          runId: prev.id,
          candidateId: like.candidateId,
          // openThread() will lazily push the opening salvo on first view.
          messages: [],
          turnIndex: 0,
          unreadCount: 0,
        },
      ];
      announcements = [...announcements, matchId];
      return { ...like, status: "matched" };
    });

    const nextDay = prev.day + 1;

    // Day 7 = face-to-face. The killer reveals themselves at the
    // pre-arranged meeting. Bake the metKiller stub through the same
    // resolver the explicit accuse flow uses so all four CaseEndings
    // route through one code path.
    //
    // Overnight likes are still resolved above before the close so the
    // run record tells the truth about who matched on the final night,
    // even though the End-of-Run card may pre-empt the celebration UI.
    //
    // No deck refill on the final night — there's no Day 7 swiping,
    // the player goes straight to the face-to-face.
    if (nextDay >= FACE_TO_FACE_DAY) {
      const closing: CaseRun = {
        ...prev,
        day: nextDay,
        matches,
        threads,
        pendingLikes: resolvedLikes,
        pendingMatchAnnouncements: announcements,
      };
      const result = resolveAccusation({
        accused: closing.killer,
        run: closing,
        discoveredFactIds: new Set(),
        outcome: "metKiller",
      });
      const next: CaseRun = {
        ...closing,
        closed: true,
        ending: result,
      };
      // Task #62 — the case is sealed. Any in-flight suspect typing
      // beats would land messages into a closed run, which the
      // delivery helper would reject anyway, but cancelling here
      // avoids the wasted timer fire.
      cancelAllSuspectDeliveryTimers();
      set({ run: next });
      await saveActiveRun(next);
      return;
    }

    // ── Daily deck refill ────────────────────────────────────────────
    // Without this the run-start `buildDeck()` (killer + 4 decoys = 5
    // candidates) is the deck for the entire 7-day run — by Day 2 the
    // player is staring at "DECK IS DRY" and tapping Sleep until the
    // game ends. Each Sleep now appends a fresh slate of decoys to
    // `deck`, making `remaining = deck.slice(deckCursor)` come back
    // alive without invalidating prior swipes/likes/matches (those
    // index into earlier `deck` positions).
    //
    // Deterministic per (runId, nextDay) so cold-starts don't reroll.
    const refill = freshDecoysForDay(prev.id, nextDay, prev.deck);

    const next: CaseRun = {
      ...prev,
      day: nextDay,
      deck: [...prev.deck, ...refill],
      matches,
      threads,
      pendingLikes: resolvedLikes,
      pendingMatchAnnouncements: announcements,
    };
    set({ run: next });
    await saveActiveRun(next);

    // ── Voicemail generation on day advance ─────────────────────────
    // Materialize authored voicemails for the new day. Filter by killer
    // awareness, then stamp each with a stable id.
    const newVmAuthored = getVoicemailsForDay(nextDay, prev.killer);
    const newVms = newVmAuthored.map((a) => ({
      ...materializeVoicemail(a),
      id: newVoicemailId(),
    }));
    // Refill the phone credit budget when entering a new day.
    const credits = prev.phoneCredits ?? {
      lastRefillDay: prev.day,
      devCalls: 3,
      niaCalls: 3,
    };
    const refilledCredits =
      credits.lastRefillDay < nextDay
        ? { lastRefillDay: nextDay, devCalls: 3, niaCalls: 3 }
        : credits;

    // ── Facetime call scheduling ──────────────────────────────────
    // Surface incoming FaceTime calls for matched characters on day gates.
    const matchedCandidateIds = matches.map((m) => m.candidateId);
    const newFaceTimeCalls = getFaceTimeCallsForDay(nextDay, matchedCandidateIds);

    const withVms: CaseRun = {
      ...next,
      voicemails: [...(next.voicemails ?? []), ...newVms],
      phoneCredits: refilledCredits,
      pendingFacetimeCalls: [
        ...(next.pendingFacetimeCalls ?? []),
        ...newFaceTimeCalls,
      ],
    };
    set({ run: withVms });
    await saveActiveRun(withVms);
  },

  accuse: async ({ accused, accusedCandidateId, outcome = "accuse" }) => {
    const prev = get().run;
    if (!prev || prev.closed) return null;

    // Resolve which `KillerIdentity` slot to forward to the resolver.
    // The resolver does a strict `accused === run.killer` compare, so
    // we need a definite identity for "accuse"/"metKiller". For
    // "escaped" the resolver ignores it entirely (always returns
    // `escapedStub`), but the type still wants something — fall back
    // to `prev.killer` so the call shape stays valid.
    let resolvedAccused: KillerIdentity = prev.killer;
    if (outcome === "escaped") {
      // Identity is unused — leave `resolvedAccused` at the fallback.
    } else if (accusedCandidateId) {
      const cand = prev.deck.find((c) => c.id === accusedCandidateId);
      if (!cand) return null;
      if (cand.isKillerCandidate) {
        // Killer-candidate carries the run's killer slot. This is the
        // only path that should produce `correctMatch` (assuming the
        // player has discovered the right facts).
        resolvedAccused = prev.killer;
      } else {
        // Decoy-candidate. Pick any `KillerIdentity` that isn't the
        // run's killer so the resolver returns `wrongfulAccusation`.
        // The specific value doesn't matter — the resolver only
        // compares against `run.killer` — but we keep it stable
        // (first non-killer in the canonical order) so the ending
        // payload that quotes `accused` stays deterministic for
        // logs/replays.
        const otherSlot = ALL_KILLERS.find((k) => k !== prev.killer);
        // ALL_KILLERS has 8 entries; this find can't return undefined
        // unless the union itself is wrong. Falls back to "miles" for
        // the type checker.
        resolvedAccused = otherSlot ?? "miles";
      }
    } else if (accused) {
      // Legacy/test path — pass through verbatim. The Day-7
      // face-to-face beat in `advanceDay` always lands here with
      // `accused: prev.killer, outcome: "metKiller"`.
      resolvedAccused = accused;
    } else {
      // Neither id nor identity — refuse to file an empty accusation.
      return null;
    }

    // Discovered set = every committed authored OR captured fact that
    // has actually been revealed to the player, keyed by authoring key
    // (NOT the random per-row Fact.id). The resolver subset-checks
    // against `solvingDeduction.requiredFactIDs`, which are themselves
    // authoring keys — see the comment block on
    // `ResolveAccusationInput.discoveredFactIds`.
    //
    // We gate by `isFactRevealedYet` so a deduction chain only
    // "matches" when the player actually saw the underlying clues. A
    // chain that requires a Day 5 portrait fact shouldn't auto-fire on
    // a Day 2 accusation just because the authored row exists in the
    // run blob.
    const discoveredFactIds = new Set<FactId>(
      prev.facts
        .filter((f) => f.committed && isFactRevealedYet(f, prev))
        .map((f) => f.authoringKey as unknown as FactId),
    );

    const result = resolveAccusation({
      accused: resolvedAccused,
      accusedCandidateId,
      run: prev,
      discoveredFactIds,
      outcome,
    });

    const next: CaseRun = {
      ...prev,
      closed: true,
      ending: result,
    };
    // Task #62 — accusation closes the case. Drop any in-flight
    // typing-delay timers so a stale suspect line can't post into
    // the End-of-Run card.
    cancelAllSuspectDeliveryTimers();
    set({ run: next });
    await saveActiveRun(next);
    return result;
  },

  dismissAccusation: async () => {
    const prev = get().run;
    if (!prev || !prev.ending) return;
    // Task #68 — keep `ending` so the Journal's closed-run recovery
    // panel can re-mount the same End-of-Run card via reopenEnding.
    // Pre-#68 this nulled `ending`, which left the player with no
    // way back to the case recap once they'd dismissed it.
    if (prev.endingDismissed) return;
    const next: CaseRun = { ...prev, endingDismissed: true };
    set({ run: next });
    await saveActiveRun(next);
  },

  reopenEnding: async () => {
    const prev = get().run;
    if (!prev || !prev.closed || !prev.ending) return;
    if (!prev.endingDismissed) return;
    const next: CaseRun = { ...prev, endingDismissed: false };
    set({ run: next });
    await saveActiveRun(next);
  },

  swipe: async (candidateId, direction) => {
    const prev = get().run;
    if (!prev) return false;
    // Closed runs are sealed — no further swipes can advance the deck.
    // The End-of-Run overlay owns the next transition (Start New Case
    // or Back To Title); we don't want a stray UI tap to mutate a
    // run that has already been resolved.
    if (prev.closed) return false;

    // Integrity guard — only the candidate currently at deckCursor may be
    // swiped. Rejects duplicate/stale commits that would otherwise
    // double-advance the cursor and corrupt persisted run state.
    const expected = prev.deck[prev.deckCursor];
    if (!expected || expected.id !== candidateId) {
      return false;
    }

    const at = nowIso();
    const swipeRec: SwipeRecord = {
      candidateId,
      direction,
      day: prev.day,
      at,
    };

    // ── Task #29: a right-swipe is a LIKE, not an immediate match ──
    // The match itself is materialized later by `advanceDay()` when
    // the player sleeps. No `MatchRelationship` or `ChatThread` is
    // created here.
    const pendingLikes: LikeRecord[] = prev.pendingLikes ?? [];
    const nextPendingLikes: LikeRecord[] =
      direction === "right"
        ? [
            ...pendingLikes,
            {
              candidateId,
              day: prev.day,
              at,
              status: "pending",
            },
          ]
        : pendingLikes;

    const next: CaseRun = {
      ...prev,
      deckCursor: prev.deckCursor + 1,
      swipes: [...prev.swipes, swipeRec],
      pendingLikes: nextPendingLikes,
    };
    set({ run: next });
    await saveActiveRun(next);
    return true;
  },

  acknowledgeMatchAnnouncement: async (matchId) => {
    const prev = get().run;
    if (!prev) return;
    const queue = prev.pendingMatchAnnouncements ?? [];
    if (!queue.includes(matchId)) return;
    const next: CaseRun = {
      ...prev,
      pendingMatchAnnouncements: queue.filter((id) => id !== matchId),
    };
    set({ run: next });
    await saveActiveRun(next);
  },

  commitFact: async ({ candidateId, threadId, messageId, quote }) => {
    const prev = get().run;
    if (!prev) return null;
    // Sealed run — no new evidence can be entered into the case file
    // after the resolver has fired.
    if (prev.closed) return null;

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
    const payload: FactPayload = { text: trimmed };
    const fact: Fact = {
      id: newFactId(),
      runId: prev.id,
      kind: "captured",
      authoringKey: messageId ? `captured_${messageId}` : `captured_${at}`,
      source: {
        kind: "chatMessage",
        threadId,
        messageId,
      },
      day: prev.day,
      // Only the killer-candidate carries an `identity`. Captures
      // from decoys leave `aboutCharacter` undefined — per-suspect
      // grouping in the journal and the AccusationSheet keys off the
      // unique `capturedFromCandidateId` (set below) instead.
      aboutCharacter: candidate.isKillerCandidate
        ? candidate.identity
        : undefined,
      payload,
      // Legacy field kept on the row so a downgrade to a Pass-3-only
      // build (or a JSON inspection tool that reads it directly) sees
      // a parsable shape. New consumers should prefer `payload`.
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
    // Bump the per-session "captured since last journal visit" counter
    // so the parody home grid's Journal tile can surface a red badge
    // pointing the player at fresh evidence to triage. Cleared by
    // `markJournalVisited` the moment the Journal app is opened.
    set({
      run: next,
      journalNewSinceLastVisit: get().journalNewSinceLastVisit + 1,
    });
    await saveActiveRun(next);
    return fact;
  },

  markJournalVisited: () => {
    if (get().journalNewSinceLastVisit === 0) return;
    set({ journalNewSinceLastVisit: 0 });
  },

  removeFact: async (factId) => {
    const prev = get().run;
    if (!prev) return;
    // Sealed run — the End-of-Run card is showing the chain that
    // closed the case. Removing a fact now would corrupt that
    // post-mortem and is meaningless after the resolver fired.
    if (prev.closed) return;
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

  revealAuthoredFact: async (factId) => {
    const prev = get().run;
    if (!prev) return;
    const current = prev.earlyRevealedFactIds ?? [];
    if (current.includes(factId)) return;
    // Make sure the fact actually exists on this run before recording
    // the reveal — silently dropping unknown ids keeps the date system
    // from accumulating stale ids if scene authoring drifts from the
    // fact universe.
    if (!prev.facts.some((f) => f.id === factId)) return;
    const next: CaseRun = {
      ...prev,
      earlyRevealedFactIds: [...current, factId],
    };
    set({ run: next });
    await saveActiveRun(next);
  },

  startDate: async (candidateId) => {
    const prev = get().run;
    if (!prev || prev.closed) return;
    const match = prev.matches.find(
      (m) => m.candidateId === candidateId && !m.unmatched,
    );
    if (!match) return;
    const next: CaseRun = {
      ...prev,
      checkpoint: { type: "date", candidateId, threadId: match.threadId },
    };
    set({ run: next });
    await saveActiveRun(next);
  },

  endDate: async () => {
    const prev = get().run;
    if (!prev) return;
    if (!prev.checkpoint || prev.checkpoint.type !== "date") return;
    const next: CaseRun = { ...prev, checkpoint: undefined };
    set({ run: next });
    await saveActiveRun(next);
  },

  openThread: async (threadId) => {
    const prev = get().run;
    if (!prev) return;
    // Sealed run — no new chat turns can be staged after the
    // resolver fires. Existing transcripts stay readable; we just
    // don't push the next opening salvo or advance turnIndex.
    if (prev.closed) return;
    const thread = prev.threads.find((t) => t.id === threadId);
    if (!thread) return;
    // Already opened — nothing to push.
    if (thread.messages.length > 0 || thread.turnIndex > 0) return;

    const candidate = prev.deck.find((c) => c.id === thread.candidateId);
    if (!candidate) return;

    // Task #58 — for non-killer matches, claim a fresh innocent tree
    // id from the per-run check-out set so two innocent threads in the
    // same run never share dialogue. Killer threads keep using their
    // bespoke `killerScript` and are skipped here.
    let claimedScriptId = thread.innocentScriptId;
    let usedInnocentScriptIds = prev.usedInnocentScriptIds ?? [];
    if (!candidate.isKillerCandidate && !claimedScriptId) {
      const used = new Set(usedInnocentScriptIds);
      const available = INNOCENT_TREE_IDS.filter((id) => !used.has(id));
      // Pool exhausted (>30 innocent matches in one run — not expected
      // in practice, but possible across many days). Fall back to a
      // random reuse so the player still gets a tree; subsequent
      // improv turns still feel distinct because they branch on the
      // live transcript, not the opener.
      const pickFrom =
        available.length > 0 ? available : INNOCENT_TREE_IDS;
      claimedScriptId =
        pickFrom[Math.floor(Math.random() * pickFrom.length)] ?? undefined;
      if (claimedScriptId && !used.has(claimedScriptId)) {
        usedInnocentScriptIds = [...usedInnocentScriptIds, claimedScriptId];
      }
    }

    const stagedThread: ChatThread = {
      ...thread,
      innocentScriptId: claimedScriptId,
    };
    const script = getScriptForThread(stagedThread, candidate);
    const turn = script[0];
    if (!turn) return;

    // Task #62 — humanized typing delay. The very first opener line
    // lands immediately so a freshly-opened chat doesn't feel empty
    // when the player taps in (per-spec). Any subsequent lines in the
    // opening turn are queued and drained one at a time on a 2-6s
    // delay so the suspect appears to be typing them out. turnIndex
    // is held at 0 until the *last* queued line lands so the picker
    // stays hidden through the whole opening salvo.
    const openingTexts = turn.suspectMessages;
    if (openingTexts.length === 0) return;
    const firstLine: Message = {
      id: newMessageId(),
      sender: "suspect",
      text: openingTexts[0],
      sentAt: nowIso(),
      beatKey: turn.beatKey,
    };
    const queuedRest: PendingSuspectLine[] = queueSuspectLines(
      openingTexts.slice(1),
      turn.beatKey,
      { advanceTurnIndexBy: 1 },
    );
    const turnIndex = queuedRest.length === 0 ? 1 : 0;

    const updatedThread: ChatThread = {
      ...stagedThread,
      messages: [...stagedThread.messages, firstLine],
      turnIndex,
      // Player is actively viewing — opening salvo lands as already read.
      unreadCount: 0,
      pendingSuspectQueue:
        queuedRest.length > 0 ? queuedRest : undefined,
    };

    const next: CaseRun = {
      ...prev,
      threads: prev.threads.map((t) => (t.id === threadId ? updatedThread : t)),
      usedInnocentScriptIds,
    };
    set({ run: next });
    await saveActiveRun(next);

    if (queuedRest.length > 0) {
      scheduleSuspectDelivery(threadId, set, get);
    }
  },

  sendReply: async (threadId, replyText) => {
    const prev = get().run;
    if (!prev) return null;
    // Sealed run — locks chat input the moment the resolver fires
    // so a queued reply can't tack new evidence onto a closed case.
    if (prev.closed) return null;
    const thread = prev.threads.find((t) => t.id === threadId);
    if (!thread) return null;

    const candidate = prev.deck.find((c) => c.id === thread.candidateId);
    if (!candidate) return null;

    // Task #62 — refuse a send while the suspect is still "typing"
    // their last burst. The picker is hidden in this state, so this
    // path is mainly a defense-in-depth against double-fires from a
    // racing useEffect — without it a stray send would queue a new
    // reply on top of stale `turnIndex` and corrupt the burst's
    // postDelivery contract.
    if (
      thread.pendingSuspectQueue &&
      thread.pendingSuspectQueue.length > 0
    ) {
      return null;
    }
    // Same defense-in-depth for the in-flight improv request — the
    // single-flight guard inside `requestImprovTurn` already covers
    // the API call itself, but blocking the player send keeps the
    // turn ordering coherent.
    if (thread.improvPending) return null;

    const script = getScriptForThread(thread, candidate);

    // Task #58 — once a non-killer thread has consumed the last
    // scripted turn, replies are routed through the improv path
    // instead. The picker for an improv turn is sourced from
    // `improvReplyOptions`, but we still let the player's chosen
    // reply land in the transcript and immediately stage the next
    // improv request.
    const isImprovTurn =
      thread.turnIndex >= script.length && !candidate.isKillerCandidate;

    if (isImprovTurn) {
const playerMsg: Message = {
      id: newMessageId(),
      sender: "player",
      text: replyText,
      sentAt: nowIso(),
      // No beatKey for improv turns — beats are a property of the
      // hand-authored tree, and improv is by definition off-tree.
      status: "sent",
    };
      const updatedThread: ChatThread = {
        ...thread,
        messages: [...thread.messages, playerMsg],
        turnIndex: thread.turnIndex + 1,
        // The reply options the player just consumed are stale; the
        // next set will arrive with the next improv suspect turn.
        improvReplyOptions: undefined,
        improvPending: true,
        improvError: undefined,
      };
      const next: CaseRun = {
        ...prev,
        threads: prev.threads.map((t) =>
          t.id === threadId ? updatedThread : t,
        ),
      };
      set({ run: next });
      await saveActiveRun(next);
      // Fire-and-forget — the UI shows the pending state via
      // `improvPending` and renders whatever this resolves into when
      // the store mutation lands. We deliberately don't await it so
      // the player's tap stays snappy.
      void get().requestImprovTurn(threadId);
      return updatedThread;
    }

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
      status: "sent",
    };

    const nextTurn = script[thread.turnIndex];

    // Task #62 — humanized typing delay. The player's reply lands
    // immediately, but the suspect's response is queued and drained
    // line-by-line behind a typing indicator on a 2-6s beat. Bumping
    // `turnIndex` is deferred to the *last* queued line so the picker
    // stays hidden until the suspect is done "typing" — see
    // `deliverNextSuspectLine` for the apply-on-land machinery.
    const suspectQueue: PendingSuspectLine[] = nextTurn
      ? queueSuspectLines(nextTurn.suspectMessages, nextTurn.beatKey, {
          advanceTurnIndexBy: 1,
        })
      : [];

    // Task #58 — if the player just consumed the *final* scripted
    // turn on a non-killer thread, flag the thread as awaiting its
    // first improv suspect line. The improv path itself queues the
    // resulting suspect lines through `pendingSuspectQueue` so the
    // typing-delay treatment applies to improv too.
    const justExhaustedScript =
      !candidate.isKillerCandidate &&
      !nextTurn &&
      thread.turnIndex >= script.length - 1;

    // When the script HAS a next turn, we don't bump turnIndex now —
    // the queued last line will. When the script just ran out and
    // we're handing off to improv, there's no suspect queue to wait
    // on, so bump immediately to record that the script's done.
    const bumpNow = !nextTurn;

    const mergedQueue: PendingSuspectLine[] = [
      ...(thread.pendingSuspectQueue ?? []),
      ...suspectQueue,
    ];

    const updatedThread: ChatThread = {
      ...thread,
      messages: [...thread.messages, playerMsg],
      turnIndex: bumpNow ? thread.turnIndex + 1 : thread.turnIndex,
      pendingSuspectQueue:
        mergedQueue.length > 0 ? mergedQueue : undefined,
      // Unread is bumped per landed suspect line by `deliverNextSuspectLine`,
      // not eagerly here — keeping the badge honest with what's actually
      // visible in the transcript.
      improvPending: justExhaustedScript ? true : thread.improvPending,
      improvError: justExhaustedScript ? undefined : thread.improvError,
    };

    const next: CaseRun = {
      ...prev,
      threads: prev.threads.map((t) => (t.id === threadId ? updatedThread : t)),
    };
    set({ run: next });
    await saveActiveRun(next);

    if (suspectQueue.length > 0) {
      scheduleSuspectDelivery(threadId, set, get);
    }

    if (justExhaustedScript) {
      // Same fire-and-forget pattern as the improv-on-improv path.
      void get().requestImprovTurn(threadId);
    }

    return updatedThread;
  },

  requestImprovTurn: async (threadId) => {
    const prev = get().run;
    if (!prev) return null;
    if (prev.closed) return null;
    const thread = prev.threads.find((t) => t.id === threadId);
    if (!thread) return null;
    const candidate = prev.deck.find((c) => c.id === thread.candidateId);
    if (!candidate) return null;
    // Killer threads never improv — their tree is the whole point.
    if (candidate.isKillerCandidate) return null;

    // Single-flight guard: if a request is already in flight, return
    // the thread untouched. This blocks both duplicate taps (the
    // retry button) and the focus-time auto-recover hook from
    // racing each other into two overlapping Gemini calls.
    if (thread.improvPending) {
      return thread;
    }

    const flagged: ChatThread = {
      ...thread,
      improvPending: true,
      improvError: undefined,
    };
    set({
      run: {
        ...prev,
        threads: prev.threads.map((t) => (t.id === threadId ? flagged : t)),
      },
    });

    try {
      // Lazy import keeps the chat client out of the cold start path
      // and out of any test that doesn't exercise improv.
      const { fetchImprovTurn } = await import(
        "@/features/chat/improvClient"
      );
      // Cap the prompt at the last 12 messages — enough to hold the
      // entire scripted tree (4 turns × ~2 lines + 4 player replies
      // ≈ 12) plus a couple of improv exchanges, while keeping the
      // request body small and the model focused on recent context.
      const tail = flagged.messages.slice(-12).map((m) => ({
        sender: m.sender,
        text: m.text,
      }));
      const result = await fetchImprovTurn({
        suspect: {
          name: candidate.displayName,
          bio: candidate.bio,
        },
        voiceProfile: voiceForCandidate(candidate),
        transcript: tail,
      });
      // Re-read the thread off the *current* state — the player may
      // have sent another reply or navigated since we kicked off the
      // request, and we need to merge into the latest snapshot.
      const cur = get().run;
      if (!cur) return null;
      const curThread = cur.threads.find((t) => t.id === threadId);
      if (!curThread) return null;

      // Task #62 — improv suspect lines are queued and drained on the
      // same 2-6s typing-delay beat as scripted lines. The turnIndex
      // bump and reply-options unlock are stamped on the *last* queued
      // line so the picker doesn't surface mid-burst. `improvPending`
      // is cleared now (the network request is done) — the queue's
      // own non-empty state keeps the typing indicator on screen.
      let finalThread: ChatThread;
      if (result.suspectMessages.length === 0) {
        // Defensive — model returned no suspect text. Apply the reply
        // options synchronously so the picker can recover.
        finalThread = {
          ...curThread,
          turnIndex: curThread.turnIndex + 1,
          improvReplyOptions: result.replyOptions,
          improvPending: false,
          improvError: undefined,
        };
      } else {
        const queued = queueSuspectLines(
          result.suspectMessages,
          undefined,
          {
            advanceTurnIndexBy: 1,
            setImprovReplyOptions: result.replyOptions,
          },
        );
        finalThread = {
          ...curThread,
          pendingSuspectQueue: [
            ...(curThread.pendingSuspectQueue ?? []),
            ...queued,
          ],
          improvPending: false,
          improvError: undefined,
        };
      }

      const nextRun: CaseRun = {
        ...cur,
        threads: cur.threads.map((t) =>
          t.id === threadId ? finalThread : t,
        ),
      };
      set({ run: nextRun });
      await saveActiveRun(nextRun);

      if (
        finalThread.pendingSuspectQueue &&
        finalThread.pendingSuspectQueue.length > 0
      ) {
        scheduleSuspectDelivery(threadId, set, get);
      }
      return finalThread;
    } catch (err) {
      // Surface the failure on the thread so the UI can render a
      // retry affordance instead of a stuck "typing…" indicator.
      const cur = get().run;
      if (!cur) return null;
      const curThread = cur.threads.find((t) => t.id === threadId);
      if (!curThread) return null;
      const failedThread: ChatThread = {
        ...curThread,
        improvPending: false,
        improvError: true,
      };
      const nextRun: CaseRun = {
        ...cur,
        threads: cur.threads.map((t) =>
          t.id === threadId ? failedThread : t,
        ),
      };
      set({ run: nextRun });
      await saveActiveRun(nextRun);
      // Don't rethrow — the caller is fire-and-forget. The thread
      // state carries the failure flag for the UI.
      // eslint-disable-next-line no-console
      console.warn("[catfish] improv turn failed:", err);
      return null;
    }
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

  updateFactNote: async (factId, note) => {
    const prev = get().run;
    if (!prev) return;
    const trimmed = note.trim();
    const updated = prev.facts.map((f) =>
      f.id === factId
        ? { ...f, playerNote: trimmed.length > 0 ? trimmed : undefined }
        : f,
    );
    const next: CaseRun = { ...prev, facts: updated };
    set({ run: next });
    await saveActiveRun(next);
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
    // Task #62 — drop any pending typing-delay queue + timer for this
    // thread. Leaving them in flight would land suspect lines into
    // a thread the player has explicitly ended.
    cancelSuspectDeliveryTimer(target.threadId);
    const threads = prev.threads.map((t) =>
      t.id === target.threadId
        ? ({ ...t, pendingSuspectQueue: undefined } satisfies ChatThread)
        : t,
    );
    // NB: we deliberately leave run.threads' messages untouched.
    // Pass 3's Journal still needs to be able to cite messages from
    // dropped suspects.
    const next: CaseRun = { ...prev, matches, threads };
    set({ run: next });
    await saveActiveRun(next);
  },

  markThreadRead: async (threadId) => {
    const prev = get().run;
    if (!prev) return;
    const thread = prev.threads.find((t) => t.id === threadId);
    if (!thread || thread.unreadCount === 0) return;
    // Task #63 — flip every player message to "read" when the player
    // opens the thread. This is the "read receipt" semantic.
    const bumpedMessages = thread.messages.map((m) =>
      m.sender === "player" && m.status !== "read"
        ? { ...m, status: "read" as const }
        : m,
    );
    const updatedThread: ChatThread = {
      ...thread,
      unreadCount: 0,
      messages: bumpedMessages,
    };
    const next: CaseRun = {
      ...prev,
      threads: prev.threads.map((t) => (t.id === threadId ? updatedThread : t)),
    };
    set({ run: next });
    await saveActiveRun(next);
  },

  markVmListened: async (voicemailId) => {
    const prev = get().run;
    if (!prev) return;
    const voicemails = prev.voicemails ?? [];
    const found = voicemails.find((v) => v.id === voicemailId);
    if (!found || found.listened) return;
    const updated = voicemails.map((v) =>
      v.id === voicemailId ? { ...v, listened: true } : v,
    );
    const next: CaseRun = { ...prev, voicemails: updated };
    set({ run: next });
    await saveActiveRun(next);
  },

  buildChain: async (factIdA, factIdB) => {
    const prev = get().run;
    if (!prev || prev.closed) return null;
    const existingChains = prev.evidenceChains ?? [];
    if (existingChains.some((c) => c.factIdA === factIdA && c.factIdB === factIdB)) {
      return null;
    }
    const { findChainDefinition } = await import("./evidenceChains");
    const def = findChainDefinition(factIdA, factIdB);
    if (!def) return null;
    const chain: EvidenceChain = {
      id: `chain_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
      factIdA,
      factIdB,
      label: def.label,
      aboutCandidate: def.aboutCandidate,
      builtAt: nowIso(),
    };
    const next: CaseRun = {
      ...prev,
      evidenceChains: [...existingChains, chain],
    };
    set({ run: next });
    await saveActiveRun(next);
    return chain;
  },

  makeFriendCall: async (friend) => {
    const prev = get().run;
    if (!prev) return;
    const credits = prev.phoneCredits ?? {
      lastRefillDay: prev.day,
      devCalls: 3,
      niaCalls: 3,
    };
    const key = friend === "nia" ? "niaCalls" : "devCalls";
    const remaining = credits[key];
    if (remaining <= 0) return;
    const updatedCredits: typeof credits = {
      ...credits,
      [key]: remaining - 1,
    };
    const next: CaseRun = { ...prev, phoneCredits: updatedCredits };
    set({ run: next });
    await saveActiveRun(next);
  },

  resetRun: async () => {
    cancelAllDiscardTimers();
    // Task #62 — kill every in-flight suspect typing-delay timer so
    // we don't try to deliver lines into a null run.
    cancelAllSuspectDeliveryTimers();
    set({ run: null, recentlyDiscarded: [], journalNewSinceLastVisit: 0 });
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
