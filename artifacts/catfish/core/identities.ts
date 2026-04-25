/**
 * KillerIdentity protocol + 8 identity modules.
 *
 * Pass 1: Miles, Jules, Kai, River and Sam are fully authored (seed
 * candidates + narrative beats); the remaining three (Tessa, Ren,
 * Delphine) are typed stubs with TODO markers — they still produce a
 * valid five-candidate roster so the swipe deck never crashes.
 *
 * Authored-character asset notes:
 *   Miles — A035 (smile) is wired into his swipe-deck portrait below.
 *     A034, A036-A039 (neutral/flirty/curious/uneasy/sinister) and
 *     A066-A067 (casual and dressed_up fullbody) are bundled for the
 *     same Pass 2 chat expression swaps and Pass 3 Profile / Journal
 *     fullbody renders.
 *   Jules — A047 (smile) is wired into his swipe-deck portrait below.
 *     A046, A048-A051 (neutral/flirty/curious/uneasy/sinister) and
 *     A070-A071 (casual and dressed_up fullbody) are bundled for
 *     Pass 2 chat expression swaps and Pass 3 Profile/Journal
 *     fullbody renders.
 *   Kai — A043 (smile) is wired into his swipe-deck portrait below.
 *     A040-A042, A044-A045 (flirty/sinister/uneasy/curious/neutral)
 *     and A064-A065 (casual and formal fullbody) are bundled for the
 *     same Pass 2 / Pass 3 consumption points.
 *   River — A055 (smile) is wired into his swipe-deck portrait below.
 *     A052-A054, A056-A057 (flirty/sinister/uneasy/curious/neutral)
 *     and A068-A069 (formal and casual fullbody) are bundled for the
 *     same Pass 2 / Pass 3 consumption points. Note: dropped art
 *     filenames numbered River's portraits A046-A051, but A047-A051
 *     were already taken by Jules — bumped to A052-A057 on bundle.
 *   Sam — A059 (smile) is wired into her swipe-deck portrait below.
 *     A058, A060-A063 (curious/uneasy/neutral/sinister/flirty) and
 *     A073-A074 (casual cardigan and formal blazer fullbody) are
 *     bundled for Pass 2 / Pass 3. Note: dropped art filenames
 *     numbered Sam's portraits A052-A057 and her fullbody A070-A071,
 *     all of which collided with River and Jules — bumped to
 *     A058-A063 (portraits) and A073-A074 (fullbody) on bundle.
 *     The dropped portraits had no expression suffix; expressions
 *     were assigned by reading the art.
 *
 * Pass 4 (Content/Bootstrapper) will replace these in-line rosters with
 * authored JSON fact universes resolved at run start.
 */

import {
  Candidate,
  KillerIdentity,
  newCandidateId,
} from "./models";

/**
 * One scripted exchange in a chat thread. The suspect speaks first
 * (`suspectMessages`) and the player picks one of `replyOptions`. Pass 2
 * is intentionally turn-based and finite — Pass 4 will replace this
 * with a fact-aware dialogue planner.
 */
export interface DialogueTurn {
  suspectMessages: string[];
  replyOptions: string[];
  /** Optional authoring key surfaced on each suspect line for later passes. */
  beatKey?: string;
}

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
  /**
   * Authored chat script used when the player opens the killer-candidate's
   * thread. Non-killer candidates fall back to INNOCENT_SCRIPT.
   */
  killerScript: DialogueTurn[];
}

/**
 * Shared script for non-killer candidates. Keeps every match feeling
 * "alive" without forcing us to author five distinct flirts per killer
 * before the case-specific facts land in Pass 4.
 */
