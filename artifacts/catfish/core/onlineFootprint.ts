/**
 * Per-character online footprint — what the player finds when they
 * background-check a match through Goggle, LinkedOut, and Instagrim.
 *
 * Two gate kinds drive the "pull the thread" gameplay loop:
 *
 *   - `day`: row is hidden until `run.day >= gate.day`. Used for the
 *     ten innocent decoys whose footprints fill in over the week so
 *     the player feels real-time accretion.
 *   - `requiredFactIds`: row is hidden until every listed fact-id is
 *     present in `run.facts` (by `authoringKey`). Used exclusively for
 *     the active killer — their footprint reads as suspiciously thin
 *     until the player captures a corroborating clue (warehouse fire
 *     news, marina logs, etc.) that "pulls the thread" and surfaces
 *     a flagged job, a deleted-looking post, or a corroborating hit.
 *
 * Both gate kinds may co-exist on the same row; both must pass.
 *
 * Lookup key: candidate `displayName.toLowerCase()`. That's stable for
 * both killers (Miles/Tessa/Ren/…) and decoy templates (Lola/Ari/…),
 * doesn't depend on the per-run candidate id (which is random), and
 * survives the killer/decoy distinction since killers and decoys live
 * in disjoint name pools today.
 */

import type { CaseRun } from "./models";

export type FootprintKey = string;

export interface FootprintGate {
  /** Day-of-run when this row becomes visible. Inclusive lower bound. */
  day?: number;
  /**
   * Authoring keys (from `factUniverse.json`) that must be present in
   * `run.facts[].authoringKey` before the row appears. Used for killer
   * gating; innocent rows leave this undefined.
   */
  requiredFactIds?: string[];
}

export type GoggleHitKind = "news" | "profile" | "forum" | "social-mention";

export interface GoggleHit {
  id: string;
  /** Candidate displayName, lowercased. */
  key: FootprintKey;
  headline: string;
  excerpt: string;
  kind: GoggleHitKind;
  gate: FootprintGate;
  /** factUniverse authoring key — if set, opening commits the fact. */
  linkedFactId?: string;
}

export interface LinkedOutRow {
  id: string;
  /** Company or institution name. */
  org: string;
  title: string;
  years: string;
  gate: FootprintGate;
  /** True for the small handful of rows that look "off" in context. */
  flagged?: boolean;
  linkedFactId?: string;
}

export interface LinkedOutProfile {
  key: FootprintKey;
  headline: string;
  location: string;
  experience: LinkedOutRow[];
  education: LinkedOutRow[];
  skills: string[];
  mutuals: number;
}

export interface InstaPost {
  id: string;
  key: FootprintKey;
  caption: string;
  location?: string;
  timestamp: string;
  gate: FootprintGate;
  linkedFactId?: string;
  /** Color of the pixel-art placeholder thumbnail. */
  swatch: string;
}

/* ───────────────────────── Goggle ─────────────────────────── */

