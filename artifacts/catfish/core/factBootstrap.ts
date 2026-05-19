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
  CaseRun,
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

/**
 * Render-time reveal gate for authored facts.
 *
 * Authored facts are materialized up-front by `buildAuthoredFacts` so
 * the resolver's deduction-chain subset check stays simple, but the
 * Journal would otherwise dump the entire mystery on the player at
 * Day 1. This helper hides any authored fact whose narrative source
 * isn't plausibly reachable yet.
 *
 * Hybrid gate: day floor (`fact.day <= run.day`) AND source-specific
 * reachability. Captured facts always pass; the date system also
 * force-shows facts in `run.earlyRevealedFactIds` so a clue earned on
 * a date doesn't disappear back into the fog.
 *
 * Note on `aboutCharacter`: only the killer-candidate carries a
 * `Candidate.identity`. Every authored fact in `factUniverse.json` is
 * about the eventual killer slot, so resolving the candidate via
 * `deck.find(c => c.isKillerCandidate && c.identity === fact.aboutCharacter)`
 * works for all authored rows we ship today.
 */
export function isFactRevealedYet(fact: Fact, run: CaseRun): boolean {
  // Captured facts are always visible — the player promoted them by
  // hand and would be confused to see them vanish.
  if (fact.kind === "captured") return true;

  // Force-show any fact the player earned via a date.
  if (run.earlyRevealedFactIds?.includes(fact.id)) return true;

  // Day floor — never reveal a fact stamped to a future day.
  if (fact.day > run.day) return false;

  // Source-specific reachability. The only source kinds with authored
  // rows today are bio / instagram / portrait / devText, but the rest
  // are listed explicitly so future content lands with sensible
  // defaults instead of an accidental "always visible".
  const source = fact.source;
  switch (source.kind) {
    case "bio":
    case "instagram":
    case "portrait": {
      // These come from the candidate's profile — only meaningful once
      // the player has seen the candidate.
      const cand = run.deck.find(
        (c) => c.isKillerCandidate && c.identity === fact.aboutCharacter,
      );
      if (!cand) return false;
      const matched = run.matches.some((m) => m.candidateId === cand.id);
      if (matched) return true;
      // Bio is the only source that's accessible from the swipe card
      // itself — a player who has passed the card has already seen the
      // bio text. IG / portrait facts are profile-deep so require a
      // match to feel earned.
      if (source.kind === "bio") {
        const seenInDeck = run.deck.findIndex((c) => c.id === cand.id);
        return seenInDeck >= 0 && seenInDeck < run.deckCursor;
      }
      return false;
    }
    case "devText":
    case "friendText":
    case "narratorBeat":
    case "chatMessage":
      // These arrive independently — day gate is the only check.
      return true;
    default:
      return true;
  }
}
