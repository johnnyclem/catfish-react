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
  {
    factIdA: "tessa_ig_keychain",
    factIdB: "tessa_conditional_lateshift",
    label: "She posted from the studio 'after another long one' — but the station ran a rerun that night",
    aboutCandidate: "tessa",
  },
  // ── Ren chains ───────────────────────────────────────────────────────────
  {
    factIdA: "ren_bio_dawn_call",
    factIdB: "ren_ig_marina_lights",
    label: "Ren's bio says he's on the water at 4:30am — but his marina shot is under floodlights, hours before dawn",
    aboutCandidate: "ren",
  },
  {
    factIdA: "ren_ig_marina_lights",
    factIdB: "ren_conditional_dawn_alibi",
    label: "'First one in' — but the marina logs say he signed out at 2am, not 4:30 like he claimed",
    aboutCandidate: "ren",
  },
  {
    factIdA: "ren_bio_dawn_call",
    factIdB: "ren_portrait_sinister_day5",
    label: "The dawn-patrol alibi and the day-5 expression change tell different stories",
    aboutCandidate: "ren",
  },
  // ── Kai chains ───────────────────────────────────────────────────────────
  {
    factIdA: "kai_bio_transit_wall",
    factIdB: "kai_ig_scissor_lift",
    label: "Kai's bio invites you to the transit-lot mural by day — his IG shows him up the lift after dark",
    aboutCandidate: "kai",
  },
  {
    factIdA: "kai_ig_scissor_lift",
    factIdB: "kai_conditional_paint_late",
    label: "He says he was painting late by the transit lot — but the lot's been fenced off all month",
    aboutCandidate: "kai",
  },
  {
    factIdA: "kai_bio_transit_wall",
    factIdB: "kai_portrait_sinister_day5",
    label: "The open-invite mural persona doesn't survive the day-5 photo — that grin is being held very still",
    aboutCandidate: "kai",
  },
  // ── Delphine chains ──────────────────────────────────────────────────────
  {
    factIdA: "delphine_bio_quiet_nights",
    factIdB: "delphine_ig_workbench",
    label: "Delphine's 'quiet nights at the shop' line matches her IG — but only one of those nights has a receipt",
    aboutCandidate: "delphine",
  },
  {
    factIdA: "delphine_ig_workbench",
    factIdB: "delphine_conditional_smell_secret",
    label: "'Tonight's batch' — but the shop receipts have her opening at 7am after a night she swore she was home",
    aboutCandidate: "delphine",
  },
  {
    factIdA: "delphine_bio_quiet_nights",
    factIdB: "delphine_portrait_uneasy_day5",
    label: "The night-owl shopkeeper persona and the day-5 expression shift don't fit together",
    aboutCandidate: "delphine",
  },
  // ── Jules chains ─────────────────────────────────────────────────────────
  {
    factIdA: "jules_bio_night_walks",
    factIdB: "jules_ig_canal_late",
    label: "Jules says the bar is his until eleven — his 2am story puts him on a quiet street, 'walking it off'",
    aboutCandidate: "jules",
  },
  {
    factIdA: "jules_ig_canal_late",
    factIdB: "dev_text_day4_jules_sus",
    label: "The 2am walk and Sasha's tip line up — the bar was dark by ten on the night he 'closed alone'",
    aboutCandidate: "jules",
  },
  {
    factIdA: "jules_bio_night_walks",
    factIdB: "jules_portrait_sinister_day5",
    label: "The closing-time alibi and the day-5 smile that doesn't reach his eyes tell different stories",
    aboutCandidate: "jules",
  },
  // ── River chains ─────────────────────────────────────────────────────────
  {
    factIdA: "river_bio_solo_sundays",
    factIdB: "river_ig_trailhead",
    label: "River's bio swears Sundays are solo — the trailhead shot is captioned 'just me and the rock'",
    aboutCandidate: "river",
  },
  {
    factIdA: "river_ig_trailhead",
    factIdB: "river_conditional_solo_scout",
    label: "'Just me' — but a hiker placed River at that trailhead with someone else last Sunday",
    aboutCandidate: "river",
  },
  {
    factIdA: "river_bio_solo_sundays",
    factIdB: "river_portrait_sinister_day5",
    label: "The solo-Sundays line and the day-5 careful grin both crack under the same weight",
    aboutCandidate: "river",
  },
  // ── Sam chains ───────────────────────────────────────────────────────────
  {
    factIdA: "sam_bio_overnight",
    factIdB: "sam_ig_breakroom",
    label: "Sam's bio puts her on the overnight unit — the breakroom post says she had time to finish a novel",
    aboutCandidate: "sam",
  },
  {
    factIdA: "sam_ig_breakroom",
    factIdB: "sam_conditional_double_shift",
    label: "'Finished another one tonight' — but badge swipes show she was offsite for two hours of that shift",
    aboutCandidate: "sam",
  },
  {
    factIdA: "sam_bio_overnight",
    factIdB: "sam_portrait_sinister_day5",
    label: "The double-shift alibi and the day-5 photo where the eyes don't match the smile",
    aboutCandidate: "sam",
  },
];

/** Canonical map for O(1) lookup during chain validation. */
export const CHAIN_MAP: Map<string, ChainDefinition> = new Map(
  CHAIN_DEFINITIONS.map((def) => [`${def.factIdA}::${def.factIdB}`, def]),
);

/**
 * Validate a fact-pair link against chain definitions.
 *
 * Order-insensitive: the player picks two facts in whatever order they
 * spotted them, so `(A, B)` and `(B, A)` both resolve to the same
 * definition. Callers that persist the chain should store the
 * definition's own `factIdA`/`factIdB` order, not the pick order.
 *
 * Returns the matching ChainDefinition if valid, null otherwise.
 */
export function findChainDefinition(
  factIdA: string,
  factIdB: string,
): ChainDefinition | null {
  return (
    CHAIN_MAP.get(`${factIdA}::${factIdB}`) ??
    CHAIN_MAP.get(`${factIdB}::${factIdA}`) ??
    null
  );
}