const GOGGLE: GoggleHit[] = [
  /* Killers — fact-gated. */
  {
    id: "g_miles_1",
    key: "miles",
    headline: "Miles Carver — Personal Site",
    excerpt: "film photography · backend engineering · portfolio updated last spring.",
    kind: "profile",
    gate: { requiredFactIds: ["canal_warehouse_fire"] },
  },
  {
    id: "g_miles_2",
    key: "miles",
    headline: "Eastside Arson Watch — community blog",
    excerpt:
      "A neighborhood thread lists residents who've been seen near the warehouse on multiple nights. One commenter mentions 'the tall guy with the film camera'.",
    kind: "forum",
    gate: { requiredFactIds: ["canal_warehouse_fire", "burned_phone_recovered"] },
    linkedFactId: "canal_warehouse_fire",
  },

  {
    id: "g_tessa_1",
    key: "tessa",
    headline: "Tessa Lin — late-night radio bio",
    excerpt: "midnight–4am host. archive page. last station update was months ago.",
    kind: "profile",
    gate: { requiredFactIds: ["medical_cart_rental"] },
  },
  {
    id: "g_tessa_2",
    key: "tessa",
    headline: "Hospital Procurement Records — Open Data Portal",
    excerpt:
      "A search of the latest procurement spreadsheet returns one residential address — flagged for a recurring medical-cart rental. The address matches a name you recognize.",
    kind: "news",
    gate: { requiredFactIds: ["medical_cart_rental"] },
    linkedFactId: "medical_cart_rental",
  },

  {
    id: "g_ren_1",
    key: "ren",
    headline: "Ren Okafor — sailing club roster",
    excerpt: "active member, listed for the dawn class. last logged race was 2022.",
    kind: "profile",
    gate: { requiredFactIds: ["marina_logs_early"] },
  },
  {
    id: "g_ren_2",
    key: "ren",
    headline: "Marina Dawn Logs Mismatch — Local Beat",
    excerpt:
      "A small piece in the weekly notes that several sailors signed out hours before their stated dawn departure. One name on the published list: R. Okafor.",
    kind: "news",
    gate: { requiredFactIds: ["marina_logs_early", "dawn_departure_log"] },
    linkedFactId: "dawn_departure_log",
  },

  {
    id: "g_kai_1",
    key: "kai",
    headline: "Kai Brennan — mural commissions",
    excerpt: "freelance muralist · public-art portfolio · last commission was a transit-lot piece.",
    kind: "profile",
    gate: { requiredFactIds: ["transit_lot_fenced"] },
  },
  {
    id: "g_kai_2",
    key: "kai",
    headline: "Stop-Work Order: Old Transit Lot",
    excerpt:
      "City inspectors closed the transit-lot site for permit issues. Note in the filing: 'no active commissions on file for the period claimed.'",
    kind: "news",
    gate: { requiredFactIds: ["transit_lot_fenced", "paint_studio_ventilation"] },
    linkedFactId: "transit_lot_fenced",
  },

  {
    id: "g_delphine_1",
    key: "delphine",
    headline: "Delphine Roux — perfumery social page",
    excerpt: "quiet hours · small batches · open by appointment.",
    kind: "profile",
    gate: { requiredFactIds: ["parfume_shop_receipts"] },
  },
  {
    id: "g_delphine_2",
    key: "delphine",
    headline: "Small-Business Compliance Sweep — Sample Findings",
    excerpt:
      "A boutique perfumery on the quiet side of downtown was flagged for receipt-time discrepancies — opening receipts logged hours before stated open.",
    kind: "news",
    gate: { requiredFactIds: ["parfume_shop_receipts"] },
    linkedFactId: "parfume_shop_receipts",
  },

  {
    id: "g_jules_1",
    key: "jules",
    headline: "Jules Vega — bar staff listing",
    excerpt: "downtown bar manager · listed on the late-shift roster.",
    kind: "profile",
    gate: { requiredFactIds: ["bar_staff_tuesday"] },
  },
  {
    id: "g_jules_2",
    key: "jules",
    headline: "Tuesday Closing Schedules Released",
    excerpt:
      "Several downtown bars submitted staff schedules under a city request. One manager's name appears on a roster that lists him 'closed alone' — though regulars say the bar was dark by ten.",
    kind: "news",
    gate: { requiredFactIds: ["bar_staff_tuesday"] },
    linkedFactId: "bar_staff_tuesday",
  },

  {
    id: "g_river_1",
    key: "river",
    headline: "River Sutherland — trail guide page",
    excerpt: "registered guide · gorge-loop specialist · last update was over a year ago.",
    kind: "profile",
    gate: { requiredFactIds: ["trail_camera_gorge"] },
  },
  {
    id: "g_river_2",
    key: "river",
    headline: "Gorge Trail Camera Network Expanded",
    excerpt:
      "Three new trail cameras went live along the gorge approach. The parks department says weekly footage reviews have already produced 'a person of interest'.",
    kind: "news",
    gate: { requiredFactIds: ["trail_camera_gorge", "gorge_trailhead_two"] },
    linkedFactId: "trail_camera_gorge",
  },

  {
    id: "g_sam_1",
    key: "sam",
    headline: "Samira Okonkwo — city-worker directory",
    excerpt: "field operations · badge no. listed but inactive on multiple recent days.",
    kind: "profile",
    gate: { requiredFactIds: ["badge_swipes_offsite"] },
  },
  {
    id: "g_sam_2",
    key: "sam",
    headline: "Public Records: Off-Site Badge Swipes",
    excerpt:
      "A FOIA release of city-worker badge data flagged off-site swipes during claimed shift hours. One employee's badge appears on the list across a two-week window.",
    kind: "news",
    gate: { requiredFactIds: ["badge_swipes_offsite"] },
    linkedFactId: "badge_swipes_offsite",
  },

  /* Innocent decoys — day-gated. Each gets 3 hits across days 1/2/4. */
  ...decoyGoggleHits(),
];

