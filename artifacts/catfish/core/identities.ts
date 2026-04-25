/**
 * KillerIdentity protocol + 6 identity modules.
 *
 * Pass 1: Miles and Jules are fully authored (seed candidates + narrative
 * beats); the other four (Tessa, Ren, Kai, Delphine) are typed stubs with
 * TODO markers — they still produce a valid five-candidate roster so the
 * swipe deck never crashes.
 *
 * Jules-specific asset notes:
 *   - A047 (smile) is wired into Jules's swipe-deck portrait below.
 *   - A048 (flirty), A049 (curious), A050 (uneasy), A051 (sinister) are
 *     bundled and registered for Pass 2 — they will drive expression
 *     swaps in chat threads (see beat-keyed mood transitions).
 *   - A070 (casual) and A071 (dressed_up) are bundled for Pass 3 —
 *     fullbody renders for the Profile / Journal accusation modal.
 *
 * Pass 4 (Content/Bootstrapper) will replace these in-line rosters with
 * authored JSON fact universes resolved at run start.
 */

import {
  Candidate,
  KillerIdentity,
  newCandidateId,
} from "./models";

export interface IdentityModule {
  identity: KillerIdentity;
  /** Public-facing display name for the killer (used in DEBUG menu). */
  displayName: string;
  /** Brief one-line concept for the killer's persona. */
  concept: string;
  /** Authored seed candidates for the run's swipe deck. */
  buildDeck(): Candidate[];
  /** TODO Pass 4 — authored narrative beats per day. */
  beats: Record<number, string[]>;
}

/* ───────────────────────── Miles — fully authored ────────────────────── */

const miles: IdentityModule = {
  identity: "miles",
  displayName: "Miles Carver",
  concept:
    "Software engineer with a vintage film camera obsession and a long, careful smile.",
  buildDeck: () => [
    {
      id: newCandidateId(),
      identity: "miles",
      displayName: "Miles",
      age: 29,
      tagline: "Shoots on film. Listens before he answers.",
      bio:
        "Backend engineer turned hobbyist photographer. Lives near the canal. Says he's looking for someone who's read at least one Murakami book and knows when to stop talking.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "Coffee order: black, sometimes with one sugar when nobody's watching.",
        "Last great photo: a stranger laughing at a bus stop in the rain.",
        "Red flag in someone else: people who refuse to wait for the elevator.",
      ],
      isKillerCandidate: true,
    },
    {
      id: newCandidateId(),
      identity: "miles",
      displayName: "Priya",
      age: 27,
      tagline: "ER nurse. Sharp humor, soft hands.",
      bio:
        "Twelve-hour shifts and a houseplant problem. Looking for someone who can sit through a Sunday afternoon without checking the time.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "I'm weirdly competitive about: trivia night.",
        "I'll never get over: the last episode of The Leftovers.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "miles",
      displayName: "Jonas",
      age: 31,
      tagline: "Chef. Always smells faintly of citrus.",
      bio:
        "Runs the line at a tiny Nordic place downtown. Speaks three languages, swears in all of them.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "First thing I notice: how someone holds their fork.",
        "Sunday morning: market run, then nothing.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "miles",
      displayName: "Cleo",
      age: 26,
      tagline: "Architect with a vinyl problem.",
      bio:
        "Drafts buildings nobody has built yet. Plays bass in a band that practices once a year.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "I get unreasonably into: typeface arguments.",
        "If we get along we will eventually talk about: the moon.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "miles",
      displayName: "Sebastián",
      age: 33,
      tagline: "Documentary editor. Quiet eyes.",
      bio:
        "Cuts true-crime docs for a living and is, ironically, the easiest person at any party.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "I cry at: ad campaigns about families. Embarrassing.",
        "Best date: a long walk and a worse dinner.",
      ],
      isKillerCandidate: false,
    },
  ],
  beats: {
    1: [
      "Miles opens with a low-effort joke about your taste in profile photos.",
      "He drops the name of a cafe near the canal — it'll matter later.",
    ],
    2: [
      "He asks about your week and remembers a detail from the day before.",
      "Mentions he's between projects 'right now' (TODO Pass 4 — anchor fact).",
    ],
    3: [
      "TODO Pass 4 — first contradiction beat (timeline alibi vs photo metadata).",
    ],
  },
};

/* ───────────────────────── Tessa — STUB ──────────────────────────────── */

function stubDeck(
  identity: KillerIdentity,
  killerName: string,
  killerTagline: string,
): Candidate[] {
  // TODO Pass 4: replace with authored rosters per identity.
  return [
    {
      id: newCandidateId(),
      identity,
      displayName: killerName,
      age: 28,
      tagline: killerTagline,
      bio: `TODO Pass 4 — author full bio for ${killerName}.`,
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [`TODO ${identity} prompt 1`, `TODO ${identity} prompt 2`],
      isKillerCandidate: true,
    },
    {
      id: newCandidateId(),
      identity,
      displayName: "Avery",
      age: 27,
      tagline: "TODO — placeholder candidate.",
      bio: "TODO Pass 4 — author bio.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: ["TODO prompt"],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity,
      displayName: "Indra",
      age: 30,
      tagline: "TODO — placeholder candidate.",
      bio: "TODO Pass 4 — author bio.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: ["TODO prompt"],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity,
      displayName: "Marcellus",
      age: 32,
      tagline: "TODO — placeholder candidate.",
      bio: "TODO Pass 4 — author bio.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: ["TODO prompt"],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity,
      displayName: "Nori",
      age: 25,
      tagline: "TODO — placeholder candidate.",
      bio: "TODO Pass 4 — author bio.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: ["TODO prompt"],
      isKillerCandidate: false,
    },
  ];
}

