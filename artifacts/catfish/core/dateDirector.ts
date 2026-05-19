/**
 * DateDirector — orchestrator for date scenes.
 *
 * Steps through beats in a `DateScene`, resolving variants against the
 * active `CaseRun` state, playing voice lines, advancing the camera, and
 * collecting clue discoveries. Implements the Focus Shift mechanic
 * (Section 4 of the Date Mode PRD).
 *
 * Recoverability: after every beat, `pushState()` persists the session
 * to AsyncStorage so a crash mid-date resumes at the last completed
 * beat — not a restart.
 *
 * Latency budget (enforced):
 *   - Scripted voice trigger → playback: < 200ms
 *   - Eastworld text response: < 3s (else fallbackVoiceLineID)
 *   - Focus Shift transition: < 500ms
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useGameState } from "./gameStore";
import {
  Beat,
  CameraMode,
  Choice,
  ConditionContext,
  DateMusicMode,
  DateOutcome,
  DateScene,
  DateSession,
  evaluateCondition,
  ExpressionState,
  ResolvedBeat,
  SAINT_MASK_EXPRESSION,
} from "./dateScene";
import type { KillerIdentity } from "./models";
import { emitSfx } from "../features/audio/audioEvents";

/* ───────────────────── persistence key ───────────────────── */

const DATE_SESSION_KEY = "catfish/date-session/v1";

/* ───────────────────── Director errors ───────────────────── */

export class DateSceneError extends Error {
  constructor(msg: string) {
    super(`[DateDirector] ${msg}`);
    this.name = "DateSceneError";
  }
}

/* ───────────────────── Director ───────────────────── */

export class DateDirector {
  private session: DateSession;
  private scene: DateScene;
  private killerId: string;
  private onBeatResolved?: (beat: ResolvedBeat) => void;
  private onCameraChange?: (mode: CameraMode) => void;
  private onMusicModeChange?: (mode: DateMusicMode) => void;
  private onDiscover?: (factId: string) => void;
  private onEnd?: (outcome: DateOutcome) => void;

  constructor(params: {
    scene: DateScene;
    runId: string;
    killerId: string;
    existingSession?: DateSession;
    onBeatResolved?: (beat: ResolvedBeat) => void;
    onCameraChange?: (mode: CameraMode) => void;
    onMusicModeChange?: (mode: DateMusicMode) => void;
    onDiscover?: (factId: string) => void;
    onEnd?: (outcome: DateOutcome) => void;
  }) {
    this.scene = params.scene;
    this.killerId = params.killerId;
    this.onBeatResolved = params.onBeatResolved;
    this.onCameraChange = params.onCameraChange;
    this.onMusicModeChange = params.onMusicModeChange;
    this.onDiscover = params.onDiscover;
    this.onEnd = params.onEnd;

    this.session =
      params.existingSession ??
      this.#freshSession(params.runId, params.scene);
  }