export const INNOCENT_SCRIPT: DialogueTurn[] = [
  {
    beatKey: "innocent_open",
    suspectMessages: [
      "hey :)",
      "wasn't sure you'd swipe back, honestly.",
    ],
    replyOptions: [
      "of course i did.",
      "your bio got me.",
      "happy to be wrong about?",
    ],
  },
  {
    beatKey: "innocent_weekend",
    suspectMessages: [
      "okay that made me smile.",
      "what's your usual on a weekend?",
    ],
    replyOptions: [
      "nothing impressive.",
      "depends on the weather.",
      "asking me out already?",
    ],
  },
  {
    beatKey: "innocent_probe",
    suspectMessages: [
      "fair, fair.",
      "i'd rather know what you're not telling me, honestly.",
    ],
    replyOptions: [
      "bold opener.",
      "give me a few days.",
      "try me.",
    ],
  },
  {
    beatKey: "innocent_close",
    suspectMessages: [
      "mysterious. dangerous.",
      "i'll bite — coffee this week?",
    ],
    replyOptions: [
      "sure.",
      "let me check.",
      "i'll let you know.",
    ],
  },
];

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
      portraitAssetId: "A035_miles_portrait_smile",
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
  killerScript: [
    {
      beatKey: "miles_open",
      suspectMessages: [
        "hey — saw your photos.",
        "you have good taste in profile pictures. that's rare around here.",
      ],
      replyOptions: [
        "ha, thanks. yours look like film?",
        "are you grading me right now?",
        "depends. what do you shoot?",
      ],
    },
    {
      beatKey: "miles_canal",
      suspectMessages: [
        "i shoot film, yeah. portra 400 mostly.",
        "there's a place near the canal i go to. quiet light in the morning.",
      ],
      replyOptions: [
        "which canal?",
        "i'd like to see those photos sometime.",
        "morning person, huh.",
      ],
    },
    {
      beatKey: "miles_ardenne",
      suspectMessages: [
        "ardenne canal. small bridge, easy to miss.",
        "could send you something later. been editing all week.",
      ],
      replyOptions: [
        "editing what?",
        "send the worst one first.",
        "no rush.",
      ],
    },
    {
      beatKey: "miles_between_projects",
      suspectMessages: [
        "between projects right now. just personal stuff.",
        "what about you — busy week?",
      ],
      replyOptions: [
        "pretty quiet.",
        "nothing i'd call work.",
        "busy enough.",
      ],
    },
  ],
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
  killerScript: [
    {
      beatKey: "tessa_open",
      suspectMessages: [
        "hey — i recognize that smile from somewhere.",
        "do you actually like radio or were you just being polite in your bio?",
      ],
      replyOptions: [
        "i actually listen.",
        "i was being polite.",
        "what station are you on?",
      ],
    },
    {
      beatKey: "tessa_lateshift",
      suspectMessages: [
        "ha — points for honesty.",
        "i do the late slot. midnight to four.",
      ],
      replyOptions: [
        "that sounds brutal.",
        "i'm usually up.",
        "do you sleep at all?",
      ],
    },
    {
      beatKey: "tessa_callback",
      suspectMessages: [
        "barely. ask me again next week.",
        "let me know what you think of the show sometime.",
      ],
      replyOptions: [
        "i will.",
        "send me a clip.",
        "what's it called?",
      ],
    },
  ],
};

const ren: IdentityModule = {
  identity: "ren",
  displayName: "Ren Okafor",
  concept: "TODO Pass 4 — competitive sailor with a temper he calls 'focus'.",
  buildDeck: () => stubDeck("ren", "Ren", "Sailor. Up at five. Don't ask why."),
  beats: { 1: ["TODO Pass 4 — Ren day-1 beats."] },
  killerScript: [
    {
      beatKey: "ren_open",
      suspectMessages: [
        "morning.",
        "you look like someone who's never been on a boat before.",
      ],
      replyOptions: [
        "correct.",
        "rude.",
        "teach me, then.",
      ],
    },
    {
      beatKey: "ren_earlybird",
      suspectMessages: [
        "rude was free, sorry.",
        "sailing's not for everyone — you have to like getting up early.",
      ],
      replyOptions: [
        "how early?",
        "i can manage.",
        "define early.",
      ],
    },
    {
      beatKey: "ren_invite",
      suspectMessages: [
        "four-thirty most days.",
        "i could take you out sometime if you can survive it.",
      ],
      replyOptions: [
        "i'm in.",
        "let me think.",
        "after coffee, sure.",
      ],
    },
  ],
};

