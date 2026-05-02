/**
 * Decoy NPC pool for the swipe stack.
 *
 * Ten authored non-killer profiles backed by the A085–A094 portrait
 * family. Every killer's `buildDeck()` draws four of these
 * deterministically (FNV-1a–seeded Fisher-Yates) so the player sees a
 * coherent cast of decoys within a run, while the lineup still varies
 * between killers. The killer-candidate slot is unaffected — those are
 * authored per-identity in `identities.ts`.
 *
 * Names here are intentionally distinct from every killer's first name
 * (`Miles`, `Tessa`, `Ren`, `Kai`, `Delphine`, `Jules`, `River`, `Sam`)
 * to prevent visual collision in the deck — note the T010 portrait
 * filename uses `ren_neon_hoodie`, but the persona is named `Reyn` to
 * avoid clashing with killer Ren Okafor.
 */

import { AssetId } from "@/assets/manifest";

import { Candidate, KillerIdentity, newCandidateId } from "./models";

interface DecoyTemplate {
  /** Stable key — used in tests and for traceability. */
  key: string;
  displayName: string;
  age: number;
  tagline: string;
  bio: string;
  portraitAssetId: AssetId;
  prompts: string[];
}

export const DECOY_POOL: readonly DecoyTemplate[] = [
  {
    key: "lola",
    displayName: "Lola",
    age: 27,
    tagline: "Surf instructor. Salt in everything.",
    bio:
      "Teaches beginner sets at the south jetty most mornings, runs a tiny vintage shop out of her van the rest of the week. Sunset is the only meeting she keeps.",
    portraitAssetId: "A085_lola_portrait_beach",
    prompts: [
      "Best date: tacos on the seawall, no plans after.",
      "I'll know we're vibing when: you stop checking your phone for the tide.",
    ],
  },
  {
    key: "ari",
    displayName: "Ari",
    age: 28,
    tagline: "Indie bookseller. Recommends weird stuff first.",
    bio:
      "Runs the fiction section at a shop that closes when the owner feels like it. Will press a paperback into your hand on date one and refuse to take it back.",
    portraitAssetId: "A086_ari_portrait_bookstore",
    prompts: [
      "First gift I'd give you: a book you didn't ask for and end up loving.",
      "Sunday plan: market, long walk, longer chapter.",
    ],
  },
  {
    key: "onyx",
    displayName: "Onyx",
    age: 29,
    tagline: "Nightlife photographer. Sleeps when it's bright.",
    bio:
      "Shoots warehouse parties and small label release shows. Edits at 4am with the curtains drawn. Says small talk is a courtesy she's still working on.",
    portraitAssetId: "A087_onyx_portrait_neon",
    prompts: [
      "I'm at my best: in a dark room with one good speaker.",
      "Dealbreaker: people who flash their camera at every show.",
    ],
  },
  {
    key: "micah",
    displayName: "Micah",
    age: 30,
    tagline: "Park ranger. Counts birds for a living.",
    bio:
      "Maintains the long-loop trails at the state forest. Happy in weather most people would call rude. Off-trail he's quiet, on-trail he won't shut up about lichen.",
    portraitAssetId: "A088_micah_portrait_trail",
    prompts: [
      "I'd bring on a first hike: a thermos and one terrible joke.",
      "Green flag: knowing the difference between fog and low cloud.",
    ],
  },
  {
    key: "sienna",
    displayName: "Sienna",
    age: 26,
    tagline: "Gallery assistant. Strong opinions, light shoes.",
    bio:
      "Hangs shows at a midsize gallery downtown and curates a tiny zine on the side. Likes loud lipstick, quiet rooms, and the half-hour right before an opening.",
    portraitAssetId: "A089_sienna_portrait_gallery",
    prompts: [
      "I overdress for: weeknight dinners.",
      "Ask me about: which paintings shouldn't be on Instagram.",
    ],
  },
  {
    key: "eli",
    displayName: "Eli",
    age: 31,
    tagline: "Librarian. Soft voice, sharp memory.",
    bio:
      "Runs the reference desk at the central branch. Cardigans in every color. Knows the city's free wifi map by heart and which cafes won't kick you out for camping.",
    portraitAssetId: "A090_eli_portrait_bookish",
    prompts: [
      "Comfort thing: rereading the same novel every winter.",
      "Date plan: long lunch, used bookstore crawl, no agenda.",
    ],
  },
  {
    key: "penny",
    displayName: "Penny",
    age: 25,
    tagline: "Children's book illustrator. Paint on everything.",
    bio:
      "Freelances for small presses out of a sunlit studio shared with two cats and one very judgmental basil plant. Will absolutely doodle on your napkin.",
    portraitAssetId: "A091_penny_portrait_studio",
    prompts: [
      "I'm weirdly competitive about: arcade claw machines.",
      "I'll cry at: every animated short. Embarrassing.",
    ],
  },
  {
    key: "cam",
    displayName: "Cam",
    age: 33,
    tagline: "Brewery cellarman. Plaid is a lifestyle.",
    bio:
      "Tends fermenters at a small brewery on the east side. Grows hops in pots on the fire escape. Quiet listener, generous pourer, terrible at returning texts before noon.",
    portraitAssetId: "A092_cam_portrait_plaid",
    prompts: [
      "Pour I'd make you on a first date: whatever's freshest, in a small glass.",
      "Sunday morning: somewhere with trees and a thermos.",
    ],
  },
  {
    key: "zora",
    displayName: "Zora",
    age: 28,
    tagline: "Brand strategist. Up after midnight, never bored.",
    bio:
      "Runs marketing for a nightlife venue and writes a city culture newsletter on the side. Knows the bouncer at every bar that matters and three that don't.",
    portraitAssetId: "A093_zora_portrait_city",
    prompts: [
      "First date energy: rooftop drink, walk it off, last train home.",
      "Hot take: the best places never bother with a sign.",
    ],
  },
  {
    key: "reyn",
    displayName: "Reyn",
    age: 29,
    tagline: "Bedroom producer. Plays one show a year.",
    bio:
      "Mixes synth tracks for friends in a hoodie that's older than half the gear. Quiet in person, loud in headphones. Will play you a demo and then refuse to make eye contact while you listen.",
    portraitAssetId: "A094_reyn_portrait_neon",
    prompts: [
      "Reference track for a first date: something slow with a little static.",
      "I trust people who: clap on two and four.",
    ],
  },
];

