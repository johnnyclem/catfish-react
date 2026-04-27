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
import { buildAuthoredFacts } from "./factBootstrap";
import { getIdentityModule, getScriptForCandidate } from "./identities";
import {
  AccusationResult,
  ALL_KILLERS,
  CandidateId,
  CaseRun,
  ChatThread,
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
  SwipeRecord,
  ThreadId,
} from "./models";
import {
  EgoTripSession,
  EMPTY_PARODY_SESSIONS,
  ParodySessions,
  parseParodySessions,
  SafeSpotSession,
  SugarCoatSession,
} from "./parodySessions";
import { loadActiveRun, saveActiveRun } from "./repository";

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
 */
export interface AccuseInput {
  accused: KillerIdentity;
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
  hydrate: () => Promise<void>;
  /** Toggle voice playback. Persists to AsyncStorage immediately. */
  setVoiceMuted: (muted: boolean) => Promise<void>;
  /** Toggle UI sound effects. Persists to AsyncStorage immediately. */
  setSfxMuted: (muted: boolean) => Promise<void>;
  /** Toggle background music. Persists to AsyncStorage immediately. */
  setMusicMuted: (muted: boolean) => Promise<void>;
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
   * Dismiss the run-end card without starting a new run. Clears
   * `run.ending` so the overlay disappears; leaves `closed = true`
   * so the previous run still reads as over and a fresh run is
   * required to play again.
   */
  dismissAccusation: () => Promise<void>;
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

  // Pass 4 — backfill the new Clue Graph fields onto pre-schema Fact
  // rows so cold start of an in-flight run can't crash on a missing
  // `kind`/`source`/`day`/`aboutCharacter`/`payload`. We do *not*
  // retroactively inject authored facts here — those only land via
  // `startNewRun`, per the task spec, so an in-flight run keeps the
  // exact captured-facts list it had before the upgrade.
  const facts: Fact[] = run.facts.map((f) => migrateFact(f, run));

  // Task #29 — default the like-then-match queues so runs persisted
  // before this field landed continue to load. An in-flight run that
  // already has matches keeps them; only the new `pendingLikes` /
  // `pendingMatchAnnouncements` queues are filled in.
  const pendingLikes: LikeRecord[] = Array.isArray(run.pendingLikes)
    ? run.pendingLikes.filter(
        (l): l is LikeRecord =>
          !!l &&
          typeof l === "object" &&
          typeof (l as LikeRecord).candidateId === "string" &&
          typeof (l as LikeRecord).day === "number" &&
          typeof (l as LikeRecord).at === "string" &&
          ((l as LikeRecord).status === "pending" ||
            (l as LikeRecord).status === "matched" ||
            (l as LikeRecord).status === "passed"),
      )
    : [];
  const pendingMatchAnnouncements: MatchId[] = Array.isArray(
    run.pendingMatchAnnouncements,
  )
    ? run.pendingMatchAnnouncements.filter(
        (id): id is MatchId => typeof id === "string",
      )
    : [];

  return {
    ...run,
    threads,
    facts,
    pendingLikes,
    pendingMatchAnnouncements,
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

  const day: number =
    typeof f.day === "number"
      ? f.day
      : typeof f.capturedOnDay === "number"
        ? f.capturedOnDay
        : run.day;

  // `aboutCharacter` — for a captured fact, derive from the
  // candidate the quote came from (so the Journal still groups
  // correctly). Falls back to the run's killer identity if the
  // candidate has been removed from the deck since capture.
  let aboutCharacter: Fact["aboutCharacter"];
  if (f.aboutCharacter) {
    aboutCharacter = f.aboutCharacter;
  } else if (f.capturedFromCandidateId) {
    const cand = run.deck.find((c) => c.id === f.capturedFromCandidateId);
    aboutCharacter = cand?.identity ?? run.killer;
  } else {
    aboutCharacter = run.killer;
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

export const useGameState = create<GameStateValue>((set, get) => ({
  hydrated: false,
  run: null,
  voiceMuted: false,
  sfxMuted: false,
  musicMuted: false,
  recentlyDiscarded: [],
  parody: { ...EMPTY_PARODY_SCORES },
  parodySessions: { ...EMPTY_PARODY_SESSIONS },

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
        parody,
        sessionsLoaded,
      ] = await Promise.all([
        loadActiveRun().then(migrateRun),
        loadVoiceMuted(),
        loadBoolPref(SFX_MUTED_KEY),
        loadBoolPref(MUSIC_MUTED_KEY),
        loadParodyScores(),
        loadParodySessions(),
      ]);
      // Cold-start invariant: undo state is in-memory only, so a
      // dangling stash from a prior process is impossible. Still,
      // explicitly clearing here documents the contract.
      cancelAllDiscardTimers();
      set({
        run: existing,
        hydrated: true,
        voiceMuted,
        sfxMuted,
        musicMuted,
        recentlyDiscarded: [],
        parody,
        parodySessions: sessionsLoaded.parsed,
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
    const refill = freshDecoysForDay(prev.id, nextDay, prev.killer, prev.deck);

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
  },

  accuse: async ({ accused, outcome = "accuse" }) => {
    const prev = get().run;
    if (!prev || prev.closed) return null;

    // Discovered set = every committed authored OR captured fact, keyed
    // by authoring key (NOT the random per-row Fact.id). The resolver
    // subset-checks against `solvingDeduction.requiredFactIDs`, which
    // are themselves authoring keys — see the comment block on
    // `ResolveAccusationInput.discoveredFactIds`. This is the
    // workaround the typed-key follow-up will eventually clean up.
    const discoveredFactIds = new Set<FactId>(
      prev.facts
        .filter((f) => f.committed)
        .map((f) => f.authoringKey as unknown as FactId),
    );

    const result = resolveAccusation({
      accused,
      run: prev,
      discoveredFactIds,
      outcome,
    });

    const next: CaseRun = {
      ...prev,
      closed: true,
      ending: result,
    };
    set({ run: next });
    await saveActiveRun(next);
    return result;
  },

  dismissAccusation: async () => {
    const prev = get().run;
    if (!prev || !prev.ending) return;
    const next: CaseRun = { ...prev, ending: null };
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
      aboutCharacter: candidate.identity,
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
    set({ run: next });
    await saveActiveRun(next);
    return fact;
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
    // Sealed run — locks chat input the moment the resolver fires
    // so a queued reply can't tack new evidence onto a closed case.
    if (prev.closed) return null;
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