function decoyGoggleHits(): GoggleHit[] {
  const list: Array<[FootprintKey, [string, string][]]> = [
    [
      "lola",
      [
        ["Lola — Surf School Listing", "south jetty beginner sets · 6am Tue/Thu/Sat · book by text."],
        ["Salt + Thread Vintage — Local Shop Spotlight", "van-based vintage shop with rotating drop schedule. Owner profile attached."],
        ["Lola @ Beachside Markets — Vendor List", "regular Sunday vendor for the past two seasons."],
      ],
    ],
    [
      "ari",
      [
        ["Ari — Staff Page, Old Bay Books", "fiction-section lead · book-recommendation column 'Press Pick'."],
        ["Old Bay Books Reading Series", "monthly author Q&A hosted by Ari; archived recordings available."],
        ["City Lit Newsletter — Contributor", "guest column on independent fiction; bio links to bookstore."],
      ],
    ],
    [
      "onyx",
      [
        ["Onyx — Nightlife Photo Portfolio", "warehouse parties, release shows, indie label tours."],
        ["Behind the Lens: Onyx — Profile Q&A", "interview about shooting in low light without flash."],
        ["Tour Diary: West Coast Run — Onyx (credited)", "photo essay credited to Onyx; six-show West Coast run."],
      ],
    ],
    [
      "micah",
      [
        ["Micah — Park Ranger Profile", "long-loop trail maintenance · bird-count program lead."],
        ["State Forest Bird Count 2024 — Lead Volunteers", "co-authored summary with annual count totals."],
        ["Trail Notes: After the Storm — by Micah", "personal blog entry on post-storm trail repair."],
      ],
    ],
    [
      "sienna",
      [
        ["Sienna — Gallery Assistant Bio", "downtown gallery staff · curatorial assistant since 2022."],
        ["Zine: Side Wall — Issue 4 (editor: Sienna)", "downloadable PDF; editor's note signed S.M."],
        ["Opening Night Coverage — Photo Credit: Sienna", "local arts blog credits her for opening-night photography."],
      ],
    ],
    [
      "eli",
      [
        ["Eli — Reference Librarian, Central Branch", "library staff directory · cardigan optional."],
        ["Library Reading Picks — Eli's List", "monthly reading recommendations; bio on staff page."],
        ["Free WiFi Around Town — community wiki contributor", "wiki edit history attributes city-wifi map to Eli."],
      ],
    ],
    [
      "penny",
      [
        ["Penny — Illustrator Portfolio", "children's book illustration · freelance · small press credits."],
        ["Bookshelf Buddies — Spring Catalogue", "Penny credited as cover illustrator on three titles."],
        ["Studio Tour: Penny — Behind the Scenes", "interview about her sunlit studio and two studio cats."],
      ],
    ],
    [
      "cam",
      [
        ["Cam — Cellarman at Eastside Brewing", "staff profile · hop-growing on the fire escape."],
        ["Eastside Brewing Beer Release — tasting notes by Cam", "release post quotes Cam on a small-batch pour."],
        ["Plaid Forever — homebrew forum profile", "registered user · long thread history on dry hopping."],
      ],
    ],
    [
      "zora",
      [
        ["Zora — Brand Strategist, Nightlife Co.", "directory profile · venue marketing lead since 2021."],
        ["Late City Newsletter — Z's Picks", "weekly newsletter edition signed 'Z'; published every Friday."],
        ["Doorlist Database — Zora is a +1 friendly", "industry list naming her as a regular promoter contact."],
      ],
    ],
    [
      "reyn",
      [
        ["Reyn — Bedroom Producer Bandcamp", "lo-fi synth EPs · 'plays one show a year' tagline."],
        ["End-of-Year Mixes — Reyn featured", "two mixes on a local music blog feature Reyn tracks."],
        ["Demo Drop Forum — Reyn (slow static)", "thread of feedback on a slow-tempo demo."],
      ],
    ],
  ];
  const out: GoggleHit[] = [];
  for (const [key, rows] of list) {
    rows.forEach(([headline, excerpt], i) => {
      out.push({
        id: `g_${key}_${i + 1}`,
        key,
        headline,
        excerpt,
        kind: i === 0 ? "profile" : i === 1 ? "news" : "social-mention",
        gate: { day: i === 0 ? 1 : i === 1 ? 2 : 4 },
      });
    });
  }
  return out;
}

