/**
 * KillerIdentity protocol + 8 identity modules.
 *
 * Pass 1 shipped fully-authored seed candidates + narrative beats for
 * Miles, Jules, Kai, River and Sam; the other three (Tessa, Ren,
 * Delphine) used `stubDeck()` placeholders so the five-candidate
 * roster stays valid while their bios/portraits are filled in.
 *
 * Pass 4 wires the Clue Graph: every identity now declares its own
 * `conditionalFactIDs`, `variableOverrides`, and `solvingDeduction`
 * (3–5 facts, authored narrative beat). The previous one-fact
 * `stubGraph()` helper was removed once the last killer was upgraded
 * — accusations now resolve against a real evidence chain for
 * every killer in the cast.
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

import { decoysForKiller } from "./decoyPool";
import { getInnocentTreeById } from "./innocentTrees";
import {
  Candidate,
  Deduction,
  FactId,
  FactPayload,
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

  /* ───────── Pass 4 — Clue Graph wiring ─────────────────────────────
   *
   * Each module declares which authored facts the bootstrapper should
   * surface when this identity is the active killer, plus the
   * solving deduction the accusation resolver scores against. See
   * `core/factBootstrap.ts` and `core/accusation.ts` for the reader.
   *
   * Every identity in the registry now ships with a real 3–5 fact
   * solving deduction, per-killer variable payload swaps, and
   * conditional fact rows authored in `factUniverse.json` — the
   * one-fact `stubGraph()` helper that earlier passes relied on has
   * been removed.
   */

  /** Authored fact ids only included when this identity is the killer. */
  conditionalFactIDs: FactId[];
  /**
   * Per-killer payload swaps for `kind: "variable"` rows in the
   * universe. The bootstrapper substitutes these in over the row's
   * default payload before the Fact lands on the run.
   */
  variableOverrides: Record<FactId, FactPayload>;
  /**
   * The deduction the accusation resolver scores the player's
   * discovered fact set against. Required for every identity — the
   * resolver subset-checks `requiredFactIDs` against the player's
   * discovered set to decide whether the full chain landed.
   */
  solvingDeduction: Deduction;
  /**
   * Fact ids that look damning but aren't part of the solving
   * deduction. Empty for every identity today; reserved for a future
   * authoring pass that adds misdirection facts on top of the chain.
   */
  redHerrings: FactId[];
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
    ...decoysForKiller("miles"),
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

  // Conditional facts only the player sees if Miles is the killer.
  // Mirrors the doc's "double-blind tell" worked example.
  conditionalFactIDs: [
    "miles_portrait_uneasy_day5",
    "dev_text_day4_miles_sus",
  ],
  // Variable payload swaps — same authored fact id, different content
  // depending on who's actually guilty this run.
  variableOverrides: {
    miles_bio_downtown_view: {
      text:
        "Miles's bio: 'morning light over the canal'. The window faces the warehouse strip the news mentioned — directly across the water.",
    },
    miles_ig_window_reflection: {
      text:
        "Recent IG post — coffee on a windowsill. The reflection in the glass shows the bridge nearest the warehouse, on a morning the news called overcast — but the photo is bright.",
    },
  },
  // The chain of evidence that clinches the case if Miles is the
  // killer. The accusation resolver subset-checks discovered facts
  // against this list.
  solvingDeduction: {
    id: "miles_solve_canal_warehouse",
    requiredFactIDs: [
      "miles_bio_downtown_view",
      "miles_ig_window_reflection",
      "miles_portrait_uneasy_day5",
      "dev_text_day4_miles_sus",
    ],
    narrativeBeat:
      "His own window gave him away. The bio said 'morning light over the canal'. The IG photo's reflection put him at the bridge by the warehouse on a day the weather report said it was raining. Dev's text put him there at night. The day-5 portrait was the face of someone who'd realized you'd noticed.",
  },
  redHerrings: [],
};

/* ─────────── stub-deck helper (Tessa, Ren, Delphine) ─────────────────── */

function stubDeck(
  identity: KillerIdentity,
  killerName: string,
  killerTagline: string,
): Candidate[] {
  // Tessa, Ren, and Delphine still rely on this placeholder swipe-deck
  // entry — their clue graphs are fully authored, but the swipe-deck
  // bio + portrait have yet to be filled in. Decoys are drawn from the
  // shared NPC pool (core/decoyPool.ts) so every roster ships with
  // real portraits + bios from day one.
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
    ...decoysForKiller(identity),
  ];
}

