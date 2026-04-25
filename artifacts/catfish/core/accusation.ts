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
  /** The active run — needed for the truth identity + universe. */
  run: CaseRun;
  /**
   * Fact ids the player has discovered.
   *
   * IMPORTANT — these are **authoring keys** (e.g.
   * `"miles_bio_downtown_view"`), not the random per-row
   * `Fact.id` UUIDs minted by `newFactId()`. The resolver
   * subset-checks them against `solvingDeduction.requiredFactIDs`,
   * which are themselves authoring keys.
   *
   * The Pass-4 typing reuses `FactId` for both, which is a known
   * footgun — see follow-up "Make accusation use stable fact
   * identifiers across the codebase" for the planned cleanup. Until
   * then, callers should map their discovered facts to authoring
   * keys before passing them in:
   *
   *     const discovered = run.facts
   *       .filter(isDiscovered)
   *       .map((f) => f.authoringKey as unknown as FactId);
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
  const { accused, run, discoveredFactIds, outcome = "accuse" } = input;

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
    };
  }
  if (outcome === "escaped") {
    return {
      correct: false,
      matchedDeduction: null,
      ending: "escapedStub",
      narrativeBeat: FALLBACK_BEATS.escaped,
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
    };
  }
  return {
    correct: true,
    matchedDeduction: null,
    ending: "caughtThem",
    narrativeBeat: FALLBACK_BEATS.caughtThemWeak,
  };
}