/* ───────────────────────── LinkedOut ─────────────────────────── */

const LINKED_OUT: LinkedOutProfile[] = [
  /* Killers — bare profiles with a couple of fact-gated reveals. */
  {
    key: "miles",
    headline: "Backend engineer · film photographer",
    location: "downtown",
    mutuals: 2,
    skills: ["Go", "Postgres", "Portra 400"],
    education: [
      { id: "e_miles_1", org: "State University", title: "CS, BSc", years: "2014–2018", gate: {} },
    ],
    experience: [
      { id: "x_miles_1", org: "Spire Systems", title: "Backend Engineer", years: "2021–present", gate: {} },
      {
        id: "x_miles_2",
        org: "Eastside Logistics",
        title: "Night-shift Sysadmin",
        years: "2019–2021",
        gate: { requiredFactIds: ["canal_warehouse_fire"] },
        flagged: true,
        linkedFactId: "canal_warehouse_fire",
      },
    ],
  },
  {
    key: "tessa",
    headline: "Late-night radio host",
    location: "downtown",
    mutuals: 1,
    skills: ["live broadcasting", "audio editing"],
    education: [
      { id: "e_tessa_1", org: "City College", title: "Broadcast Journalism", years: "2014–2017", gate: {} },
    ],
    experience: [
      { id: "x_tessa_1", org: "KSTR 88.3", title: "Overnight Host", years: "2019–present", gate: {} },
      {
        id: "x_tessa_2",
        org: "St. Vincent Care Network",
        title: "Patient Transport (PT)",
        years: "2022–present",
        gate: { requiredFactIds: ["medical_cart_rental"] },
        flagged: true,
        linkedFactId: "medical_cart_rental",
      },
    ],
  },
  {
    key: "ren",
    headline: "Marine logistics · sailing instructor",
    location: "harbor district",
    mutuals: 0,
    skills: ["small-craft handling", "marina ops"],
    education: [
      { id: "e_ren_1", org: "Maritime Academy", title: "Coastal Ops Cert.", years: "2013", gate: {} },
    ],
    experience: [
      { id: "x_ren_1", org: "Harbor Sail Co.", title: "Instructor", years: "2018–present", gate: {} },
      {
        id: "x_ren_2",
        org: "Anchorline Shipping",
        title: "Night Dispatch",
        years: "2020–present",
        gate: { requiredFactIds: ["marina_logs_early"] },
        flagged: true,
        linkedFactId: "marina_logs_early",
      },
    ],
  },
  {
    key: "kai",
    headline: "Muralist · public-art commissions",
    location: "transit corridor",
    mutuals: 1,
    skills: ["large-format painting", "scissor lift cert."],
    education: [
      { id: "e_kai_1", org: "Art School (dropout)", title: "Painting", years: "2012–2014", gate: {} },
    ],
    experience: [
      { id: "x_kai_1", org: "Independent", title: "Commissioned Muralist", years: "2017–present", gate: {} },
      {
        id: "x_kai_2",
        org: "Old Transit Lot Reno",
        title: "On-site Painter",
        years: "claimed period: this month",
        gate: { requiredFactIds: ["transit_lot_fenced"] },
        flagged: true,
        linkedFactId: "transit_lot_fenced",
      },
    ],
  },
  {
    key: "delphine",
    headline: "Independent perfumer",
    location: "quiet side of downtown",
    mutuals: 0,
    skills: ["formulation", "small-batch production"],
    education: [
      { id: "e_delphine_1", org: "École de la Parfumerie", title: "Diploma", years: "2011–2013", gate: {} },
    ],
    experience: [
      { id: "x_delphine_1", org: "Maison Roux", title: "Owner / Perfumer", years: "2018–present", gate: {} },
      {
        id: "x_delphine_2",
        org: "Maison Roux — back-office",
        title: "Receipts & Inventory",
        years: "self",
        gate: { requiredFactIds: ["parfume_shop_receipts"] },
        flagged: true,
        linkedFactId: "parfume_shop_receipts",
      },
    ],
  },
  {
    key: "jules",
    headline: "Hospitality · bar manager",
    location: "downtown",
    mutuals: 2,
    skills: ["bar ops", "close shifts"],
    education: [],
    experience: [
      { id: "x_jules_1", org: "Half Moon Bar", title: "Manager", years: "2020–present", gate: {} },
      {
        id: "x_jules_2",
        org: "Half Moon Bar — Tuesday Schedule",
        title: "'Closed alone' (per submitted roster)",
        years: "this month",
        gate: { requiredFactIds: ["bar_staff_tuesday"] },
        flagged: true,
        linkedFactId: "bar_staff_tuesday",
      },
    ],
  },
  {
    key: "river",
    headline: "Outdoors guide · gorge specialist",
    location: "park district",
    mutuals: 0,
    skills: ["trail navigation", "wilderness first aid"],
    education: [
      { id: "e_river_1", org: "WFR Certification", title: "Wilderness First Responder", years: "2019", gate: {} },
    ],
    experience: [
      { id: "x_river_1", org: "Gorge Outfitters", title: "Registered Guide", years: "2019–present", gate: {} },
      {
        id: "x_river_2",
        org: "Gorge Outfitters — solo bookings",
        title: "Off-roster appointments",
        years: "this month",
        gate: { requiredFactIds: ["trail_camera_gorge"] },
        flagged: true,
        linkedFactId: "trail_camera_gorge",
      },
    ],
  },
  {
    key: "sam",
    headline: "City field operations",
    location: "citywide",
    mutuals: 1,
    skills: ["inspections", "field reporting"],
    education: [
      { id: "e_sam_1", org: "State University", title: "Public Admin, BSc", years: "2012–2016", gate: {} },
    ],
    experience: [
      { id: "x_sam_1", org: "City Operations", title: "Field Inspector", years: "2018–present", gate: {} },
      {
        id: "x_sam_2",
        org: "City Operations — off-site swipes",
        title: "Badge log discrepancies",
        years: "last two weeks",
        gate: { requiredFactIds: ["badge_swipes_offsite"] },
        flagged: true,
        linkedFactId: "badge_swipes_offsite",
      },
    ],
  },

  /* Decoys — full profiles, ungated. */
  ...decoyLinkedOut(),
];

