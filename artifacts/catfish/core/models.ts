/**
 * Catfish — domain model.
 *
 * Translates the SwiftUI/SwiftData @Model layer from Pass 1 of the source
 * doc into TypeScript. Complex payloads are JSON-serializable so the
 * AsyncStorage repository can round-trip them without a schema migration
 * step.
 *
 * Architectural rules carried over from the source doc:
 *  - KillerIdentity is stamped at run start and is immutable for the run.
 *  - Day advances only via explicit GameState.advanceDay().
 *  - Facts are *not* implicitly committed. Pass 5 (Journal) gates that.
 */

import { AssetId } from "@/assets/manifest";

export type KillerIdentity =
  | "miles"
  | "tessa"
  | "ren"
  | "kai"
  | "delphine"
  | "jules"
  | "river"
  | "sam";

export const ALL_KILLERS: KillerIdentity[] = [
  "miles",
  "tessa",
  "ren",
  "kai",
  "delphine",
  "jules",
  "river",
  "sam",
];

export type CandidateId = string;
export type RunId = string;
export type FactId = string;
export type MatchId = string;
export type ThreadId = string;
export type MessageId = string;

export type MessageSender = "suspect" | "player";

/**
 * Single chat line in a thread. `beatKey` is an authoring breadcrumb so
 * later passes (Journal facts, contradiction wall) can locate the moment
 * a player committed to a fact without re-parsing the prose.
 */
export interface Message {
  id: MessageId;
  sender: MessageSender;
  text: string;
  sentAt: string;
  beatKey?: string;
}

export interface Candidate {
  id: CandidateId;
  identity: KillerIdentity;
  displayName: string;
  age: number;
  tagline: string;
  bio: string;
  /** Optional asset id from assets/manifest.ts; falls back to placeholder. */
  portraitAssetId?: AssetId;
  prompts: string[];
  /** Hidden flag so the engine can flag the killer in DEBUG. */
  isKillerCandidate: boolean;
}

export interface MatchRelationship {
  id: MatchId;
  runId: RunId;
  candidateId: CandidateId;
  matchedOnDay: number;
  matchedAt: string;
  threadId: ThreadId;
  unmatched: boolean;
}

export interface ChatThread {
  id: ThreadId;
  runId: RunId;
  candidateId: CandidateId;
  messages: Message[];
  /**
   * Number of suspect-led "turns" already delivered into this thread.
   * 0 means the opening salvo hasn't been pushed yet. Each player reply
   * pushes the next turn's suspect lines and bumps this by one.
   */
  turnIndex: number;
  /**
   * Suspect messages that have arrived since the player last opened the
   * thread. Bumped by `sendReply` when the next suspect turn lands and
   * cleared by `markThreadRead` when the player views the thread.
   */
  unreadCount: number;
}

/**
 * Minimum chat message contract Pass 3 relies on so the player can
 * capture quotes from a thread into the Journal. Pass 2 is free to
 * extend this with mood/role metadata, but `id`, `candidateId`, and
 * `body` MUST stay so Fact capture stays stable across passes.
 */
export type MessageRole = "candidate" | "player";

export interface ChatMessage {
  id: MessageId;
  threadId: ThreadId;
  candidateId: CandidateId;
  role: MessageRole;
  body: string;
  sentAt: string;
  /** Day-clock value at the time the message was sent. */
  day: number;
}

/* ───────── Pass 4 — Clue Graph schema (v0.1) ────────────────────────────
 *
 * Ports the "Clue Graph Schema" from the SwiftUI design doc. Three
 * layers of authored content live alongside the player-captured Facts
 * already in flight:
 *
 *   - static     — the same payload regardless of which killer is active
 *                  (e.g. a public bio line everyone sees).
 *   - variable   — present every run, but the payload is swapped when
 *                  the active killer's `variableOverrides` carries an
 *                  override for the fact id (the "double-blind tell").
 *   - conditional — only present at all when the active killer's
 *                  `conditionalFactIDs` contains its id.
 *
 * Captured Facts (player-authored long-press extracts) keep working
 * untouched: they pass through as `kind: "captured"` so authored and
 * captured rows coexist on `CaseRun.facts` without a schema swap.
 */

/**
 * Friend NPC ids reserved for forward compatibility with the
 * `friendText` source variant — no friend characters are authored in
 * this pass, but the enum exists so a later pass can fill them in
 * without re-shaping the schema.
 */
export type FriendID = "alex" | "morgan" | "dev";

