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
  /** Pass 2 will populate this. Empty in Pass 1. */
  messages: unknown[];
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

/**
 * Per-run authored Fact rows. RunBootstrapper (Pass 4) materializes these
 * with payloads resolved against the chosen KillerIdentity. Pass 1 leaves
 * the array empty and the `payloadJson` opaque so the schema is stable
 * once we wire up the content authoring pass.
 */
export interface Fact {
  id: FactId;
  runId: RunId;
  /** Authoring key (e.g. "miles_apartment_view"). */
  authoringKey: string;
  /** JSON-encoded payload. Mirrors SwiftData's `Data` property approach. */
  payloadJson: string;
  /** Has the player committed this to the journal? Always false in Pass 1. */
  committed: boolean;

  /* ──────── Pass 3 — player-captured fact metadata ──────────────────
   * Set when the player extracts a Fact from a chat message via the
   * long-press gesture in the Journal feature. Authored facts (Pass 4)
   * leave these undefined and rely on `payloadJson` instead.
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
  /** Marks runs the player ended (accusation flow lives in Pass 6). */
  closed: boolean;
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