function decoyLinkedOut(): LinkedOutProfile[] {
  return [
    {
      key: "lola",
      headline: "Surf instructor · vintage shop owner",
      location: "south jetty",
      mutuals: 0,
      skills: ["coastal instruction", "vintage retail"],
      education: [{ id: "e_lola_1", org: "Coastal College", title: "AA Marine Studies", years: "2015", gate: {} }],
      experience: [
        { id: "x_lola_1", org: "South Jetty Surf School", title: "Lead Instructor", years: "2018–present", gate: {} },
        { id: "x_lola_2", org: "Salt + Thread", title: "Owner", years: "2020–present", gate: { day: 2 } },
      ],
    },
    {
      key: "ari",
      headline: "Bookseller · fiction lead",
      location: "city center",
      mutuals: 1,
      skills: ["book curation", "events"],
      education: [{ id: "e_ari_1", org: "Liberal Arts College", title: "English Lit, BA", years: "2014", gate: {} }],
      experience: [
        { id: "x_ari_1", org: "Old Bay Books", title: "Fiction Lead", years: "2017–present", gate: {} },
        { id: "x_ari_2", org: "City Lit Newsletter", title: "Columnist", years: "2021–present", gate: { day: 2 } },
      ],
    },
    {
      key: "onyx",
      headline: "Nightlife photographer",
      location: "warehouse district",
      mutuals: 2,
      skills: ["low-light photography", "tour photography"],
      education: [],
      experience: [
        { id: "x_onyx_1", org: "Freelance", title: "Photographer", years: "2016–present", gate: {} },
        { id: "x_onyx_2", org: "Indie Label Tour", title: "Tour Photographer", years: "2023", gate: { day: 3 } },
      ],
    },
    {
      key: "micah",
      headline: "Park ranger · trail maintenance",
      location: "state forest",
      mutuals: 0,
      skills: ["trail repair", "bird identification"],
      education: [{ id: "e_micah_1", org: "Forestry School", title: "Forestry Tech", years: "2012", gate: {} }],
      experience: [
        { id: "x_micah_1", org: "State Forest Service", title: "Ranger", years: "2015–present", gate: {} },
      ],
    },
    {
      key: "sienna",
      headline: "Gallery assistant · zine editor",
      location: "downtown",
      mutuals: 1,
      skills: ["curatorial", "hanging shows"],
      education: [{ id: "e_sienna_1", org: "Art College", title: "BFA Curatorial Studies", years: "2018", gate: {} }],
      experience: [
        { id: "x_sienna_1", org: "Midline Gallery", title: "Curatorial Assistant", years: "2022–present", gate: {} },
        { id: "x_sienna_2", org: "Side Wall (zine)", title: "Editor", years: "2021–present", gate: { day: 2 } },
      ],
    },
    {
      key: "eli",
      headline: "Reference librarian",
      location: "central branch",
      mutuals: 0,
      skills: ["reference", "cataloguing"],
      education: [{ id: "e_eli_1", org: "iSchool", title: "MLIS", years: "2017", gate: {} }],
      experience: [
        { id: "x_eli_1", org: "Central Public Library", title: "Reference Librarian", years: "2018–present", gate: {} },
      ],
    },
    {
      key: "penny",
      headline: "Children's book illustrator",
      location: "sunlit studio",
      mutuals: 0,
      skills: ["watercolor", "ink"],
      education: [{ id: "e_penny_1", org: "Illustration School", title: "BFA", years: "2019", gate: {} }],
      experience: [
        { id: "x_penny_1", org: "Freelance", title: "Illustrator", years: "2019–present", gate: {} },
        { id: "x_penny_2", org: "Bookshelf Buddies Press", title: "Cover Illustrator (3 titles)", years: "2022–present", gate: { day: 3 } },
      ],
    },
    {
      key: "cam",
      headline: "Cellarman · home brewer",
      location: "east side",
      mutuals: 1,
      skills: ["fermentation", "small-batch brewing"],
      education: [],
      experience: [
        { id: "x_cam_1", org: "Eastside Brewing", title: "Cellarman", years: "2019–present", gate: {} },
      ],
    },
    {
      key: "zora",
      headline: "Brand strategist · nightlife venues",
      location: "downtown",
      mutuals: 3,
      skills: ["brand strategy", "event marketing"],
      education: [{ id: "e_zora_1", org: "State University", title: "Marketing, BA", years: "2016", gate: {} }],
      experience: [
        { id: "x_zora_1", org: "Late City Co.", title: "Brand Strategist", years: "2021–present", gate: {} },
        { id: "x_zora_2", org: "Late City Newsletter", title: "Editor", years: "2022–present", gate: { day: 2 } },
      ],
    },
    {
      key: "reyn",
      headline: "Bedroom producer",
      location: "home studio",
      mutuals: 0,
      skills: ["synth programming", "mixing"],
      education: [],
      experience: [
        { id: "x_reyn_1", org: "Self-released", title: "Producer", years: "2018–present", gate: {} },
      ],
    },
  ];
}