/* ────────────────────────── Kai — fully authored ─────────────────────── */

const kai: IdentityModule = {
  identity: "kai",
  displayName: "Kai Brennan",
  concept:
    "Street muralist with paint-splattered denim and a photographic memory for faces. Charming, easily distracted, never as scattered as he looks.",
  buildDeck: () => [
    {
      id: newCandidateId(),
      identity: "kai",
      displayName: "Kai",
      age: 25,
      tagline: "Painter. I do walls. Mostly legal ones.",
      bio:
        "Spends his days on a scissor lift painting murals on the sides of buildings and his nights at gallery openings drinking the free wine. Remembers every face he's ever drawn, which is a lot of faces.",
      portraitAssetId: "A043_kai_portrait_smile",
      prompts: [
        "First date energy: a long walk past every wall I've ever painted.",
        "I'll know we're vibing when: you stop apologizing for being early.",
        "Hot take: most people never actually look at anything.",
      ],
      isKillerCandidate: true,
    },
    {
      id: newCandidateId(),
      identity: "kai",
      displayName: "Imani",
      age: 29,
      tagline: "Gallery curator. Soft hands, sharp opinions.",
      bio:
        "Runs a small project space on the east side. Hates the word 'edgy'. Will absolutely tell you what your apartment needs.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "What I'm reading: an essay collection I'll quote at you uninvited.",
        "Date plan: openings on Friday, dim sum after, no plans Saturday.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "kai",
      displayName: "Dev",
      age: 27,
      tagline: "Ceramicist. Hands always a little dusty.",
      bio:
        "Throws pots in a shared studio behind a laundromat. Sells at one weekend market. Says he's bad at texting and means it.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "I'd cook for you: something with too much garlic.",
        "Studio rule: no shoes, no podcasts, only records.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "kai",
      displayName: "Noor",
      age: 31,
      tagline: "Documentary photographer. Quiet in crowds.",
      bio:
        "Shoots for a small magazine that mostly survives on grants. Has been to a lot of places and doesn't lead with that.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "Camera I actually use: a beat-up point-and-shoot from 2003.",
        "Worst assignment: a cat show. (I loved it.)",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "kai",
      displayName: "Marco",
      age: 28,
      tagline: "Music producer. Lives at 110 BPM.",
      bio:
        "Mixes for local bands out of his bedroom. Will play you something he's working on within twenty minutes of meeting you.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "Reference track for a first date: bossa nova, low volume.",
        "I trust people who: clap on two and four.",
      ],
      isKillerCandidate: false,
    },
  ],
  beats: {
    1: [
      "Kai opens with an offhand compliment about a detail in your photo most people miss — the necklace, a building behind you. Calls it 'painter brain'.",
      "Mentions the wall he's finishing 'down by the old transit lot' — invites you to swing by while there's still afternoon light.",
    ],
    2: [
      "Brings up a face from your photos he 'definitely recognizes from somewhere'. Names a venue. Doesn't elaborate.",
      "Casually drops that he was 'painting late' the night something happened nearby (TODO Pass 4 — anchor fact).",
    ],
    3: [
      "TODO Pass 4 — first contradiction beat (alleged paint-late alibi vs. an inconsistency in a photo's timestamp / weather / lighting).",
    ],
  },
  killerScript: [
    {
      beatKey: "kai_open",
      suspectMessages: [
        "hey.",
        "i remember faces. is that creepy to lead with?",
      ],
      replyOptions: [
        "a little.",
        "depends on whose.",
        "go on.",
      ],
    },
    {
      beatKey: "kai_drink",
      suspectMessages: [
        "fair, fair.",
        "what are you drinking these days?",
      ],
      replyOptions: [
        "nothing strong.",
        "anything cold.",
        "surprise me.",
      ],
    },
    {
      beatKey: "kai_invite",
      suspectMessages: [
        "respect.",
        "swing by mine sometime. i'll make you something honest.",
      ],
      replyOptions: [
        "where's mine?",
        "tonight?",
        "honest how?",
      ],
    },
  ],
};

