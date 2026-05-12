/**
 * Authored Facetime call content.
 *
 * Each entry represents an incoming video call from a matched character.
 * `advanceDay()` surfaces calls when a match reaches the affinity
 * threshold or day gate. Calls are killer-aware — some only fire for
 * specific killer variants.
 */

import type { FacetimeCall } from "./models";

interface AuthoredFaceTimeCall {
  candidateId: string;
  day: number;
  killer?: string;
}

export const AUTHORED_FACETIME_CALLS: AuthoredFaceTimeCall[] = [
  { candidateId: "miles", day: 3 },
  { candidateId: "jules", day: 3 },
  { candidateId: "tessa", day: 4 },
  { candidateId: "ren", day: 4 },
  { candidateId: "kai", day: 5 },
  { candidateId: "delphine", day: 5 },
  { candidateId: "river", day: 5 },
  { candidateId: "sam", day: 5 },
];

export function getFaceTimeCallsForDay(
  day: number,
  matchedCandidateIds: string[],
): FacetimeCall[] {
  return AUTHORED_FACETIME_CALLS.filter(
    (call) =>
      call.day === day && matchedCandidateIds.includes(call.candidateId),
  ).map((call) => ({
    id: `ft_${call.candidateId}_day${day}`,
    candidateId: call.candidateId,
    day,
    topic: "video call",
  }));
}