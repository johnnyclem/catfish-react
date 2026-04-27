/**
 * Parody mini-game session snapshots — Task #44.
 *
 * Lives in its own module so `gameStore.ts` can hold typed slots for
 * each game's "in-progress run" without taking an import dep on the
 * game components themselves. The shapes are intentionally narrow:
 * each game already owns the runtime state needed to animate a frame,
 * so a snapshot only needs to carry the coarse progress (score, board,
 * placed defenders) the player would feel cheated to lose.
 *
 * Same-day gating
 * ---------------
 * Three of the four games (Safe Spot, Ego Trip, Sugar Coat) only
 * restore an in-progress run if the player returns within the same
 * local calendar day — past that point, the snapshot is dropped on
 * hydrate and the game starts fresh. This matches the task spec
 * ("optionally restore an in-progress run if the player exits and
 * comes back within the same calendar day"). WordLow's win-streak
 * has no date gate — the spec explicitly asks for it to survive
 * across reloads until a loss resets it.
 *
 * Date keys are local-time `YYYY-MM-DD` strings. Local time matches
 * the day the player perceives — switching to UTC would surprise
 * anyone playing late at night near the calendar boundary.
 */

/**
 * Mirrors the `ToolId` union in `features/parody/games/SafeSpot.tsx`.
 * Duplicated (rather than imported) so the store doesn't pull a UI
 * component into its module graph.
 */
export type SafeSpotToolId = "coffee" | "mute" | "fact" | "seen";

export interface SafeSpotDefenderSnapshot {
  type: SafeSpotToolId;
  row: number;
  col: number;
  hp: number;
}

export interface SafeSpotSession {
  /** Local-day key (YYYY-MM-DD) — see `todayDateKey`. */
  dateKey: string;
  pom: number;
  sanity: number;
  /** Current wave number (1-based, matches `wave` in the game). */
  wave: number;
  /** Wave progress so the next milestone fires at the right tick. */
  waveTick: number;
  defenders: SafeSpotDefenderSnapshot[];
}

export interface EgoTripSession {
  dateKey: string;
  /** Pillars cleared so far — the only thing worth restoring. */
  score: number;
}

/** Mirrors `GemKind` in `features/parody/games/SugarCoat.tsx`. */
export type SugarCoatGemKind = "lie" | "excuse" | "spin";

/**
 * Board cell count for SugarCoat — must match `SIZE * SIZE` in
 * `features/parody/games/SugarCoat.tsx` (currently 7×7 = 49). If you
 * change the board dimension there, update this constant in the same
 * commit so the parser keeps rejecting malformed restores.
 */
export const SUGAR_COAT_BOARD_CELLS = 49;

export interface SugarCoatSession {
  dateKey: string;
  /** Row-major SIZE×SIZE board snapshot. */
  board: SugarCoatGemKind[];
  score: number;
  /** Moves remaining; stored separately so a 0-move snapshot can be
   *  recognized and ignored on restore. */
  moves: number;
}

export interface ParodySessions {
  /**
   * WordLow's active in-session win streak. Survives reload (per task
   * spec) — a player who hits a 4-streak then closes the app keeps
   * the 4-streak on next launch. Loss resets it back to 0.
   *
   * Not date-keyed: the streak is a continuous achievement the player
   * is actively chasing, not a half-finished run that should expire.
   */
  wordLowStreak: number;
  /** In-progress Safe Spot run, or null. Same-day only. */
  safeSpot: SafeSpotSession | null;
  /** In-progress Ego Trip run, or null. Same-day only. */
  egoTrip: EgoTripSession | null;
  /** In-progress Sugar Coat run, or null. Same-day only. */
  sugarCoat: SugarCoatSession | null;
}

export const EMPTY_PARODY_SESSIONS: ParodySessions = {
  wordLowStreak: 0,
  safeSpot: null,
  egoTrip: null,
  sugarCoat: null,
};

/**
 * Compose a local-day key in `YYYY-MM-DD` form. `now` is parameterized
 * (rather than reading the wall clock inline) so tests can assert
 * across day boundaries without touching `Date.now()` globally.
 */
export function todayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameLocalDay(
  snapDateKey: string,
  now: Date = new Date(),
): boolean {
  return snapDateKey === todayDateKey(now);
}