/**
 * Where an authored or captured Fact comes from. Discriminated union
 * so each variant can carry its own surface metadata (e.g. the
 * portrait expression that revealed the fact).
 */
export type FactSource =
  | { kind: "bio" }
  | { kind: "instagram" }
  | { kind: "portrait"; expression: string }
  | { kind: "devText" }
  | { kind: "friendText"; friend: FriendID }
  | {
      kind: "chatMessage";
      threadId?: ThreadId;
      messageId?: MessageId;
    }
  | { kind: "narratorBeat" };

/**
 * Three authored layers from the doc, plus a fourth `captured` variant
 * for the player-extracted Facts the Pass 3 Journal already produces.
 */
export type FactKind = "static" | "variable" | "conditional" | "captured";

/**
 * Resolved payload content for a single Fact row. `voiceLineID` is
 * reserved for Task #16 — Pass 4 just carries the field through so
 * voice generation has a stable place to write ids when it lands.
 */
export interface FactPayload {
  /** Player-facing prose (one or two sentences). */
  text: string;
  /** Optional ElevenLabs line id. Reserved for Task #16. */
  voiceLineID?: string;
  /** Optional subject character (e.g. red herring "looks bad on Jules"). */
  subject?: KillerIdentity | "player" | FriendID;
}

/**
 * "If the player has discovered all of `requiredFactIDs`, surface
 * `narrativeBeat` when they accuse." Used by the accusation resolver
 * to tell the player *how* they cracked the case.
 *
 * Each entry in `requiredFactIDs` is an authoring key from
 * `factUniverse.json`. Authored Facts use their authoring key as their
 * `Fact.id` (see `factBootstrap.buildAuthoredFacts`), so the resolver's
 * subset check works uniformly against either `Fact.id` or
 * `Fact.authoringKey` — they're the same string for authored rows.
 */
export interface Deduction {
  id: string;
  requiredFactIDs: FactId[];
  narrativeBeat: string;
}

/**
 * Four run-end states. `caughtThem`/`wrongfulAccusation` are produced
 * by `resolveAccusation` for player accusations; the two stub endings
 * exist so adjacent flows (Day 7 face-to-face, ran-out-of-time) can
 * stamp the same enum without a schema split.
 */
export type CaseEnding =
  | "caughtThem"
  | "wrongfulAccusation"
  | "metKillerStub"
  | "escapedStub";

/**
 * Pure-function output of `resolveAccusation`. The screen that calls
 * the resolver is responsible for applying the result to `CaseRun`
 * (e.g. flipping `closed` true) — this struct just describes the
 * outcome.
 */
export interface AccusationResult {
  /** True iff the accused was the run's killer. */
  correct: boolean;
  /** The deduction whose required fact set was fully discovered, if any. */
  matchedDeduction: Deduction | null;
  ending: CaseEnding;
  /**
   * Player-facing prose for the run-end card. Pulled from
   * `matchedDeduction.narrativeBeat` when one matched, otherwise a
   * stock line per ending so the UI always has something to show.
   */
  narrativeBeat: string;
}

/**
 * Per-run Fact row — authored or captured. RunBootstrapper materializes
 * the authored rows at `startNewRun` with payloads resolved against
 * the chosen killer; `commitFact` adds captured rows as the player
 * long-presses chat messages.
 */
export interface Fact {
  /**
   * Stable per-row identifier. For authored Facts, this equals the
   * authoring key from `factUniverse.json` (e.g.
   * `"miles_bio_downtown_view"`) so deductions in
   * `requiredFactIDs` subset-check directly against `Fact.id`. For
   * captured Facts, this is a random `newFactId()` UUID minted at
   * capture time.
   */
  id: FactId;
  runId: RunId;
  /**
   * Layer this Fact belongs to. Captured Facts use `"captured"`; the
   * three authored layers from the doc use `"static" | "variable" |
   * "conditional"`.
   */
  kind: FactKind;
  /**
   * Authoring key (e.g. `"miles_apartment_view"`). Equal to `id` for
   * authored Facts; for captured Facts this is a content-derived
   * stable string (e.g. `"captured_${messageId}"`) distinct from the
   * row's random `id`.
   */
  authoringKey: string;
  /**
   * Where this Fact came from in-fiction (bio, IG post, a friend's
   * text, a long-pressed chat message, etc).
   */
  source: FactSource;
  /** Day-clock value the Fact is "stamped" with. */
  day: number;
  /** Character the Fact is *about* — usually a candidate identity. */
  aboutCharacter: KillerIdentity | "player" | FriendID;
  /** Resolved payload for this run/killer. */
  payload: FactPayload;
  /**
   * Legacy JSON-encoded payload kept on the row for back-compat with
   * runs persisted before Pass 4. New writers populate it from
   * `payload`; the migration backfills it for old captured rows so
   * cold start of an in-flight run can't crash on a missing field.
   */
  payloadJson: string;
  /** Has the player committed this to the journal? Authored facts default true. */
  committed: boolean;

