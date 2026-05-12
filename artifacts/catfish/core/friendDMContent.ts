/**
 * Authored friend DMs from Dev and Nia.
 *
 * These appear as chat-style messages in the player's social inbox
 * inside the Lots 'o Fish dating app. Each DM is day-gated and
 * optionally killer-aware. Unlike voicemails (which live in the Phone
 * app), friend DMs are displayed as chat bubbles in a DM-like view.
 *
 * DMs that have `linkedFactId` can be "committed" to the journal by the
 * player tapping a "save to journal" action on each message.
 */

import type { FriendID, KillerIdentity } from "./models";

export interface AuthoredFriendDM {
  id: string;
  friend: FriendID;
  text: string;
  day: number;
  killer?: KillerIdentity;
  linkedFactId?: string;
}

export const AUTHORED_FRIEND_DMS: AuthoredFriendDM[] = [
  // ── Day 2 ───────────────────────────────────────────────────────────────────
  {
    id: "dm_dev_d2_hey",
    friend: "dev",
    text: "hey! just checked in on some of the people you're matching with. nothing weird but I'll keep looking",
    day: 2,
  },
  {
    id: "dm_nia_d2_hi",
    friend: "nia",
    text: "hi! I've been browsing the same dating pool lol. if I see anything off I'll let you know",
    day: 2,
  },

  // ── Day 3 ───────────────────────────────────────────────────────────────────
  {
    id: "dm_dev_d3_update",
    friend: "dev",
    text: "okay update — that guy miles? something's not adding up with his schedule. not saying he's guilty just saying watch him",
    day: 3,
    linkedFactId: "dev_text_day4_miles_sus",
  },
  {
    id: "dm_nia_d3_update",
    friend: "nia",
    text: "jules the bartender closed early Tuesday and wasn't home till late. I noticed because we have the same shift pattern. not sure what it means yet",
    day: 3,
    linkedFactId: "dev_text_day4_jules_sus",
  },

  // ── Day 4 — structured tips ───────────────────────────────────────────────────
  {
    id: "dm_dev_d4_kai",
    friend: "dev",
    text: "tell you something interesting — kai said he was painting at the transit lot. the lot's been fenced off for a month. city has the records",
    day: 4,
    linkedFactId: "kai_conditional_paint_late",
  },
  {
    id: "dm_nia_d4_tessa",
    friend: "nia",
    text: "tessa told me she was working at the station Tuesday night but the overnight was a re-run. she wasn't there. I don't know where she was",
    day: 4,
    linkedFactId: "tessa_conditional_lateshift",
  },
  {
    id: "dm_dev_d4_ren",
    friend: "dev",
    text: " marina logs are public. ren signs out at 2am but says he leaves at 4:30. I checked. twice",
    day: 4,
    linkedFactId: "ren_conditional_dawn_alibi",
  },
  {
    id: "dm_nia_d4_delphine",
    friend: "nia",
    text: "delphine's shop has electronic receipts timestamped at 7am the morning after. she told me she was home all night. doesn't add up",
    day: 4,
    linkedFactId: "delphine_conditional_smell_secret",
  },

  // ── Day 5 ───────────────────────────────────────────────────────────────────
  {
    id: "dm_dev_d5_pattern",
    friend: "dev",
    text: "I've been looking at all these little inconsistencies and I think they might be connected. same person leaving different alibis",
    day: 5,
  },
  {
    id: "dm_nia_d5_river",
    friend: "nia",
    text: "river went to the gorge trailhead with someone last sunday — not solo like his profile says. witness description is vague but the timing is suspicious",
    day: 5,
    linkedFactId: "river_conditional_solo_scout",
  },
  {
    id: "dm_dev_d5_sam",
    friend: "dev",
    text: "public badge swipe records show sam had a 2-hour offsite gap during her shift tuesday night. could be personal stuff but the timing is weird",
    day: 5,
    linkedFactId: "sam_conditional_double_shift",
  },

  // ── Day 6 — final push ────────────────────────────────────────────────────────
  {
    id: "dm_dev_d6_trust",
    friend: "dev",
    text: "day 6. you're close. the things you've found — they connect. whoever did this has been talking to you on that app. re-read your conversations",
    day: 6,
  },
  {
    id: "dm_nia_d6_trust",
    friend: "nia",
    text: "one more day left. I believe in you. trust what you've found and trust your instincts",
    day: 6,
  },
];

export function getFriendDMsForDay(
  day: number,
  killer: KillerIdentity,
): AuthoredFriendDM[] {
  return AUTHORED_FRIEND_DMS.filter(
    (dm) => dm.day === day && (dm.killer === undefined || dm.killer === killer),
  );
}

export interface FriendDM {
  id: string;
  friend: FriendID;
  text: string;
  day: number;
  linkedFactId?: string;
  committed: boolean;
}

export function materializeFriendDM(authored: AuthoredFriendDM): FriendDM {
  return {
    id: authored.id,
    friend: authored.friend,
    text: authored.text,
    day: authored.day,
    linkedFactId: authored.linkedFactId,
    committed: false,
  };
}