/**
 * Evidence chain definitions for Phase 10.2.
 *
 * Each chain links two committed facts into a player-meaningful
 * deduction (e.g. "River's bootprint doesn't match the scene").
 * Validated at link-time by `gameStore.buildChain()`.
 *
 * Chains are NOT killer-aware — the same pair of facts is validated
 * the same way regardless of who's actually the killer. Chains that
 * implicate a specific candidate carry `aboutCandidate` so the
 * SuspectBoard can tally evidence for/against each suspect.
 *
 * ~20 chains total, covering the most consequential fact pairs from
 * `factUniverse.json`.
 */

import type { EvidenceChain } from "./models";
import type { KillerIdentity } from "./models";

export interface ChainDefinition {
  /** Ordered pair — factIdA → factIdB. */
  factIdA: string;
  factIdB: string;
  /** Human-readable label surfaced in the chain builder UI. */
  label: string;
  /**
   * Optional candidate this chain points toward.
   * Unset chains are general-purpose logical connections.
   */
  aboutCandidate?: KillerIdentity;
}

export const CHAIN_DEFINITIONS: ChainDefinition[] = [
  // ── Miles chains ─────────────────────────────────────────────────────────
  {
    factIdA: "miles_bio_downtown_view",
    factIdB: "miles_ig_window_reflection",
    label: "Miles mentioned 'morning light over the canal' — his IG shows the bridge by the warehouse in the glass",
    aboutCandidate: "miles",
  },
  {
    factIdA: "miles_ig_window_reflection",
    factIdB: "dev_text_day4_miles_sus",
    label: "Miles was at the canal warehouse at night — his own photo was taken the morning after",
    aboutCandidate: "miles",
  },
  {
    factIdA: "miles_bio_downtown_view",
    factIdB: "dev_text_day4_miles_sus",
    label: "Miles's bio alibi and Dev's intel don't line up — he was near the scene when it happened",
    aboutCandidate: "miles",
  },
  {
    factIdA: "miles_portrait_uneasy_day5",
    factIdB: "miles_ig_window_reflection",
    label: "His profile photo changed the same week his IG reflection put him at the scene",
    aboutCandidate: "miles",
  },
  // ── Tessa chains ──────────────────────────────────────────────────────────
  {
    factIdA: "tessa_bio_lateslot",
    factIdB: "tessa_ig_keychain",
    label: "Tessa's bio says she's on-air midnight to four — but she's been posting elsewhere at those hours",
    aboutCandidate: "tessa",
  },
  {
    factIdA: "tessa_bio_lateslot",
    factIdB: "tessa_portrait_uneasy_day5",
    label: "The late-slot alibi cracks under the same-day portrait change",
    aboutCandidate: "tessa",
  },
  // ── Ren chains ───────────────────────────────────────────────────────────
  {
    factIdA: "ren_bio_dealbreakers",
    factIdB: "ren_ig_graffiti",
    label: "Ren's bio says 'no games' — but his IG is full of coded references to the old crew",
    aboutCandidate: "ren",
  },
  {
    factIdA: "ren_bio_dealbreakers",
    factIdB: "ren_portrait_uneasy_day5",
    label: "The 'dealbreaker' line and the day-5 expression change tell different stories",
    aboutCandidate: "ren",
  },
  // ── Kai chains ───────────────────────────────────────────────────────────
  {
    factIdA: "kai_bio_athletic",
    factIdB: "kai_ig_workout",
    label: "Kai's bio says he trains at the community gym — his IG shows a different location entirely",
    aboutCandidate: "kai",
  },
  {
    factIdA: "kai_ig_workout",
    factIdB: "kai_portrait_uneasy_day5",
    label: "The gym alibi doesn't match the background in his latest photo or his expression",
    aboutCandidate: "kai",
  },
  // ── Delphine chains ──────────────────────────────────────────────────────
  {
    factIdA: "delphine_bio_artstore",
    factIdB: "delphine_ig_paint",
    label: "Delphine's bio mentions the art supply store downtown — her IG has photos taken at a warehouse",
    aboutCandidate: "delphine",
  },
  {
    factIdA: "delphine_bio_artstore",
    factIdB: "delphine_portrait_uneasy_day5",
    label: "The art store regular persona and the day-5 expression shift don't fit together",
    aboutCandidate: "delphine",
  },
  // ── Jules chains ─────────────────────────────────────────────────────────
  {
    factIdA: "jules_bio_systems",
    factIdB: "jules_ig_hacked",
    label: "Jules's bio says 'I keep systems running' — their IG got hacked the same week as the incident",
    aboutCandidate: "jules",
  },
  {
    factIdA: "jules_ig_hacked",
    factIdB: "jules_portrait_uneasy_day5",
    label: "The hacked account and the day-5 portrait change both point to someone scrambling",
    aboutCandidate: "jules",
  },
  // ── River chains ─────────────────────────────────────────────────────────
  {
    factIdA: "river_bio_hiking",
    factIdB: "river_ig_trailcam",
    label: "River's bio boasts about hiking experience — their trail cam photo shows someone who knows the terrain",
    aboutCandidate: "river",
  },
  {
    factIdA: "river_ig_trailcam",
    factIdB: "river_portrait_uneasy_day5",
    label: "The trail cam image and the day-5 portrait change both land on the same person",
    aboutCandidate: "river",
  },
  // ── Sam chains ───────────────────────────────────────────────────────────
  {
    factIdA: "sam_bio_med",
    factIdB: "sam_ig_surgery",
    label: "Sam's bio claims hospital shifts — but their IG shows a surgery date that doesn't match any schedule",
    aboutCandidate: "sam",
  },
  {
    factIdA: "sam_ig_surgery",
    factIdB: "sam_portrait_uneasy_day5",
    label: "The impossible surgery date and the day-5 portrait change both point toward Sam",
    aboutCandidate: "sam",
  },
  // ── General investigative chains (no specific suspect) ───────────────────
  {
    factIdA: "dev_text_day4_miles_sus",
    factIdB: "dev_text_day5_lead",
    label: "Dev's tip on day 4 and their follow-up lead on day 5 both point at the same person",
    aboutCandidate: "miles",
  },
  {
    factIdA: "nia_text_day3_coverup",
    factIdB: "nia_text_day5_confirm",
    label: "Nia's early warning about a cover-up and her later confirmation both land on the same suspect",
    aboutCandidate: "tessa",
  },
];

/** Canonical map for O(1) lookup during chain validation. */
export const CHAIN_MAP: Map<string, ChainDefinition> = new Map(
  CHAIN_DEFINITIONS.map((def) => [`${def.factIdA}::${def.factIdB}`, def]),
);

/**
 * Validate a fact-pair link against chain definitions.
 * Returns the matching ChainDefinition if valid, null otherwise.
 */
export function findChainDefinition(
  factIdA: string,
  factIdB: string,
): ChainDefinition | null {
  return CHAIN_MAP.get(`${factIdA}::${factIdB}`) ?? null;
}