/* ───────────────────────── Instagrim ─────────────────────────── */

const INSTAGRIM: InstaPost[] = [
  /* Killers — sparse + fact-gated. Re-uses authored IG-kind facts
     from factUniverse.json so opening commits the fact. */
  {
    id: "i_miles_1",
    key: "miles",
    caption: "morning light. canal-side.",
    timestamp: "3w ago",
    gate: { day: 1 },
    swatch: "#3b4c66",
  },
  {
    id: "i_miles_2",
    key: "miles",
    caption: "coffee on the windowsill — bridge in the reflection.",
    timestamp: "5d ago",
    gate: { requiredFactIds: ["ig_reflection_forensics"] },
    linkedFactId: "miles_ig_window_reflection",
    swatch: "#5a6d8a",
  },

  {
    id: "i_tessa_1",
    key: "tessa",
    caption: "studio after the show.",
    timestamp: "2w ago",
    gate: { day: 1 },
    swatch: "#392a45",
  },
  {
    id: "i_tessa_2",
    key: "tessa",
    caption: "mood after another long one.",
    timestamp: "4d ago",
    gate: { requiredFactIds: ["medical_cart_rental"] },
    linkedFactId: "tessa_ig_keychain",
    swatch: "#52384c",
  },

  {
    id: "i_ren_1",
    key: "ren",
    caption: "first one in.",
    timestamp: "1w ago",
    location: "Harbor District Marina",
    gate: { day: 1 },
    swatch: "#1b3148",
    linkedFactId: "ren_ig_marina_lights",
  },
  {
    id: "i_ren_2",
    key: "ren",
    caption: "another quiet dawn",
    timestamp: "3d ago",
    gate: { requiredFactIds: ["marina_logs_early"] },
    swatch: "#234058",
  },

  {
    id: "i_kai_1",
    key: "kai",
    caption: "long week. worth it.",
    timestamp: "2w ago",
    gate: { day: 1 },
    swatch: "#4a3b22",
    linkedFactId: "kai_ig_scissor_lift",
  },
  {
    id: "i_kai_2",
    key: "kai",
    caption: "lot's quiet tonight.",
    timestamp: "5d ago",
    gate: { requiredFactIds: ["transit_lot_fenced"] },
    swatch: "#5a4c34",
  },

  {
    id: "i_delphine_1",
    key: "delphine",
    caption: "tonight's batch.",
    timestamp: "1w ago",
    gate: { day: 1 },
    swatch: "#2e1a2a",
    linkedFactId: "delphine_ig_workbench",
  },
  {
    id: "i_delphine_2",
    key: "delphine",
    caption: "opened early — coffee for the wait.",
    timestamp: "4d ago",
    gate: { requiredFactIds: ["parfume_shop_receipts"] },
    swatch: "#3d2438",
  },

  {
    id: "i_jules_1",
    key: "jules",
    caption: "just walked it off",
    timestamp: "5d ago",
    gate: { day: 1 },
    swatch: "#1a1f30",
    linkedFactId: "jules_ig_canal_late",
  },
  {
    id: "i_jules_2",
    key: "jules",
    caption: "closed early. quiet night.",
    timestamp: "2d ago",
    gate: { requiredFactIds: ["bar_staff_tuesday"] },
    swatch: "#252a40",
  },

  {
    id: "i_river_1",
    key: "river",
    caption: "trailhead at sunset",
    timestamp: "1w ago",
    gate: { day: 1 },
    swatch: "#2e3a22",
  },
  {
    id: "i_river_2",
    key: "river",
    caption: "off-trail. fewer cameras up here.",
    timestamp: "4d ago",
    gate: { requiredFactIds: ["trail_camera_gorge"] },
    swatch: "#3a482a",
  },

  {
    id: "i_sam_1",
    key: "sam",
    caption: "field day. boots already toast.",
    timestamp: "1w ago",
    gate: { day: 1 },
    swatch: "#33291a",
  },
  {
    id: "i_sam_2",
    key: "sam",
    caption: "out of the office (again).",
    timestamp: "3d ago",
    gate: { requiredFactIds: ["badge_swipes_offsite"] },
    swatch: "#403423",
  },

  /* Decoys — richer feeds, day-gated. */
  ...decoyInstagrim(),
];