const SAFE_SPOT_TOOL_IDS: readonly SafeSpotToolId[] = [
  "coffee",
  "mute",
  "fact",
  "seen",
];
const SUGAR_COAT_GEM_KINDS: readonly SugarCoatGemKind[] = [
  "lie",
  "excuse",
  "spin",
];

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Defensively coerce a JSON-parsed Safe Spot snapshot into the typed
 * shape, returning `null` for any blob that's structurally wrong or
 * stale (different local day). Centralized here so both the loader
 * and any future re-validation share the same accept/reject logic.
 */
export function parseSafeSpotSession(
  raw: unknown,
  now: Date = new Date(),
): SafeSpotSession | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SafeSpotSession>;
  if (typeof r.dateKey !== "string") return null;
  if (!isSameLocalDay(r.dateKey, now)) return null;
  if (
    !isFiniteNum(r.pom) ||
    !isFiniteNum(r.sanity) ||
    !isFiniteNum(r.wave) ||
    !isFiniteNum(r.waveTick)
  ) {
    return null;
  }
  if (!Array.isArray(r.defenders)) return null;
  const defenders: SafeSpotDefenderSnapshot[] = [];
  for (const d of r.defenders) {
    if (!d || typeof d !== "object") continue;
    const dd = d as Partial<SafeSpotDefenderSnapshot>;
    if (
      !SAFE_SPOT_TOOL_IDS.includes(dd.type as SafeSpotToolId) ||
      !isFiniteNum(dd.row) ||
      !isFiniteNum(dd.col) ||
      !isFiniteNum(dd.hp)
    ) {
      continue;
    }
    defenders.push({
      type: dd.type as SafeSpotToolId,
      row: Math.floor(dd.row),
      col: Math.floor(dd.col),
      hp: Math.max(0, Math.floor(dd.hp)),
    });
  }
  return {
    dateKey: r.dateKey,
    pom: Math.max(0, Math.floor(r.pom)),
    sanity: Math.max(0, Math.floor(r.sanity)),
    wave: Math.max(1, Math.floor(r.wave)),
    waveTick: Math.max(0, Math.floor(r.waveTick)),
    defenders,
  };
}

export function parseEgoTripSession(
  raw: unknown,
  now: Date = new Date(),
): EgoTripSession | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<EgoTripSession>;
  if (typeof r.dateKey !== "string") return null;
  if (!isSameLocalDay(r.dateKey, now)) return null;
  if (!isFiniteNum(r.score)) return null;
  return { dateKey: r.dateKey, score: Math.max(0, Math.floor(r.score)) };
}

export function parseSugarCoatSession(
  raw: unknown,
  now: Date = new Date(),
): SugarCoatSession | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SugarCoatSession>;
  if (typeof r.dateKey !== "string") return null;
  if (!isSameLocalDay(r.dateKey, now)) return null;
  if (!isFiniteNum(r.score) || !isFiniteNum(r.moves)) return null;
  if (!Array.isArray(r.board)) return null;
  // The board must be exactly SIZE*SIZE entries of valid gem kinds —
  // anything else is corrupt and we'd rather start fresh than render
  // a half-board that crashes the match-3 scanner.
  if (r.board.length !== SUGAR_COAT_BOARD_CELLS) return null;
  for (const k of r.board) {
    if (!SUGAR_COAT_GEM_KINDS.includes(k as SugarCoatGemKind)) return null;
  }
  // A zero-move snapshot is logically the moment GAME_OVER fires —
  // restoring it would just slap the overlay back on. Drop it.
  if (Math.floor(r.moves) <= 0) return null;
  return {
    dateKey: r.dateKey,
    board: [...(r.board as SugarCoatGemKind[])],
    score: Math.max(0, Math.floor(r.score)),
    moves: Math.floor(r.moves),
  };
}

/**
 * Defensively parse the whole sessions blob, dropping any per-game
 * slot that fails validation (or is from a different calendar day).
 * Always returns a fully-populated `ParodySessions` so the store can
 * `set()` it directly.
 */
export function parseParodySessions(
  raw: unknown,
  now: Date = new Date(),
): ParodySessions {
  if (!raw || typeof raw !== "object") return { ...EMPTY_PARODY_SESSIONS };
  const r = raw as Partial<ParodySessions>;
  const wordLowStreak = isFiniteNum(r.wordLowStreak)
    ? Math.max(0, Math.floor(r.wordLowStreak))
    : 0;
  return {
    wordLowStreak,
    safeSpot: parseSafeSpotSession(r.safeSpot, now),
    egoTrip: parseEgoTripSession(r.egoTrip, now),
    sugarCoat: parseSugarCoatSession(r.sugarCoat, now),
  };
}
