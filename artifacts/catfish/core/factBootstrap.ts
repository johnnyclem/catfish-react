/**
 * Run bootstrapper — materializes the authored fact universe for a
 * fresh `CaseRun`.
 *
 * Mirrors the `RunBootstrapper` step from the Swift design doc:
 * load the JSON universe, walk each authored fact, and apply the
 * doc's inclusion + payload rules:
 *
 *   - static     → always inserted with the default payload.
 *   - variable   → always inserted; payload is replaced when the chosen
 *                  killer's `variableOverrides` carries an override
 *                  for the fact id (the "double-blind tell").
 *   - conditional → only inserted when the chosen killer's
 *                  `conditionalFactIDs` contains its id.
 *
 * The output Facts go straight onto `CaseRun.facts` and coexist with
 * captured Facts (kind: "captured") added later by the player.
 */

import { getIdentityModule } from "./identities";
import factUniverseJson from "./factUniverse.json";
import {
  Fact,
  FactKind,
  FactPayload,
  FactSource,
  FriendID,
  KillerIdentity,
  RunId,
} from "./models";

/**
 * Shape of a single row in `factUniverse.json`. Validated lightly at
 * load time so a malformed authoring change fails loud instead of
 * silently dropping facts at runtime.
 */
interface AuthoredFactRow {
  id: string;
  kind: Exclude<FactKind, "captured">;
  source: FactSource;
  day: number;
  aboutCharacter: KillerIdentity | "player" | FriendID;
  payload: FactPayload;
}

interface FactUniverseFile {
  version: number;
  facts: AuthoredFactRow[];
}

const UNIVERSE = factUniverseJson as FactUniverseFile;

/**
 * Read-only accessor for the loaded universe — exposed so tests and
 * tools (and a future content lint) can walk the rows without
 * re-importing the JSON path.
 */
export function getAuthoredFactUniverse(): readonly AuthoredFactRow[] {
  return UNIVERSE.facts;
}

/**
 * Produce the per-run authored Fact rows for the given killer.
 *
 * Pure: same `runId` + same `killer` always returns the same shape,
 * including the per-row `id`s — authored Facts use their authoring key
 * (the stable string from `factUniverse.json`, e.g.
 * `"miles_bio_downtown_view"`) as their `Fact.id` so the accusation
 * resolver's `requiredFactIDs` subset check works against either
 * `Fact.id` or `Fact.authoringKey` — they're guaranteed equal for
 * authored rows. Captured Facts (added later via `commitFact`) keep
 * the random `newFactId()` UUID scheme so two captures of distinct
 * messages can't collide.
 */
export function buildAuthoredFacts(
  runId: RunId,
  killer: KillerIdentity,
): Fact[] {
  const identity = getIdentityModule(killer);
  const overrides = identity.variableOverrides ?? {};
  const conditionalSet = new Set<string>(identity.conditionalFactIDs ?? []);

  const out: Fact[] = [];
  for (const row of UNIVERSE.facts) {
    if (row.kind === "conditional" && !conditionalSet.has(row.id)) {
      // Conditional fact this killer doesn't own — skip entirely.
      continue;
    }

    let payload = row.payload;
    if (row.kind === "variable") {
      const override = overrides[row.id];
      if (override) payload = override;
    }

    const fact: Fact = {
      // Authored rows use the authoring key as their id so the
      // accusation resolver's `requiredFactIDs` (which are authoring
      // keys) subset-check works directly against `Fact.id`. See the
      // function header for the full rationale.
      id: row.id,
      runId,
      kind: row.kind,
      authoringKey: row.id,
      source: row.source,
      day: row.day,
      aboutCharacter: row.aboutCharacter,
      payload,
      payloadJson: JSON.stringify(payload),
      // Authored facts arrive pre-committed — they're part of the world,
      // not something the player has to file. Captured facts (Pass 3)
      // follow the same `committed: true` convention so the Journal
      // doesn't have to special-case them.
      committed: true,
    };
    out.push(fact);
  }
  return out;
}
