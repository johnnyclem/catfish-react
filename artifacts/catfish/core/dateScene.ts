/**
 * Date Mode — core type definitions.
 *
 * Mirrors the Date Mode PRD (Epic 3-6) into TypeScript. The beat schema
 * uses the `variants[].condition` pattern so one scene file supports
 * all five possible killers — the director resolves variants against
 * `CaseRun.killer` at runtime.
 */

import type { KillerIdentity } from "./models";

/* ───────────────────── Beat schema ───────────────────── */

/**
 * Which character is "speaking" in a beat.
 *   CURRENT_MATCH  — whoever the date is with
 *   PLAYER        — silent protagonist (no voice)
 *   NARRATOR      — third-person framing voice
 */
export type BeatActor = "CURRENT_MATCH" | "PLAYER" | "NARRATOR";

export interface BeatVariant {
  /**
   * Top-down evaluation, first match wins. `default` always matches
   * if reached. V1 supports: `isKiller`, `affinity`, `dayNumber`,
   * `factDiscovered("factID")`.
   */
  condition: string;
  /** Pre-generated voice line id (e.g. "kai_coffee_greeting_warm"). */
  voiceLineID?: string;
  /**
   * Expression state for this beat's sprite.
   * Values: neutral, neutral_saintmask, smile, flirty, curious,
   *         uneasy, sinister
   */
  expression?: ExpressionState;
  /** Optional fact id to write into discovered set when this variant fires. */
  factReveal?: string;
  /**
   * For Eastworld beats only — the fallback voice line if the LLM call
   * fails or exceeds latency budget.
   */
  fallbackVoiceLineID?: string;
}

/**
 * One beat in a date scene. `variants` is the conditional scripting
 * key: same beat structure reused across all 5 killers.
 */
export interface Beat {
  beatID: string;
  /** How this beat resolves content. */
  type: BeatType;
  actor: BeatActor;
  /**
   * Trigger the standard→firstPerson camera transition for the
   * duration of this beat. The visual hinge of the Focus Shift.
   */
  focusShift?: boolean;
  /**
   * For .scripted beats: array of conditional variants.
   * For .eastworld beats: single entry (no condition needed).
   * For .choice beats: not used (choices are on the Choice definition).
   */
  variants?: BeatVariant[];
  /**
   * For .choice beats: the player's options. Each choice branches
   * to a `nextBeatID`.
   */
  choices?: Choice[];
  /** For .eastworld beats only: fallback if LLM call fails. */
  fallbackVoiceLineID?: string;
}

export type BeatType = "scripted" | "eastworld" | "choice";

export interface Choice {
  id: string;
  /** Player-facing button label. */
  label: string;
  /**
   * Affinity delta when player picks this choice.
   * Positive = closer, negative = distant.
   */
  affinityDelta?: number;
  /**
   * If true, a clue CAN be revealed by the next beat.
   * Choices without this flag never trigger emotion-tell UI cues.
   */
  tellEligible?: boolean;
  /** Which beat to jump to on selection. */
  nextBeatID: string;
}

/* ───────────────────── Scene schema ───────────────────── */

export interface OpeningNarration {
  voiceLineID?: string;
  text: string;
}

export interface DateScene {
  sceneID: string;
  /** Which character this date is with. */
  partner: KillerIdentity;
  /** Which environment background to show. */
  environment: EnvironmentId;
  openingNarration: OpeningNarration;
  beats: Beat[];
}

/** Environment asset ids — corresponds to Batch 12 in the asset gen. */
export type EnvironmentId =
  | "env_coffee_shop_day"
  | "env_coffee_shop_night"
  | "env_restaurant"
  | "env_park"
  | "env_bar"
  | "env_apartment"
  | "env_lantern"; // Jules's bar

/* ───────────────────── Expression state ───────────────────── */

/**
 * Character sprite expression states.
 * `neutral_saintmask` is the killer's baseline — it replaces `neutral`
 * whenever the date partner is the killer (Section 4.1 Saint Mask).
 */