function decoyInstagrim(): InstaPost[] {
  const rows: Array<[FootprintKey, string, string[]]> = [
    [
      "lola",
      "#1f4f6e",
      ["dawn set. flat but glassy.", "van life · vintage drop sunday.", "tacos on the seawall.", "south jetty crew."],
    ],
    [
      "ari",
      "#3a2f1f",
      ["staff pick · new fiction wall.", "rainy day · perfect for chapter 8.", "indie press box arrived.", "open mic tonight."],
    ],
    [
      "onyx",
      "#2a1f3a",
      ["last night's set, edited at 4am.", "smoke + strobe = home.", "tour load-in.", "new neon, who dis."],
    ],
    [
      "micah",
      "#2f3a1f",
      ["wood thrush on the long loop.", "post-storm trail repair.", "lichen so good.", "early sun, late breakfast."],
    ],
    [
      "sienna",
      "#3a2a2f",
      ["hang day at the gallery.", "opening night.", "issue 4 went to print!", "gloves on, careful unpacking."],
    ],
    [
      "eli",
      "#1f2a3a",
      ["reference desk, comfort cardigan.", "rebound this week.", "found a 1957 atlas.", "library cat update."],
    ],
    [
      "penny",
      "#3a3a1f",
      ["studio cats supervising.", "ink drop.", "spread for bookshelf buddies.", "basil plant: still judging."],
    ],
    [
      "cam",
      "#2f3a2a",
      ["dry hopping tonight.", "hop trellis update.", "small-batch IPA pour.", "sunday: trees + thermos."],
    ],
    [
      "zora",
      "#3a1f2a",
      ["rooftop hour.", "door list duty.", "newsletter dropped — friday.", "city noise, my favorite."],
    ],
    [
      "reyn",
      "#1f3a3a",
      ["new patch, slow tempo.", "demo in headphones only.", "tape hiss + hot tea.", "rare daylight selfie."],
    ],
  ];
  const out: InstaPost[] = [];
  for (const [key, swatch, captions] of rows) {
    captions.forEach((caption, i) => {
      out.push({
        id: `i_${key}_${i + 1}`,
        key,
        caption,
        timestamp: `${(i + 1) * 2}d ago`,
        gate: { day: i === 0 ? 1 : i === 1 ? 2 : i === 2 ? 3 : 4 },
        swatch,
      });
    });
  }
  return out;
}