const tessa: IdentityModule = {
  identity: "tessa",
  displayName: "Tessa Lin",
  concept:
    "Late-night radio host with too many keys on her keychain. Voice you'd recognize, hours nobody can verify.",
  buildDeck: () => stubDeck("tessa", "Tessa", "Voice you'd recognize on the radio."),
  beats: {
    1: [
      "Tessa opens with a low-key joke about you being polite in your bio about radio.",
      "Mentions the late slot — midnight to four — and that you should listen sometime.",
    ],
    2: [
      "Asks what you do when you can't sleep, then names a song she queued the night something happened.",
      "Drops that she 'pulled the late slot solo' the night the news flagged (TODO Pass 5 — anchor fact).",
    ],
    3: [
      "First contradiction: a clip she sent doesn't match the time she claimed to be on air.",
    ],
  },
  conditionalFactIDs: [
    "tessa_conditional_lateshift",
    "tessa_portrait_uneasy_day5",
  ],
  variableOverrides: {
    tessa_bio_lateslot: {
      text:
        "Tessa's bio claims she's on-air midnight to four most weeknights — but Dev's tip later says the station has been running reruns under her name for weeks. The bio sells an alibi she stopped earning.",
    },
    tessa_ig_keychain: {
      text:
        "Recent Tessa IG — a keychain dropped on the studio console. One key on the ring isn't a station key. The shape matches a back-door type the news mentioned about the warehouse strip.",
    },
  },
  solvingDeduction: {
    id: "tessa_solve_offair_keychain",
    requiredFactIDs: [
      "tessa_bio_lateslot",
      "tessa_ig_keychain",
      "tessa_conditional_lateshift",
      "tessa_portrait_uneasy_day5",
    ],
    narrativeBeat:
      "She wasn't on air. The station had been looping reruns under her name for weeks. The keychain in her IG carried a key she never explained — the same back-door shape the news mentioned about the warehouse strip. The day-5 portrait flinched a half-second before she did.",
  },
  redHerrings: [],
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
  concept:
    "Competitive sailor with a temper he calls 'focus'. Dawn routines that don't quite line up with the marina's clock.",
  buildDeck: () => stubDeck("ren", "Ren", "Sailor. Up at five. Don't ask why."),
  beats: {
    1: [
      "Ren opens with a teasing line about you never having been on a boat.",
      "Mentions he's at the marina before sunrise — four-thirty most mornings.",
    ],
    2: [
      "Asks if you've ever been awake when the city was still off.",
      "Drops that he was 'first one in' the morning the news flagged (TODO Pass 5 — anchor fact).",
    ],
    3: [
      "First contradiction: the marina office hours don't match the dawn-call he keeps selling.",
    ],
  },
  conditionalFactIDs: [
    "ren_conditional_dawn_alibi",
    "ren_portrait_sinister_day5",
  ],
  variableOverrides: {
    ren_bio_dawn_call: {
      text:
        "Ren's bio sells the four-thirty start as the marina's rule — but the marina office doesn't open until six, and the sign-out logs Dev pulled put him out hours earlier than dawn.",
    },
    ren_ig_marina_lights: {
      text:
        "Recent Ren IG — a marina under floodlights, captioned 'first one in'. Across the water the warehouse strip is dark, which makes this well after midnight, not dawn.",
    },
  },
  solvingDeduction: {
    id: "ren_solve_dawn_lie",
    requiredFactIDs: [
      "ren_bio_dawn_call",
      "ren_ig_marina_lights",
      "ren_conditional_dawn_alibi",
      "ren_portrait_sinister_day5",
    ],
    narrativeBeat:
      "His 'four-thirty most mornings' was a story the marina logs didn't back up — Dev pulled the sign-out sheet himself. The IG photo he labeled 'first one in' was taken with the warehouse strip dark across the water: middle of the night, not dawn. The day-5 portrait was a man who'd realized he'd told the wrong person.",
  },
  redHerrings: [],
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
    ...decoysForKiller("kai"),
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
  conditionalFactIDs: [
    "kai_conditional_paint_late",
    "kai_portrait_sinister_day5",
  ],
  variableOverrides: {
    kai_bio_transit_wall: {
      text:
        "Kai's bio invites you 'down by the old transit lot' to see the new piece — but the lot's been fenced off for a month. Whatever wall he's standing in front of, it isn't the one he says it is.",
    },
    kai_ig_scissor_lift: {
      text:
        "Recent Kai IG from the scissor lift — over his shoulder, a strip of warehouse roofs. Same skyline the news camera caught the night the warehouse strip was named.",
    },
  },
  solvingDeduction: {
    id: "kai_solve_fenced_lot",
    requiredFactIDs: [
      "kai_bio_transit_wall",
      "kai_ig_scissor_lift",
      "kai_conditional_paint_late",
      "kai_portrait_sinister_day5",
    ],
    narrativeBeat:
      "He told you he was painting late by the transit lot — but the lot's been fenced off for a month. The IG from the lift looked across at the warehouse roofs the news camera caught the same night. The 'painter brain' that remembered every face had been remembering yours, too. The day-5 portrait stopped pretending it hadn't.",
  },
  redHerrings: [],
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
  concept:
    "Perfumer who claims she can smell secrets. Quiet shop, quieter nights, an alibi that doesn't quite hold its shape.",
  buildDeck: () =>
    stubDeck("delphine", "Delphine", "Makes scents. Also reads palms, maybe."),
  beats: {
    1: [
      "Delphine opens with a flirty 'you smell like someone who overthinks first messages'.",
      "Mentions the shop's quiet hours — perfume's better when the city's asleep.",
    ],
    2: [
      "Asks about the last thing that surprised you, then re-routes to a story about being 'home all night' the night the news flagged.",
      "Drops a casual reference to opening at seven the next morning (TODO Pass 5 — anchor fact).",
    ],
    3: [
      "First contradiction: a candle in her IG reflects a streetlamp she shouldn't have been able to see from home.",
    ],
  },
  conditionalFactIDs: [
    "delphine_conditional_smell_secret",
    "delphine_portrait_uneasy_day5",
  ],
  variableOverrides: {
    delphine_bio_quiet_nights: {
      text:
        "Delphine's bio leans on 'quiet nights at the shop' — but she told you she was 'home all night' the night the news flagged. Both can't be true.",
    },
    delphine_ig_workbench: {
      text:
        "Recent Delphine IG — workbench, bottles, half-burnt candle. The window over the bench reflects a streetlamp from the warehouse corner three blocks away — not the alley her apartment looks onto.",
    },
  },
  solvingDeduction: {
    id: "delphine_solve_window_lamp",
    requiredFactIDs: [
      "delphine_bio_quiet_nights",
      "delphine_ig_workbench",
      "delphine_conditional_smell_secret",
      "delphine_portrait_uneasy_day5",
    ],
    narrativeBeat:
      "She said she was home all night. The shop receipts had her opening at seven the next morning, and the IG from her workbench reflected a streetlamp on the warehouse corner — three blocks from where she said she was. She'd been in the shop, and not for perfume. The day-5 portrait already knew the moment you'd asked.",
  },
  redHerrings: [],
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
    ...decoysForKiller("jules"),
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
  // Jules is the doc's worked-example "other side" of the
  // double-blind tell. When Jules is the killer, the same
  // Miles-about variable facts read with a different subtext, and
  // the conditional `dev_text_day4_jules_sus` plus
  // `jules_portrait_sinister_day5` pin him down instead of Miles.
  conditionalFactIDs: [
    "jules_portrait_sinister_day5",
    "dev_text_day4_jules_sus",
  ],
  variableOverrides: {
    miles_bio_downtown_view: {
      text:
        "Miles's bio mentions the canal view — the same canal Jules's bar overlooks from the other side. Miles isn't the one with the late nights there.",
    },
    jules_bio_night_walks: {
      text:
        "Jules's bio: 'i close most weeknights. it's mine after eleven' — the route he 'walks off' passes the warehouse strip the news mentioned.",
    },
    jules_ig_canal_late: {
      text:
        "Jules's IG story: a quiet street at 2am — geotag puts it three blocks from the warehouse, the night the news report timestamps.",
    },
  },
  solvingDeduction: {
    id: "jules_solve_closing_walk",
    requiredFactIDs: [
      "jules_bio_night_walks",
      "jules_ig_canal_late",
      "jules_portrait_sinister_day5",
      "dev_text_day4_jules_sus",
    ],
    narrativeBeat:
      "He told you he closed alone after eleven. The IG story put him three blocks from the warehouse at two. Sasha said the bar was dark by ten — so where was he between? The day-5 portrait answered it before he did.",
  },
  redHerrings: [],
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
    ...decoysForKiller("river"),
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
  conditionalFactIDs: [
    "river_conditional_solo_scout",
    "river_portrait_sinister_day5",
  ],
  variableOverrides: {
    river_bio_solo_sundays: {
      text:
        "River's bio sells the 'solo sundays' line — but a hiker put him at the trailhead with someone else last weekend. The 'solo' is a story he's been telling for a while.",
    },
    river_ig_trailhead: {
      text:
        "Recent River IG — a trailhead at first light, captioned 'just me and the rock'. Two pairs of boots are visible in the corner of the truck bed; he cropped the second pair almost out of frame.",
    },
  },
  solvingDeduction: {
    id: "river_solve_solo_lie",
    requiredFactIDs: [
      "river_bio_solo_sundays",
      "river_ig_trailhead",
      "river_conditional_solo_scout",
      "river_portrait_sinister_day5",
    ],
    narrativeBeat:
      "He sold you 'solo sundays' — but a hiker placed him at the trailhead with someone else, and the IG photo he captioned 'just me and the rock' had a second pair of boots in the truck bed he almost cropped out. The day-5 portrait was the face of someone who'd realized he hadn't cropped them far enough.",
  },
  redHerrings: [],
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
    ...decoysForKiller("sam"),
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
  conditionalFactIDs: [
    "sam_conditional_double_shift",
    "sam_portrait_sinister_day5",
  ],
  variableOverrides: {
    sam_bio_overnight: {
      text:
        "Sam's bio leans on the 'overnights on the unit' line — but the badge swipes that should anchor the alibi don't quite cover the night the news flagged.",
    },
    sam_ig_breakroom: {
      text:
        "Recent Sam IG — a breakroom shelf of paperback mysteries. The window above it shows the warehouse strip across the river — not the courtyard the unit's actual breakroom faces.",
    },
  },
  solvingDeduction: {
    id: "sam_solve_offsite_breakroom",
    requiredFactIDs: [
      "sam_bio_overnight",
      "sam_ig_breakroom",
      "sam_conditional_double_shift",
      "sam_portrait_sinister_day5",
    ],
    narrativeBeat:
      "She said she pulled a double, but her badge was off the floor for two hours. The 'breakroom' photo she posted that night looked across the river at the warehouse strip — not the courtyard the unit's actual breakroom faces. She wasn't where she said she was. The day-5 portrait stopped trying to tell you she was.",
  },
  redHerrings: [],
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
 * INNOCENT_SCRIPT.
 *
 * Prefer `getScriptForThread` for innocent matches now that each thread
 * carries an `innocentScriptId` drawn from `INNOCENT_TREE_POOL` — this
 * helper is kept for the killer path (where the candidate alone decides
 * the script) and as a safety net for legacy callers without a thread
 * in hand.
 */
export function getScriptForCandidate(
  candidate: Candidate,
): DialogueTurn[] {
  if (candidate.isKillerCandidate && candidate.identity) {
    return getIdentityModule(candidate.identity).killerScript;
  }
  return INNOCENT_SCRIPT;
}

/**
 * Task #58 — script for a single thread. Killer threads still use the
 * killer-candidate's authored `killerScript`; non-killer threads with
 * an `innocentScriptId` use that tree from `INNOCENT_TREE_POOL`. Threads
 * persisted before the pool landed (no `innocentScriptId`) fall back to
 * the legacy shared `INNOCENT_SCRIPT` so saves still hydrate cleanly.
 */
export function getScriptForThread(
  thread: { innocentScriptId?: string },
  candidate: Candidate,
): DialogueTurn[] {
  if (candidate.isKillerCandidate && candidate.identity) {
    return getIdentityModule(candidate.identity).killerScript;
  }
  if (thread.innocentScriptId) {
    const tree = getInnocentTreeById(thread.innocentScriptId);
    if (tree) return tree.turns;
  }
  return INNOCENT_SCRIPT;
}
