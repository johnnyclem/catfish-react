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
  /**
   * Killer-identity slot the candidate occupies in the run's authored
   * cast. Stamped only on the run's killer-candidate (where it equals
   * `run.killer`). Decoy candidates from `decoyPool` leave this
   * `undefined` — they have no `KillerIdentity` because the union
   * is reserved for the eight authored killers.
   *
   * Historic note: prior to the audit task that introduced this
   * comment, every decoy was stamped with the killer's identity,
   * which collapsed the AccusationSheet (every row "selected" at once,
   * every accusation auto-won) and corrupted captured-fact attribution.
   * Optional now so the type system stops decoys from ever colliding
   * with a killer slot again. Persisted runs from before that fix may
   * still carry a stale identity on their decoys; consumers should gate
   * any read of this field on `isKillerCandidate` or on a stricter
   * `identity === run.killer` check.
   */
  identity?: KillerIdentity;
  displayName: string;
  age: number;
  tagline: string;
  bio: string;
  /** Optional asset id from assets/manifest.ts; falls back to placeholder. */
  portraitAssetId?: AssetId;
  prompts: string[];
  /** Hidden flag so the engine can flag the killer in DEBUG. */
  isKillerCandidate: boolean;
  /**
   * Marks this candidate as part of the run's authored cast (the killer
   * plus the four `decoyPool` decoys today). Story candidates are
   * guaranteed to reciprocate when liked — that is the killer-match-back
   * promise carried over from Task #29 plus the ambient "your authored
   * deck always replies" feel.
   *
   * Optional + defaults to story (treated as `true` when missing) so
   * runs persisted before this field landed continue to behave the way
   * they did. The future "wider city pool" task will mint pure decoys
   * with `isStoryCandidate: false`, at which point `advanceDay()`
   * decides their match-back probabilistically (see
   * `decideDecoyReciprocation` in `core/gameStore.ts`).
   */
  isStoryCandidate?: boolean;
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
  /**
   * Task #58 — id of the innocent dialogue tree this thread is using
   * (see `INNOCENT_TREE_POOL` in `core/innocentTrees.ts`). Stamped on
   * first `openThread` for non-killer candidates and never reassigned.
   * Killer threads keep this `undefined` and use `killerScript`. Pre-pool
   * threads also leave this `undefined` and fall back to the legacy
   * shared `INNOCENT_SCRIPT`.
   */
  innocentScriptId?: string;
  /**
   * Task #58 — three improv reply options the player can pick from once
   * the scripted tree has run out. Populated by the api-server improv
   * endpoint; cleared the moment the player picks one. Empty/undefined
   * means the picker shows the scripted options (or, when out of
   * script, the "fetch improv" affordance).
   */
  improvReplyOptions?: string[];
  /**
   * Task #58 — true while an improv request is in flight. The picker
   * hides itself behind a typing indicator while this is set so the
   * player can't fire two requests at once.
   */
  improvPending?: boolean;
  /**
   * Task #58 — true if the most recent improv request failed. Lets the
   * picker surface a "tap to retry" affordance instead of silently
   * staying empty.
   */
  improvError?: boolean;
  /**
   * Task #62 — humanized typing delay: suspect lines that have been
   * authored/generated but are still being "typed" by the suspect.
   * The store drains this queue one line at a time on a 2-6 second
   * randomized delay, appending each landed line to `messages`. The
   * UI shows an animated typing indicator while this is non-empty so
   * two suspect messages can't appear in the same frame. Persisted so
   * cold starts don't drop in-flight lines (`migrateRun` flushes the
   * queue into `messages` immediately on hydrate). Optional for
   * back-compat with runs persisted before the field landed.
   */
  pendingSuspectQueue?: PendingSuspectLine[];
}

/**
 * Task #62 — one suspect chat line waiting to be "typed out" into the
 * transcript. The fields in `postDelivery` are applied atomically to
 * the thread the moment this line lands, so a multi-line burst can
 * keep `turnIndex` / `improvReplyOptions` in lockstep with the *last*
 * line's arrival rather than pre-bumping them while the player still
 * sees a typing indicator.
 */
export interface PendingSuspectLine {
  id: MessageId;
  text: string;
  beatKey?: string;
  /**
   * Effects to apply to the parent thread *after* this line lands.
   * Set only on the last line of a burst so multi-line replies don't
   * bump `turnIndex` or unlock the picker until the suspect is
   * actually done "typing".
   */
  postDelivery?: PendingSuspectPostDelivery;
}

/**
 * Atomic post-delivery effects for the last line of a queued suspect
 * burst. Anything left undefined is a no-op for that field.
 */
export interface PendingSuspectPostDelivery {
  /** Bump `thread.turnIndex` by this many turns once the line lands. */
  advanceTurnIndexBy?: number;
  /**
   * Replace `thread.improvReplyOptions` with this list once the line
   * lands. Used by the improv path so the picker only unlocks after
   * the staggered delivery completes.
   */
  setImprovReplyOptions?: string[];
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
  /**
   * The candidate the player explicitly accused, when this result came
   * from the accuse flow with a candidate id in hand. Lets the
   * End-of-Run card render the accused's portrait + name (e.g. on a
   * wrongful accusation, the accused decoy shown next to the actual
   * killer). Undefined for stub endings (`metKillerStub`,
   * `escapedStub`) and for legacy callers that only had a
   * `KillerIdentity` slot to forward to the resolver.
   */
  accusedCandidateId?: CandidateId;
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
  /**
   * Character the Fact is *about* — usually a candidate identity.
   *
   * Authored facts always set this (see `factUniverse.json`). Captured
   * facts only set it when the source candidate is the killer-candidate;
   * captures from decoys (who have no `KillerIdentity`) leave it
   * undefined. Consumers that need per-suspect grouping should prefer
   * `capturedFromCandidateId` for captured rows — that field carries the
   * actual candidate id and never collides across decoys the way
   * `aboutCharacter` did before the audit fix.
   */
  aboutCharacter?: KillerIdentity | "player" | FriendID;
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
   * Cleared only when `startNewRun()` builds a fresh run — the
   * legacy `dismissAccusation()` used to null this out, but Task #68
   * keeps the result around so the closed-run Journal recovery panel
   * can re-open the same End-of-Run card the player dismissed.
   */
  ending?: AccusationResult | null;
  /**
   * Task #68 — set when the player dismissed the End-of-Run overlay
   * via "Back To Title". The run stays `closed` and `ending` stays
   * populated so the Journal can offer a "View Case Recap" button
   * that flips this flag back to `false` and re-mounts the overlay.
   * Optional for back-compat; pre-#68 runs default to `false` on
   * cold start (their `ending` field was already nulled by the old
   * dismiss path, so the overlay correctly stays hidden).
   */
  endingDismissed?: boolean;
  /**
   * Task #58 — innocent dialogue tree ids that one of this run's threads
   * has already claimed. New threads pull from `INNOCENT_TREE_POOL`,
   * skipping anything in this set, so two non-killer matches in the
   * same run never deliver the same scripted opener. Optional for
   * back-compat; `migrateRun` defaults missing values to `[]`.
   */
  usedInnocentScriptIds?: string[];
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
