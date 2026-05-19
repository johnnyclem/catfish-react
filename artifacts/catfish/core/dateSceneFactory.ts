/**
 * Date scene factory — synthesizes a per-candidate DateScene from the
 * generic template.
 *
 * The Date Mode PRD calls for one bespoke scene per killer, but the
 * shipping cost of authoring 8 scenes plus voice lines is steep. As an
 * intermediate step we load `resources/scenes/generic_date_coffee.json`
 * once and clone it with the target partner patched in. The
 * `isKiller` conditional variants in the template work unmodified
 * because `evaluateCondition("isKiller", ctx)` compares `partner ===
 * killer` — true for the killer-candidate, false for decoys.
 *
 * Per-candidate `factReveal` lookup: the killer's most thematic
 * authored "tell" — when present — is patched onto the alibi beat so
 * a successful date on the killer hands the player a real clue
 * instead of a narrative dead-end. Dates with decoys never reveal a
 * fact because there's nothing real to confess.
 */

import genericCoffeeScene from "../resources/scenes/generic_date_coffee.json";
import { getIdentityModule } from "./identities";
import type { DateScene } from "./dateScene";
import type { Candidate, KillerIdentity } from "./models";

const TEMPLATE = genericCoffeeScene as DateScene;

/**
 * Pick the killer's "best" tell to reveal during a date — the late-day
 * portrait fact when authored (these capture the unraveling killer's
 * face changing), falling back to the first conditional fact id, or
 * undefined if the killer has no conditionals at all.
 */
function pickRevealedFactId(killer: KillerIdentity): string | undefined {
  const identity = getIdentityModule(killer);
  const conditionals = identity.conditionalFactIDs ?? [];
  if (conditionals.length === 0) return undefined;
  const portraitTell = conditionals.find((id) => id.includes("portrait"));
  return portraitTell ?? conditionals[0];
}

/**
 * Build a DateScene for dating the given candidate. The template has
 * a stable shape; the partner slot is set to the killer's identity
 * when the candidate IS the killer-candidate (so `isKiller` variants
 * fire), or to the candidate's id otherwise. The alibi beat's killer
 * variant is patched with the partner's most evocative authored tell
 * — for decoys the patch is skipped since they can't reveal a real
 * fact about the killer.
 */
export function buildDateSceneFor(candidate: Candidate): DateScene {
  const partner = candidate.identity ?? candidate.id;
  const isKillerCand = candidate.isKillerCandidate && !!candidate.identity;
  const revealedFactId = isKillerCand
    ? pickRevealedFactId(candidate.identity as KillerIdentity)
    : undefined;

  return {
    ...TEMPLATE,
    sceneID: `generic_date_coffee_${partner}`,
    partner,
    beats: TEMPLATE.beats.map((beat) => {
      if (beat.beatID !== "generic_coffee_04b_alibi") return beat;
      if (!revealedFactId) return beat;
      return {
        ...beat,
        variants: beat.variants?.map((v) =>
          v.condition === "isKiller"
            ? { ...v, factReveal: revealedFactId }
            : v,
        ),
      };
    }),
  };
}