export type ExpressionState =
  | "neutral"
  | "neutral_saintmask"
  | "smile"
  | "flirty"
  | "curious"
  | "uneasy"
  | "sinister";

/** Mapping from killer identity to their saint mask portrait. */
export const SAINT_MASK_EXPRESSION: Record<KillerIdentity, ExpressionState> = {
  miles: "neutral_saintmask",
  tessa: "neutral_saintmask",
  ren: "neutral_saintmask",
  kai: "neutral_saintmask",
  delphine: "neutral_saintmask",
  jules: "neutral_saintmask",
  river: "neutral_saintmask",
  sam: "neutral_saintmask",
};

/** Returns the correct expression for a given character + killer state. */
export function expressionFor(
  character: KillerIdentity,
  isKiller: boolean,
  base: ExpressionState,
): ExpressionState {
  if (isKiller && character === character && base === "neutral") {
    return "neutral_saintmask";
  }
  return base;
}

/* ───────────────────── DateDirector state ───────────────────── */

/** Camera framing mode for the date scene. */
export type CameraMode = "standard" | "firstPerson";

/** Resolved beat after variant evaluation. */
export interface ResolvedBeat {
  beatID: string;
  type: BeatType;
  actor: BeatActor;
  voiceLineID?: string;
  expression: ExpressionState;
  text?: string;
  choices?: Choice[];
  focusShift: boolean;
  factReveal?: string;
}

export interface DateSession {
  /** Which run this date belongs to. */
  runId: string;
  sceneID: string;
  partner: KillerIdentity;
  environment: EnvironmentId;
  /** Index of the next beat to play in `DateScene.beats`. */
  beatIndex: number;
  /** Accumulated affinity with this partner. */
  affinity: number;
  /** True once the scene has ended normally. */
  completed: boolean;
  /** If true, player chose to leave early. */
  cutShort: boolean;
  /** Map of factId → true for facts discovered during this date. */
  discoveredFacts: Set<string>;
}

/* ───────────────────── Condition evaluator ───────────────────── */

/**
 * Evaluate a condition string against the current run state.
 * V1 supports: `isKiller`, `default`, `factDiscovered("id")`.
 */
export function evaluateCondition(
  condition: string,
  context: ConditionContext,
): boolean {
  if (condition === "default") return true;
  if (condition === "isKiller") {
    return context.killerId === context.partnerId;
  }
  if (condition.startsWith("factDiscovered(")) {
    const match = condition.match(/^factDiscovered\("([^"]+)"\)$/);
    if (match) {
      return context.discoveredFactIds.has(match[1]!);
    }
  }
  if (condition.startsWith("affinity >=")) {
    const threshold = parseInt(condition.replace("affinity >=", ""), 10);
    return context.affinity >= threshold;
  }
  if (condition.startsWith("dayNumber >=")) {
    const threshold = parseInt(condition.replace("dayNumber >=", ""), 10);
    return context.dayNumber >= threshold;
  }
  return false;
}

export interface ConditionContext {
  killerId: KillerIdentity;
  partnerId: KillerIdentity;
  affinity: number;
  dayNumber: number;
  discoveredFactIds: ReadonlySet<string>;
}

/* ───────────────────── Date outcome ───────────────────── */

export interface DateOutcome {
  runId: string;
  partner: KillerIdentity;
  day: number;
  /** Total affinity delta accumulated during the date. */
  affinityDelta: number;
  /** Facts discovered during this date. */
  factsRevealed: string[];
  /** Whether a follow-up date was scheduled. */
  followUpScheduled: boolean;
  /** Whether the player left early. */
  cutShort: boolean;
}

/* ───────────────────── Music state ───────────────────── */

/** Emotional register of the date music bed. */
export type DateMusicMode = "warm" | "tense";

export interface MusicTransition {
  from: DateMusicMode;
  to: DateMusicMode;
  /** Crossfade duration in ms. */
  durationMs: number;
}