/* ──────────────────────────── deterministic picker ──────────────────── */

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * LCG-seeded Fisher-Yates over [0, n). Same seed → same permutation
 * across runs and reloads, which keeps a player's deck stable when
 * they kill the app and come back.
 */
function stableShuffle(n: number, seed: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  let state = (seed | 0) >>> 0;
  if (state === 0) state = 0x9e3779b9;
  for (let i = n - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Picks `count` decoys from the pool, deterministically per killer
 * identity. Returns fresh `Candidate` records (with new IDs) ready to
 * splice into a deck — caller owns the killer entry.
 */
export function decoysForKiller(
  identity: KillerIdentity,
  count = 4,
): Candidate[] {
  const seed = fnv1a(`catfish:decoy-pool:v1:${identity}`);
  const order = stableShuffle(DECOY_POOL.length, seed);
  const take = Math.min(count, DECOY_POOL.length);
  return order.slice(0, take).map((poolIndex) => {
    const t = DECOY_POOL[poolIndex];
    // Decoys deliberately leave `identity` undefined — the
    // `KillerIdentity` union is reserved for the killer-candidate of
    // the run. Stamping it here used to collapse the AccusationSheet
    // (every row "selected" at once) and corrupt captured-fact
    // attribution because every decoy shared the killer's slot.
    return {
      id: newCandidateId(),
      displayName: t.displayName,
      age: t.age,
      tagline: t.tagline,
      bio: t.bio,
      portraitAssetId: t.portraitAssetId,
      prompts: [...t.prompts],
      isKillerCandidate: false,
    };
  });
}

/**
 * Build the morning's fresh swipe slate.
 *
 * `advanceDay()` calls this when the player Sleeps — appending the
 * returned candidates to `run.deck` so the next day starts with new
 * faces to swipe. Without this, a run runs out of deck after Day 1
 * and Sleep just ticks the day clock until the Day 7 face-to-face,
 * which makes the whole detective loop feel dead. See task notes.
 *
 * Selection rules:
 *   1. Seed is `fnv1a("catfish:daily-refill:v1:${runId}:${day}")`,
 *      so cold-starting between sleeps cannot reroll the slate.
 *   2. We prefer pool templates whose `displayName` does NOT already
 *      appear in `existingDeck` so consecutive days feel fresh.
 *   3. If the pool is too small to deliver `count` unique names (only
 *      10 templates exist; long runs across many killers WILL exhaust
 *      it), we fall back to allowing repeats from the full pool —
 *      better the player sees Onyx twice than sees an empty deck.
 *   4. Returned Candidates have fresh ids and `isStoryCandidate: false`
 *      so they roll the probabilistic match-back path on Sleep.
 */
export function freshDecoysForDay(
  runId: string,
  day: number,
  existingDeck: Candidate[],
  count = 4,
): Candidate[] {
  const seed = fnv1a(`catfish:daily-refill:v1:${runId}:${day}`);
  const order = stableShuffle(DECOY_POOL.length, seed);

  const usedNames = new Set(existingDeck.map((c) => c.displayName));
  const fresh: number[] = [];
  const repeat: number[] = [];
  for (const poolIndex of order) {
    const t = DECOY_POOL[poolIndex]!;
    if (!usedNames.has(t.displayName)) fresh.push(poolIndex);
    else repeat.push(poolIndex);
  }

  // Take fresh first, then top up from repeats if the pool can't
  // deliver `count` unique names.
  const picked = [...fresh, ...repeat].slice(0, Math.min(count, DECOY_POOL.length));
  return picked.map((poolIndex) => {
    const t = DECOY_POOL[poolIndex]!;
    // Same decoy-identity rule as `decoysForKiller` above: leave
    // `identity` undefined so a decoy can never be mistaken for the
    // run's killer slot.
    return {
      id: newCandidateId(),
      displayName: t.displayName,
      age: t.age,
      tagline: t.tagline,
      bio: t.bio,
      portraitAssetId: t.portraitAssetId,
      prompts: [...t.prompts],
      isKillerCandidate: false,
      isStoryCandidate: false,
    };
  });
}