  /* ──────── Pass 3 — player-captured fact metadata ──────────────────
   * Set when the player extracts a Fact from a chat message via the
   * long-press gesture in the Journal feature. Authored facts (Pass 4)
   * leave these undefined and rely on `payload` / `source` instead.
   */
  capturedFromCandidateId?: CandidateId;
  capturedFromMessageId?: MessageId;
  capturedQuote?: string;
  capturedOnDay?: number;
  capturedAt?: string;
}

export type SwipeDirection = "left" | "right";

export interface SwipeRecord {
  candidateId: CandidateId;
  direction: SwipeDirection;
  day: number;
  at: string;
}

/**
 * Pending-like record produced by a right-swipe.
 *
 * The swipe path no longer mints a `MatchRelationship` synchronously —
 * it appends a `LikeRecord` with `status: "pending"`. `advanceDay()`
 * (the Sleep button) walks `pendingLikes` and converts every still-
 * pending entry whose candidate is part of the run's authored deck
 * into a real `MatchRelationship` + `ChatThread`, flipping the like's
 * `status` to `"matched"`. This guarantees the killer (and every other
 * story candidate) reciprocates when liked, while leaving room for a
 * future task to reciprocate decoy NPCs probabilistically.
 *
 * Likes that were resolved as non-reciprocating end up `"passed"` so
 * the run record still tells the truth about what happened. Today no
 * code path produces `"passed"` because every deck candidate matches
 * back, but the variant exists so the future stack-with-decoys task
 * doesn't need a schema change.
 */
export interface LikeRecord {
  candidateId: CandidateId;
  /** Day-clock value at the time the player swiped right. */
  day: number;
  /** ISO timestamp the like was recorded. */
  at: string;
  status: "pending" | "matched" | "passed";
}

export interface CaseRun {
  id: RunId;
  /** Stamped at startNewRun and immutable. */
  killer: KillerIdentity;
  startedAt: string;
  /** Player-paced day clock — only advanceDay() moves this. */
  day: number;
  /** Authored deck for the run. */
  deck: Candidate[];
  /** Index of the next candidate to surface in the swipe deck. */
  deckCursor: number;
  swipes: SwipeRecord[];
  matches: MatchRelationship[];
  threads: ChatThread[];
  facts: Fact[];
  /**
   * Right-swipes waiting for overnight resolution. Filled by `swipe()`
   * with `status: "pending"`; flipped to `"matched"` (and a
   * `MatchRelationship` minted) by `advanceDay()`. Optional on the
   * persisted shape so runs saved before this field landed still
   * hydrate cleanly — `migrateRun` defaults missing values to `[]`.
   */
  pendingLikes?: LikeRecord[];
  /**
   * Match ids that were materialized during the most recent
   * `advanceDay` and have not yet been shown to the player. The Swipe
   * tab consumes this queue to play `MatchCelebration` overlays one
   * at a time, calling `acknowledgeMatchAnnouncement(matchId)` to
   * dequeue. Persisted so a cold start mid-queue still surfaces the
   * pending celebrations instead of silently dropping them. Optional
   * for backward compatibility.
   */
  pendingMatchAnnouncements?: MatchId[];
  /** Marks runs the player ended (accusation flow lives in Pass 6). */
  closed: boolean;
  /**
   * Resolved run-end card payload. `null` while the run is still live;
   * populated by `accuse()` (player-driven) or by `advanceDay()` when
   * the Day 7 face-to-face fires. Persisted alongside the rest of the
   * run so cold-starting on top of a closed case still surfaces the
   * ending instead of dropping the player into a frozen deck.
   *
   * Cleared when `dismissAccusation()` runs or when `startNewRun()`
   * builds a fresh run.
   */
  ending?: AccusationResult | null;
}

/* ───────── id helpers (no `uuid` package — crashes on iOS/Android) ──── */

function rid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

export const newRunId = (): RunId => rid("run");
export const newMatchId = (): MatchId => rid("match");
export const newThreadId = (): ThreadId => rid("thread");
export const newFactId = (): FactId => rid("fact");
export const newCandidateId = (): CandidateId => rid("cand");
export const newMessageId = (): MessageId => rid("msg");