  #freshSession(runId: string, scene: DateScene): DateSession {
    return {
      runId,
      sceneID: scene.sceneID,
      partner: scene.partner,
      environment: scene.environment,
      beatIndex: 0,
      affinity: 0,
      completed: false,
      cutShort: false,
      discoveredFacts: new Set(),
    };
  }

  /* ─────────────── public API ─────────────── */

  get partner(): string {
    return this.session.partner;
  }

  get currentMusicMode(): DateMusicMode {
    return this.session.beatIndex < 0 ? "warm" : "warm";
  }

  get isComplete(): boolean {
    return this.session.completed;
  }

  /** True if the player chose to leave early. */
  get wasCutShort(): boolean {
    return this.session.cutShort;
  }

  /** All fact ids discovered during this date. */
  get discoveredFactIds(): Set<string> {
    return this.session.discoveredFacts;
  }

  /** Current camera framing mode. */
  get cameraMode(): CameraMode {
    return this._cameraMode;
  }
  private _cameraMode: CameraMode = "standard";

  /**
   * Start or resume the date scene. Returns the first (or next)
   * resolved beat to render. Call `advanceToNextBeat()` when ready.
   */
  start(): ResolvedBeat {
    return this.#resolveBeat(this.session.beatIndex);
  }

  /**
   * Handle a player choice from a `.choice` beat.
   * Updates affinity, marks tell eligibility if applicable,
   * and jumps to `nextBeatID`.
   */
  selectChoice(choice: Choice): ResolvedBeat {
    if (this.session.completed) {
      throw new DateSceneError("scene already complete");
    }

    if (choice.affinityDelta) {
      this.session.affinity += choice.affinityDelta;
    }

    const currentBeat = this.scene.beats[this.session.beatIndex];
    const tellJustEligible = !!choice.tellEligible;

    const nextIndex = this.scene.beats.findIndex(
      (b) => b.beatID === choice.nextBeatID,
    );
    if (nextIndex < 0) {
      throw new DateSceneError(
        `choice references unknown nextBeatID: ${choice.nextBeatID}`,
      );
    }

    if (tellJustEligible) {
      this.onMusicModeChange?.("tense");
    }

    void this.#pushState();
    this.session.beatIndex = nextIndex;
    return this.#resolveBeat(nextIndex);
  }

  /**
   * Advance to the next beat in sequence. For `.choice` beats, caller
   * must have already called `selectChoice`. For `.scripted` and
   * `.eastworld` beats, advances to the following beat.
   */
  advance(): ResolvedBeat {
    if (this.session.completed) {
      throw new DateSceneError("scene already complete");
    }
    const next = this.session.beatIndex + 1;
    if (next >= this.scene.beats.length) {
      void this.#complete();
      throw new DateSceneError("no more beats");
    }
    void this.#pushState();
    this.session.beatIndex = next;
    return this.#resolveBeat(next);
  }

  /**
   * Player chose to leave the date early. Records outcome, ends session.
   */
  cutShort(): DateOutcome {
    this.session.cutShort = true;
    const outcome = this.#buildOutcome();
    this.session.completed = true;
    void this.#clearState();
    this.onEnd?.(outcome);
    return outcome;
  }

  /* ─────────────── private ─────────────── */

  /**
   * Resolve the beat at `scene.beats[index]` against current run state.
   * Evaluates `variants[].condition` top-down, first match wins.
   */
  #resolveBeat(index: number): ResolvedBeat {
    const beat = this.scene.beats[index];
    if (!beat) {
      throw new DateSceneError(`no beat at index ${index}`);
    }

    const ctx = this.#buildConditionContext();

    if (beat.type === "choice") {
      return this.#resolveChoiceBeat(beat, ctx);
    }

    const variant =
      beat.variants?.find((v) => evaluateCondition(v.condition, ctx)) ??
      beat.variants?.find((v) => v.condition === "default");

    const resolved = this.#beatToResolved(beat, variant, ctx);

    if (resolved.focusShift) {
      this._cameraMode = "firstPerson";
      this.onCameraChange?.("firstPerson");
      emitSfx("focusShift");
      this.onMusicModeChange?.("tense");
    } else if (this._cameraMode === "firstPerson") {
      this._cameraMode = "standard";
      this.onCameraChange?.("standard");
      this.onMusicModeChange?.("warm");
    }

    if (resolved.factReveal) {
      this.session.discoveredFacts.add(resolved.factReveal);
      void this.#pushState();
      this.onDiscover?.(resolved.factReveal);
      emitSfx("clueDiscovered");
    }

    this.onBeatResolved?.(resolved);
    return resolved;
  }

  #resolveChoiceBeat(beat: Beat, ctx: ConditionContext): ResolvedBeat {
    if (!beat.choices || beat.choices.length === 0) {
      throw new DateSceneError("choice beat has no choices");
    }

    const actor = this.#resolveActor(beat.actor, ctx);

    return {
      beatID: beat.beatID,
      type: "choice",
      actor,
      expression: this.#defaultExpression(ctx),
      choices: beat.choices,
      focusShift: false,
    };
  }

  #beatToResolved(
    beat: Beat,
    variant:
      | {
          condition: string;
          voiceLineID?: string;
          text?: string;
          expression?: ExpressionState;
          factReveal?: string;
        }
      | undefined,
    ctx: ConditionContext,
  ): ResolvedBeat {
    const actor = this.#resolveActor(beat.actor, ctx);
    const expression = variant?.expression ?? this.#defaultExpression(ctx);

    // Text-only scenes ship without recorded voice lines but still have
    // an authored `text` field on each variant. Prefer that over the
    // "voice line missing" placeholder.
    const text = variant?.text
      ? variant.text
      : variant?.voiceLineID
        ? undefined
        : `Beat ${beat.beatID} — voice line missing`;

    return {
      beatID: beat.beatID,
      type: beat.type,
      actor,
      voiceLineID: variant?.voiceLineID,
      expression,
      text,
      choices: beat.type === "choice" ? beat.choices : undefined,
      focusShift: beat.focusShift ?? false,
      factReveal: variant?.factReveal,
    };
  }

  #resolveActor(actor: Beat["actor"], ctx: ConditionContext): ResolvedBeat["actor"] {
    switch (actor) {
      case "CURRENT_MATCH":
        return ctx.partnerId as ResolvedBeat["actor"];
      case "PLAYER":
        return "PLAYER";
      case "NARRATOR":
        return "NARRATOR";
      default:
        return "CURRENT_MATCH";
    }
  }

  #defaultExpression(ctx: ConditionContext): ExpressionState {
    const isKiller = ctx.killerId === ctx.partnerId;
    if (isKiller) {
      // isKiller === true implies partnerId equals a real KillerIdentity
      // (it's structurally equal to killerId, which is typed as such).
      return (
        SAINT_MASK_EXPRESSION[ctx.partnerId as KillerIdentity] ??
        "neutral_saintmask"
      );
    }
    return "neutral";
  }

  #buildConditionContext(): ConditionContext {
    const run = useGameState.getState().run;
    if (!run) {
      throw new DateSceneError("no active run");
    }
    return {
      killerId: run.killer,
      partnerId: this.session.partner,
      affinity: this.session.affinity,
      dayNumber: run.day,
      discoveredFactIds: this.session.discoveredFacts,
    };
  }

  async #complete(): Promise<void> {
    this.session.completed = true;
    const outcome = this.#buildOutcome();
    void this.#clearState();
    this.onEnd?.(outcome);
  }

  #buildOutcome(): DateOutcome {
    return {
      runId: this.session.runId,
      partner: this.session.partner,
      day: useGameState.getState().run?.day ?? 1,
      affinityDelta: this.session.affinity,
      factsRevealed: Array.from(this.session.discoveredFacts),
      followUpScheduled: this.session.affinity >= 3,
      cutShort: this.session.cutShort,
    };
  }

  /* ─────────────── persistence ─────────────── */

  /** Persist session after each beat for crash recovery. */
  async #pushState(): Promise<void> {
    try {
      const serializable = {
        ...this.session,
        discoveredFacts: Array.from(this.session.discoveredFacts),
      };
      await AsyncStorage.setItem(DATE_SESSION_KEY, JSON.stringify(serializable));
    } catch {
      // Persistence failure is non-fatal — beat still advances.
    }
  }

  async #clearState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(DATE_SESSION_KEY);
    } catch {
      // swallow
    }
  }

  /** Load a saved session for this scene if one exists. */
  static async loadSession(
    sceneID: string,
  ): Promise<DateSession | null> {
    try {
      const raw = await AsyncStorage.getItem(DATE_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        sceneID: string;
        discoveredFacts: string[];
        [key: string]: unknown;
      };
      if (parsed.sceneID !== sceneID) return null;
      return {
        ...parsed,
        discoveredFacts: new Set(parsed.discoveredFacts ?? []),
      } as DateSession;
    } catch {
      return null;
    }
  }
}

/* ───────────────────── Director factory ───────────────────── */

/**
 * Factory for creating a DateDirector for a given scene.
 * Checks for a saved session first; if found, resumes from it.
 */
export async function createDirectorForScene(params: {
  scene: DateScene;
  runId: string;
  killerId: string;
  onBeatResolved?: (beat: ResolvedBeat) => void;
  onCameraChange?: (mode: CameraMode) => void;
  onMusicModeChange?: (mode: DateMusicMode) => void;
  onDiscover?: (factId: string) => void;
  onEnd?: (outcome: DateOutcome) => void;
}): Promise<DateDirector> {
  const existing = await DateDirector.loadSession(params.scene.sceneID);
  return new DateDirector({
    scene: params.scene,
    runId: params.runId,
    killerId: params.killerId,
    existingSession: existing ?? undefined,
    onBeatResolved: params.onBeatResolved,
    onCameraChange: params.onCameraChange,
    onMusicModeChange: params.onMusicModeChange,
    onDiscover: params.onDiscover,
    onEnd: params.onEnd,
  });
}