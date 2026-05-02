/**
 * Pure accusation resolver.
 *
 * Takes the accused candidate identity, the active `CaseRun`, and the
 * set of fact ids the player has discovered so far, and returns the
 * `AccusationResult` the run-end card should display. Mirrors the
 * Swift design doc's `resolveAccusation` — uses the truth identity's
 * `solvingDeduction.requiredFactIDs.isSubset(of: discovered)` check to
 * decide whether the player had the full chain of evidence.
 *
 * No store mutations: the screen that calls this decides how (and
 * whether) to apply the result to `CaseRun.closed`.
 */

import { getIdentityModule } from "./identities";
import {
  AccusationResult,
  CandidateId,
  CaseRun,
  Deduction,
  FactId,
  KillerIdentity,
} from "./models";

/**
 * Optional context flag — most accusations come from the explicit
 * accuse flow (default `"accuse"`), but the resolver also handles the
 * two stub endings adjacent flows need to stamp through it:
 *
 *   - `"metKiller"` → Day 7 face-to-face prompt fires.
 *   - `"escaped"`   → run timer expires before any accusation lands.
 *
 * Splitting these out here (instead of two extra resolvers) keeps a
 * single entry point for "what ending does this run get" so callers
 * never have to pick between three near-identical helpers.
 */
export type AccusationOutcome = "accuse" | "metKiller" | "escaped";

export interface ResolveAccusationInput {
  /** The candidate identity the player is accusing. */
  accused: KillerIdentity;
  /**
   * The exact candidate id the player accused, when the caller has it
   * in hand. Threaded straight onto `AccusationResult.accusedCandidateId`
   * so UI surfaces (e.g. the End-of-Run card's wrongful-accusation
   * side-by-side portrait) can look the candidate up on `run.deck`.
   * Optional because the stub endings (`metKiller`, `escaped`) and
   * legacy test paths fire without a specific candidate.
   */
  accusedCandidateId?: CandidateId;
  /** The active run — needed for the truth identity + universe. */
  run: CaseRun;
  /**
   * Fact ids the player has discovered.
   *
   * The resolver subset-checks these against
   * `solvingDeduction.requiredFactIDs`, which carry authoring keys
   * from `factUniverse.json` (e.g. `"miles_bio_downtown_view"`).
   * Authored Facts use their authoring key as their `Fact.id` (see
   * `factBootstrap.buildAuthoredFacts`), so callers can pass either
   * `f.id` or `f.authoringKey` interchangeably:
   *
   *     const discovered = run.facts
   *       .filter(isDiscovered)
   *       .map((f) => f.id);
   *
   * Captured Facts (kind: "captured") have random per-row UUIDs and
   * never appear in any deduction's `requiredFactIDs`, so passing
   * them in is harmless — they just don't match anything.
   */
  discoveredFactIds: ReadonlySet<FactId> | readonly FactId[];
  /** Defaults to `"accuse"` — the player explicitly accusing. */
  outcome?: AccusationOutcome;
}

const FALLBACK_BEATS: Record<
  "caughtThemFull" | "caughtThemWeak" | "wrongful" | "metKiller" | "escaped",
  string
> = {
  caughtThemFull:
    "You laid the chain of evidence on the table, link by link. They didn't bother to deny it.",
  caughtThemWeak:
    "You weren't sure you had enough — and you didn't, not really. But your gut was right. They folded.",
  wrongful:
    "It wasn't them. The real killer is still out there, and now they know you're looking.",
  metKiller:
    "Across the table, the smile didn't fade. They knew you knew. They wanted you to know.",
  escaped:
    "You ran out of time. By the time you were sure, they had already left town.",
};

function isSubset<T>(
  required: readonly T[],
  discovered: ReadonlySet<T>,
): boolean {
  for (const id of required) {
    if (!discovered.has(id)) return false;
  }
  return true;
}

/**
 * Pure resolver — see file header.
 */
export function resolveAccusation(
  input: ResolveAccusationInput,
): AccusationResult {
  const {
    accused,
    accusedCandidateId,
    run,
    discoveredFactIds,
    outcome = "accuse",
  } = input;

  const discovered: ReadonlySet<FactId> =
    discoveredFactIds instanceof Set
      ? discoveredFactIds
      : new Set<FactId>(discoveredFactIds as readonly FactId[]);

  const truthIdentity = getIdentityModule(run.killer);
  const truthDeduction: Deduction | null =
    truthIdentity.solvingDeduction ?? null;

  // Stub ending paths — adjacent flows (Day 7 face-to-face, ran out
  // of time) call us with these so a single resolver covers all four
  // CaseEnding cases.
  if (outcome === "metKiller") {
    return {
      correct: accused === run.killer,
      matchedDeduction: null,
      ending: "metKillerStub",
      narrativeBeat: FALLBACK_BEATS.metKiller,
      accusedCandidateId,
    };
  }
  if (outcome === "escaped") {
    return {
      correct: false,
      matchedDeduction: null,
      ending: "escapedStub",
      narrativeBeat: FALLBACK_BEATS.escaped,
      accusedCandidateId,
    };
  }

  // Default outcome — the player explicitly accuses someone.
  const correct = accused === run.killer;
  if (!correct) {
    return {
      correct: false,
      matchedDeduction: null,
      ending: "wrongfulAccusation",
      narrativeBeat: FALLBACK_BEATS.wrongful,
      accusedCandidateId,
    };
  }

  // Correct accusation — figure out whether the deduction's full
  // evidence chain was actually discovered. Per the doc, *both* paths
  // resolve to `caughtThem`; the difference is whether the matched
  // deduction's narrative beat surfaces, or the weaker fallback.
  const fullChain =
    truthDeduction !== null &&
    isSubset(truthDeduction.requiredFactIDs, discovered);
  if (fullChain) {
    return {
      correct: true,
      matchedDeduction: truthDeduction,
      ending: "caughtThem",
      narrativeBeat: truthDeduction!.narrativeBeat,
      accusedCandidateId,
    };
  }
  return {
    correct: true,
    matchedDeduction: null,
    ending: "caughtThem",
    narrativeBeat: FALLBACK_BEATS.caughtThemWeak,
    accusedCandidateId,
  };
}