/* ───────────────────────── lookup helpers ─────────────────────────── */

export function normalizeKey(name: string): FootprintKey {
  return name.trim().toLowerCase();
}

function knownFactIds(run: CaseRun | null | undefined): Set<string> {
  if (!run) return new Set();
  return new Set(run.facts.map((f) => f.authoringKey));
}

function gateOpen(gate: FootprintGate, run: CaseRun | null | undefined, known: Set<string>): boolean {
  const day = run?.day ?? 1;
  if (gate.day !== undefined && day < gate.day) return false;
  if (gate.requiredFactIds && gate.requiredFactIds.length > 0) {
    for (const id of gate.requiredFactIds) {
      if (!known.has(id)) return false;
    }
  }
  return true;
}

export function getGoggleHitsFor(name: string, run: CaseRun | null | undefined): GoggleHit[] {
  const key = normalizeKey(name);
  const known = knownFactIds(run);
  return GOGGLE.filter((h) => h.key === key && gateOpen(h.gate, run, known));
}

export function getAllVisibleGoggleHits(run: CaseRun | null | undefined): GoggleHit[] {
  const known = knownFactIds(run);
  return GOGGLE.filter((h) => gateOpen(h.gate, run, known));
}

export function getLinkedOutFor(
  name: string,
  run: CaseRun | null | undefined,
): { profile: LinkedOutProfile; visibleExperience: LinkedOutRow[]; visibleEducation: LinkedOutRow[] } | null {
  const key = normalizeKey(name);
  const profile = LINKED_OUT.find((p) => p.key === key);
  if (!profile) return null;
  const known = knownFactIds(run);
  return {
    profile,
    visibleExperience: profile.experience.filter((r) => gateOpen(r.gate, run, known)),
    visibleEducation: profile.education.filter((r) => gateOpen(r.gate, run, known)),
  };
}

export function getInstagrimFor(name: string, run: CaseRun | null | undefined): InstaPost[] {
  const key = normalizeKey(name);
  const known = knownFactIds(run);
  return INSTAGRIM.filter((p) => p.key === key && gateOpen(p.gate, run, known));
}

export function hasFootprint(name: string): boolean {
  const key = normalizeKey(name);
  return (
    GOGGLE.some((h) => h.key === key) ||
    LINKED_OUT.some((p) => p.key === key) ||
    INSTAGRIM.some((p) => p.key === key)
  );
}