const tessa: IdentityModule = {
  identity: "tessa",
  displayName: "Tessa Lin",
  concept:
    "TODO Pass 4 — late-night radio host with too many keys on her keychain.",
  buildDeck: () => stubDeck("tessa", "Tessa", "Voice you'd recognize on the radio."),
  beats: { 1: ["TODO Pass 4 — Tessa day-1 beats."] },
};

const ren: IdentityModule = {
  identity: "ren",
  displayName: "Ren Okafor",
  concept: "TODO Pass 4 — competitive sailor with a temper he calls 'focus'.",
  buildDeck: () => stubDeck("ren", "Ren", "Sailor. Up at five. Don't ask why."),
  beats: { 1: ["TODO Pass 4 — Ren day-1 beats."] },
};

const kai: IdentityModule = {
  identity: "kai",
  displayName: "Kai Brennan",
  concept:
    "TODO Pass 4 — bartender with a photographic memory and a fondness for liars.",
  buildDeck: () => stubDeck("kai", "Kai", "Bartender. Will remember your order."),
  beats: { 1: ["TODO Pass 4 — Kai day-1 beats."] },
};

const delphine: IdentityModule = {
  identity: "delphine",
  displayName: "Delphine Roux",
  concept: "TODO Pass 4 — perfumer who claims she can smell secrets.",
  buildDeck: () =>
    stubDeck("delphine", "Delphine", "Makes scents. Also reads palms, maybe."),
  beats: { 1: ["TODO Pass 4 — Delphine day-1 beats."] },
};

/* ───────────────────────── Jules — fully authored ────────────────────── */

const jules: IdentityModule = {
  identity: "jules",
  displayName: "Jules Vega",
  concept:
    "Dive-bar bartender and bassist with a quiet, watchful smile. Charm dialed up, the rest of him dialed all the way down.",
  buildDeck: () => [
    {
      id: newCandidateId(),
      identity: "jules",
      displayName: "Jules",
      age: 28,
      tagline: "Bartender. Bass player. Bad influence on weekends.",
      bio:
        "Pours drinks at The Lantern downtown, plays bass in a band that practices in his neighbor's garage. Says he likes long talks and slow nights — the kind where nobody's checking the time and the playlist keeps turning over.",
      portraitAssetId: "A047_jules_portrait_smile",
      prompts: [
        "Pour I'd make you on a first date: nothing fancy, but you'd remember it.",
        "Last song stuck in my head: an old Bauhaus B-side I keep starting over.",
        "Dealbreaker: people who ask the band to play 'something happier'.",
      ],
      isKillerCandidate: true,
    },
    {
      id: newCandidateId(),
      identity: "jules",
      displayName: "Wren",
      age: 26,
      tagline: "Tattoo apprentice. Patient hands.",
      bio:
        "Apprentices at a shop that's been open since the eighties. Spends days drawing flash sheets and nights at noise shows.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "First tattoo I ever did: on myself, in a kitchen, badly.",
        "Off-night plans: cheap noodles and a movie I've already seen.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "jules",
      displayName: "Sasha",
      age: 30,
      tagline: "Sound engineer. Hates small talk in elevators.",
      bio:
        "Mixes live shows around town. Notices everyone in the room within thirty seconds. Doesn't always tell you what she noticed.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "Worst venue I've worked: a wedding in a parking garage.",
        "I trust people who: don't fidget when it's quiet.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "jules",
      displayName: "Theo",
      age: 32,
      tagline: "Locksmith. Yes, really.",
      bio:
        "Family business, third generation. Reads paperback mysteries between calls. Will absolutely not help you break into your ex's place.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "Strangest call this month: an antique safe with a love letter inside.",
        "Date idea: walking around an open house like we're going to buy it.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "jules",
      displayName: "Marisol",
      age: 27,
      tagline: "Late-shift baker. Smells like cardamom.",
      bio:
        "Up at three, off by noon, in bed by nine. Says her dating window is brutally short and that's a personality test in itself.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "I'll bring: a paper bag of whatever didn't sell.",
        "Skip me if: you need someone awake at midnight.",
      ],
      isKillerCandidate: false,
    },
  ],
  beats: {
    1: [
      "Jules opens with a low-key joke about the photo of you holding a cocktail — claims he can guess what you ordered.",
      "Mentions The Lantern offhand. Says you should swing by 'on a Tuesday, when it's quiet'.",
    ],
    2: [
      "Asks what you did last weekend, then circles back to a detail you only mentioned in passing.",
      "Drops that he 'closed alone' the night something happened in the neighborhood (TODO Pass 4 — anchor fact).",
    ],
    3: [
      "TODO Pass 4 — first contradiction beat (closing-time alibi vs. the bar's posted hours).",
    ],
  },
};

/* ─────────────────────────── registry ────────────────────────────────── */

export const IDENTITY_REGISTRY: Record<KillerIdentity, IdentityModule> = {
  miles,
  tessa,
  ren,
  kai,
  delphine,
  jules,
};

export function getIdentityModule(id: KillerIdentity): IdentityModule {
  return IDENTITY_REGISTRY[id];
}