const delphine: IdentityModule = {
  identity: "delphine",
  displayName: "Delphine Roux",
  concept: "TODO Pass 4 — perfumer who claims she can smell secrets.",
  buildDeck: () =>
    stubDeck("delphine", "Delphine", "Makes scents. Also reads palms, maybe."),
  beats: { 1: ["TODO Pass 4 — Delphine day-1 beats."] },
  killerScript: [
    {
      beatKey: "delphine_open",
      suspectMessages: [
        "hello you.",
        "you smell like someone who overthinks first messages.",
      ],
      replyOptions: [
        "how can you tell?",
        "ouch.",
        "guilty.",
      ],
    },
    {
      beatKey: "delphine_surprise",
      suspectMessages: [
        "i can always tell.",
        "tell me the last thing that surprised you.",
      ],
      replyOptions: [
        "my own answer.",
        "the weather.",
        "you.",
      ],
    },
    {
      beatKey: "delphine_meet",
      suspectMessages: [
        "nicely done.",
        "we should meet. i don't believe in long preludes.",
      ],
      replyOptions: [
        "agreed.",
        "where?",
        "soon.",
      ],
    },
  ],
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
  killerScript: [
    {
      beatKey: "jules_open",
      suspectMessages: [
        "hey.",
        "lemme guess what you ordered in that photo. negroni?",
      ],
      replyOptions: [
        "close — paloma.",
        "you guess everyone's drink?",
        "what would *you* have made?",
      ],
    },
    {
      beatKey: "jules_lantern",
      suspectMessages: [
        "paloma, respectable.",
        "we get a lot of palomas at the lantern. swing by tuesday — quiet night.",
      ],
      replyOptions: [
        "the lantern — where's that?",
        "tuesday's slow everywhere.",
        "you working tuesday?",
      ],
    },
    {
      beatKey: "jules_closing",
      suspectMessages: [
        "downtown, off third. red sign you'd miss if you blinked.",
        "i close most weeknights. it's mine after eleven.",
      ],
      replyOptions: [
        "alone?",
        "long hours.",
        "what do you do after?",
      ],
    },
    {
      beatKey: "jules_alone_after",
      suspectMessages: [
        "yeah, alone — bartender's privilege.",
        "after? sometimes the band practices. sometimes i just walk.",
      ],
      replyOptions: [
        "walk where?",
        "tell me about the band.",
        "quiet life.",
      ],
    },
  ],
};

/* ───────────────────────── River — fully authored ────────────────────── */

