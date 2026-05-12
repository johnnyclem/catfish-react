/**
 * Authored daily voicemails from Dev and Nia.
 *
 * Each entry is keyed by (friend, day) and surfaced by `advanceDay()`
 * when the run transitions to that day. Some entries are gated to
 * specific killers via `killer`; the rest are universal.
 *
 * Voicemails that carry `linkedFactId` commit the associated authored
 * fact at the moment they are materialized (day advance), so the player
 * doesn't have to manually capture them.
 */

import type { FriendID, KillerIdentity, Voicemail } from "./models";

interface AuthoredVoicemail {
  id: string;
  friend: FriendID;
  text: string;
  day: number;
  killer?: KillerIdentity;
  linkedFactId?: string;
}

export const AUTHORED_VOICEMAILS: AuthoredVoicemail[] = [
  // ── Day 2 — early tips ──────────────────────────────────────────────────────
  {
    id: "vm_dev_d2_canal",
    friend: "dev",
    text: "hey — so I maybe found something. that guy you're talking to, miles? he posted his location as the canal warehouse area late tuesday night. thought you should know. call me if you want more.",
    day: 2,
    linkedFactId: "dev_text_day4_miles_sus",
  },
  {
    id: "vm_nia_d2_jules",
    friend: "nia",
    text: "saw something weird. the bartender — jules? he closed his bar early tuesday but wasn't home till way later. I don't know what that means but it felt off. text me back",
    day: 2,
    linkedFactId: "dev_text_day4_jules_sus",
  },

  // ── Day 3 ───────────────────────────────────────────────────────────────────
  {
    id: "vm_dev_d3_tessa",
    friend: "dev",
    text: "okay this one's weird. tessa told me she was working at the station tuesday night but I'm pretty sure she wasn't. the overnight was a re-run. not sure what she was doing instead but something's off.",
    day: 3,
    linkedFactId: "tessa_conditional_lateshift",
  },
  {
    id: "vm_nia_d3_ren",
    friend: "nia",
    text: "just remembered — ren's boat activity logs show he signed out of the marina super early tuesday morning. like 2am. he said he was out at 4:30. doesn't add up. thought you should know",
    day: 3,
    linkedFactId: "ren_conditional_dawn_alibi",
  },

  // ── Day 4 — structured tips via phone (devText facts) ───────────────────────
  {
    id: "vm_dev_d4_kai",
    friend: "dev",
    text: "okay so kai said he was painting late by the old transit lot but the lot's been completely fenced off for a month. city inspectors issued a stop work order. I have the records if you need them.",
    day: 4,
    linkedFactId: "kai_conditional_paint_late",
  },
  {
    id: "vm_nia_d4_delphine",
    friend: "nia",
    text: "heard something about delphine. her shop receipts show she opened at 7am the morning after the fire but she told someone she was 'home all night.' the timestamps don't match. I'm just saying.",
    day: 4,
    linkedFactId: "delphine_conditional_smell_secret",
  },
  {
    id: "vm_dev_d4_sam",
    friend: "dev",
    text: "random but I was looking at public city records — badge swipes. sam had a two hour gap during her supposed shift tuesday night. she was off-site. could be nothing could be everything.",
    day: 4,
    linkedFactId: "sam_conditional_double_shift",
  },
  {
    id: "vm_nia_d4_river",
    friend: "nia",
    text: "this one's kind of specific. a hiker told me they saw river at the gorge trailhead with someone else last sunday — not solo like his profile says. could be innocent but thought you'd want to know.",
    day: 4,
    linkedFactId: "river_conditional_solo_scout",
  },

  // ── Day 5 — pressure escalation ──────────────────────────────────────────────
  {
    id: "vm_dev_d5_watch",
    friend: "dev",
    text: "you've been at this for a few days now. I just want to say — be careful who you're trusting. someone on that app is not who they say they are. I'm not saying more over text. call me.",
    day: 5,
  },
  {
    id: "vm_nia_d5_pattern",
    friend: "nia",
    text: "okay I've been thinking about this. all these little things — the alibis that don't add up, the times that don't match. they feel like one person. someone who planned this. maybe look at who benefits?",
    day: 5,
  },

  // ── Day 6 — final push ────────────────────────────────────────────────────────
  {
    id: "vm_dev_d6_almost",
    friend: "dev",
    text: "tomorrow's day 7. I don't know what happens after that but I think you're close to figuring this out. the facts you have — they connect. I can feel it. trust your gut.",
    day: 6,
  },
  {
    id: "vm_nia_d6_final",
    friend: "nia",
    text: "one more thing before you sleep on it — the person who did this has been in your inbox this whole time. not everyone is what they seem. I've seen the way some of them talk when they think no one's watching.",
    day: 6,
  },
];

/**
 * Filter the authored voicemails for entries that should appear on
 * `day` given the run's killer identity.
 */
export function getVoicemailsForDay(
  day: number,
  killer: KillerIdentity,
): AuthoredVoicemail[] {
  return AUTHORED_VOICEMAILS.filter(
    (vm) =>
      vm.day === day && (vm.killer === undefined || vm.killer === killer),
  );
}

/**
 * Convert an `AuthoredVoicemail` into the store's `Voicemail` type.
 */
export function materializeVoicemail(
  authored: AuthoredVoicemail,
): Voicemail {
  return {
    id: authored.id,
    friend: authored.friend,
    text: authored.text,
    day: authored.day,
    killerGate: authored.killer,
    linkedFactId: authored.linkedFactId,
    listened: false,
  };
}