const river: IdentityModule = {
  identity: "river",
  displayName: "River Sutherland",
  concept:
    "Climbing instructor and weekend trail guide. Sun-bleached, easy in his body, asks more questions than he answers. The carabiner on his belt is decorative — and isn't.",
  buildDeck: () => [
    {
      id: newCandidateId(),
      identity: "river",
      displayName: "River",
      age: 30,
      tagline: "Climber. Sleeps better at altitude.",
      bio:
        "Runs guided routes out of a small outfitter near the gorge. Spends weekdays teaching beginners how to fall safely and Sundays alone on rock that scares his clients. Says he's looking for someone who doesn't need a phone signal to be okay.",
      portraitAssetId: "A055_river_portrait_smile",
      prompts: [
        "First date energy: tailgate by the trailhead, bad coffee, real conversation.",
        "Two true things: I've slept under stars more nights than ceilings this year, and I'll absolutely teach you the figure-eight knot.",
        "Dealbreaker: people who treat a parking lot like a personality.",
      ],
      isKillerCandidate: true,
    },
    {
      id: newCandidateId(),
      identity: "river",
      displayName: "Hank",
      age: 32,
      tagline: "Trail-running coach. Up before sunrise.",
      bio:
        "Coaches a small ultra crew out of a barn east of town. Drinks his coffee cold because he forgets it. Easy company on long miles, quiet in a kitchen.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "Best date: a sunrise loop and breakfast we're too tired to talk through.",
        "I won't apologize for: the alarm at 4:30.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "river",
      displayName: "Soren",
      age: 29,
      tagline: "Arborist. Quiet about it.",
      bio:
        "Climbs the kind of trees most people don't notice. Carries a paperback in his harness bag. Will name three birds before you've finished your sentence.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "I get evangelical about: pruning timing.",
        "Sunday: somewhere green, no signal, slow lunch after.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "river",
      displayName: "Marit",
      age: 31,
      tagline: "Wilderness EMT. Calm in a crisis.",
      bio:
        "Spends summers stationed near alpine huts and winters teaching avalanche awareness. Has the kind of laugh that defuses a room. Doesn't tell stories on a first date.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "Skill I'm weirdly proud of: tying a sling out of a bandana.",
        "Green flag: knowing which end of a map is north without thinking.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "river",
      displayName: "Pax",
      age: 27,
      tagline: "Mapmaker. Draws places nobody walks anymore.",
      bio:
        "Ink-and-paper cartographer; sells small editions at a bookshop on the river. Geeks out about old fire-lookout routes and the typography of contour lines.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "I'll bring on a hike: a thermos and a hand-drawn map of where we are.",
        "If we get along we'll eventually argue about: the right shade of forest green.",
      ],
      isKillerCandidate: false,
    },
  ],
  beats: {
    1: [
      "River opens with a soft compliment about a backdrop in one of your photos — names the ridge it was taken from. Invites you to the gorge 'next free Sunday, weather depending'.",
      "Mentions he's running a beginner clinic at the climbing gym Tuesdays and Thursdays. Says you should drop by 'even if you just want to watch'.",
    ],
    2: [
      "Asks if you've ever been somewhere with no cell signal. Listens carefully.",
      "Lets slip that he was 'scouting a new line solo' the weekend something happened in the foothills (TODO Pass 4 — anchor fact).",
    ],
    3: [
      "TODO Pass 4 — first contradiction beat (claimed solo scout vs. a witness placing him at the trailhead with someone else).",
    ],
  },
  killerScript: [
    {
      beatKey: "river_open",
      suspectMessages: [
        "hey.",
        "you ever been somewhere with no signal? like, real no signal.",
      ],
      replyOptions: [
        "once or twice.",
        "not on purpose.",
        "tell me where.",
      ],
    },
    {
      beatKey: "river_invite",
      suspectMessages: [
        "i'm out at the gorge sundays.",
        "easy route. bad coffee. real conversation.",
      ],
      replyOptions: [
        "i'd come.",
        "rain check?",
        "what counts as easy?",
      ],
    },
    {
      beatKey: "river_alibi",
      suspectMessages: [
        "last weekend i was scouting a new line. solo.",
        "nobody around. just me and the rock.",
      ],
      replyOptions: [
        "sounds peaceful.",
        "solo, huh.",
        "where, exactly?",
      ],
    },
  ],
};

/* ───────────────────────── Sam — fully authored ──────────────────────── */

const sam: IdentityModule = {
  identity: "sam",
  displayName: "Samira Okonkwo",
  concept:
    "Hospice nurse who reads paperback mysteries on her breaks. Quiet, watchful, makes you feel safe — until you start to wonder why she's so good at it.",
  buildDeck: () => [
    {
      id: newCandidateId(),
      identity: "sam",
      displayName: "Sam",
      age: 31,
      tagline: "Nurse. Soft voice, very steady hands.",
      bio:
        "Works the overnight rotation on a hospice floor downtown. Drinks her coffee with too much sugar and won't apologize for it. Says the best dates are the ones where you both forget what time it is.",
      portraitAssetId: "A059_sam_portrait_smile",
      prompts: [
        "On a first date I'll notice: how you talk to the server.",
        "Comfort thing nobody knows: I keep a list of every paperback I've finished on a shift.",
        "Honest red flag: people who say they 'don't really do hospitals'.",
      ],
      isKillerCandidate: true,
    },
    {
      id: newCandidateId(),
      identity: "sam",
      displayName: "Adaeze",
      age: 29,
      tagline: "Pharmacist. Reads ingredient lists like poetry.",
      bio:
        "Runs the late shift at an independent pharmacy near the university. Has strong opinions about scented candles and very gentle ones about people.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "Skill I'm proud of: spotting a knockoff at twenty paces.",
        "Slow Sunday: the long crossword and a market walk.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "sam",
      displayName: "Cassidy",
      age: 27,
      tagline: "Vet tech. Better with animals than email.",
      bio:
        "Works at a small animal clinic and fosters whatever no one else will take home. Bad at texting, generous in person, makes a mean chili.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "Wildest day at work: a goat. Don't ask.",
        "Date plan: a long walk and an even longer dinner.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "sam",
      displayName: "Lila",
      age: 33,
      tagline: "Medical illustrator. Draws hearts for textbooks.",
      bio:
        "Freelance illustrator for med school publishers. Lives in a sunny studio with too many house plants and one very judgmental cat.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "I get into arguments about: serif fonts on diagrams.",
        "Sunday morning: I draw something I'll never show anyone.",
      ],
      isKillerCandidate: false,
    },
    {
      id: newCandidateId(),
      identity: "sam",
      displayName: "Yvonne",
      age: 35,
      tagline: "Hospital chaplain. Listens for a living.",
      bio:
        "Sits with people on the worst days of their lives and somehow comes home full of stories about kindness. Walks everywhere; never owned a car.",
      portraitAssetId: "A500_avatar_placeholder",
      prompts: [
        "I won't apologize for: long silences.",
        "What I'm reading: poetry, almost always.",
      ],
      isKillerCandidate: false,
    },
  ],
  beats: {
    1: [
      "Sam opens with a soft compliment — 'you have a kind face, I've gotten good at noticing those'. Invites you to a Tuesday open mic at a quiet bar she likes.",
      "Mentions she's between rotations 'right now' and her schedule is finally human (TODO Pass 4 — anchor fact for shift hours).",
    ],
    2: [
      "Asks about the last time you saw someone you loved cry. Listens really carefully.",
      "Drops that she 'pulled a double on the unit' the night something happened in the neighborhood (TODO Pass 4 — anchor fact).",
    ],
    3: [
      "TODO Pass 4 — first contradiction beat (claimed double shift vs. badge swipe records placing her offsite for two hours).",
    ],
  },
  killerScript: [
    {
      beatKey: "sam_open",
      suspectMessages: [
        "hi.",
        "you have a kind face. i've gotten good at noticing those.",
      ],
      replyOptions: [
        "thank you.",
        "noticing how?",
        "occupational hazard?",
      ],
    },
    {
      beatKey: "sam_invite",
      suspectMessages: [
        "there's a quiet bar i like. tuesdays.",
        "open mic, but the kind nobody listens to. easier to talk.",
      ],
      replyOptions: [
        "i could do tuesday.",
        "describe it.",
        "what would we talk about?",
      ],
    },
    {
      beatKey: "sam_alibi",
      suspectMessages: [
        "i pulled a double on the unit last week.",
        "long night. you forget what time it is in there.",
      ],
      replyOptions: [
        "that sounds rough.",
        "any of it stay with you?",
        "which night, exactly?",
      ],
    },
  ],
};

/* ─────────────────────────── registry ────────────────────────────────── */

export const IDENTITY_REGISTRY: Record<KillerIdentity, IdentityModule> = {
  miles,
  tessa,
  ren,
  kai,
  delphine,
  jules,
  river,
  sam,
};

export function getIdentityModule(id: KillerIdentity): IdentityModule {
  return IDENTITY_REGISTRY[id];
}

/**
 * Resolves the chat script for a single candidate. The killer-candidate
 * uses their authored identity script; everyone else gets the shared
 * INNOCENT_SCRIPT. Pass 4 will replace this with fact-aware planning.
 */
export function getScriptForCandidate(
  candidate: Candidate,
): DialogueTurn[] {
  if (candidate.isKillerCandidate) {
    return getIdentityModule(candidate.identity).killerScript;
  }
  return INNOCENT_SCRIPT;
}
