/**
 * Voice profiles — single source of truth that maps every speaking
 * character to a stable ElevenLabs voice id and settings tuple.
 *
 * Architectural rule from the voice-engine task spec:
 *   "Voice profiles map to *characters*, not *candidates*."
 *
 * In each killer's deck the killer-candidate uses that killer's voice;
 * the four non-killer candidates pull from the shared INNOCENT_POOL,
 * deterministically picked by candidate id so the voice survives
 * cold-start without being persisted on the candidate row.
 *
 * Voice ids are ElevenLabs' public stock library — picked by listening
 * to the demos at https://elevenlabs.io/voice-library and matching the
 * persona doc in identities.ts. Each pick is annotated with a one-line
 * justification so a future re-cast pass can read the intent.
 */
import { Candidate, KillerIdentity } from "./models";

export interface VoiceSettings {
  /** 0 = expressive/unstable, 1 = monotone/stable. */
  stability: number;
  /** 0 = drift from the source voice, 1 = stick to it. */
  similarityBoost: number;
  /** 0 = neutral delivery, 1 = exaggerated style. */
  style?: number;
  /** ElevenLabs' loudness-EQ pass over the synthesized take. */
  useSpeakerBoost?: boolean;
}

export interface VoiceProfile {
  /** Stable internal key (used as filename prefix in audioManifest). */
  characterKey: string;
  /** ElevenLabs voice id (from the public stock library). */
  voiceId: string;
  /** ElevenLabs model id. eleven_multilingual_v2 is the safe default. */
  modelId: string;
  settings: VoiceSettings;
  /** One-liner explaining why this voice fits the character. */
  notes: string;
}

/* ─────────────── shared model + settings presets ─────────────────── */

const MODEL = "eleven_multilingual_v2";

/** Quiet, controlled delivery — stays in character on long lines. */
const PRESET_GROUNDED: VoiceSettings = {
  stability: 0.55,
  similarityBoost: 0.75,
  style: 0.15,
  useSpeakerBoost: true,
};

/** Looser, more varied delivery — good for charmers and flirts. */
const PRESET_EXPRESSIVE: VoiceSettings = {
  stability: 0.35,
  similarityBoost: 0.7,
  style: 0.45,
  useSpeakerBoost: true,
};

/** Soft, careful delivery — for quiet/empathic characters. */
const PRESET_HUSHED: VoiceSettings = {
  stability: 0.6,
  similarityBoost: 0.8,
  style: 0.1,
  useSpeakerBoost: true,
};

/* ─────────────── killer voices (one per identity) ────────────────── */

export const KILLER_VOICES: Record<KillerIdentity, VoiceProfile> = {
  // Software engineer / film photographer. Long, careful smile. Antoni
  // is well-rounded and contemplative — exactly the kind of voice that
  // can hold a long pause without sounding bored.
  miles: {
    characterKey: "miles",
    voiceId: "ErXwobaYiN019PkySvjV", // Antoni
    modelId: MODEL,
    settings: PRESET_GROUNDED,
    notes:
      "Antoni — measured, contemplative male. Sells the 'careful smile' beat.",
  },
  // Late-night radio host — Bella's broadcast-warm timbre and natural
  // closeness are the on-air voice you'd actually leave the radio on for.
  tessa: {
    characterKey: "tessa",
    voiceId: "hpp4J3VqNfWAUOO0d1Us", // Bella (Professional, Bright, Warm)
    modelId: MODEL,
    settings: PRESET_HUSHED,
    notes: "Bella — warm, broadcast-soft female. Reads 'midnight to four'.",
  },
  // Competitive sailor with a temper he calls focus. Sam (raspy) gives
  // the up-at-dawn weather-bitten masculinity with a clipped edge.
  ren: {
    characterKey: "ren",
    voiceId: "yoZ06aMxZJJ28mfd3POQ", // Sam (raspy male — *not* the killer named Sam)
    modelId: MODEL,
    settings: PRESET_GROUNDED,
    notes: "Sam (raspy male) — weathered + clipped, fits the four-thirty alarm.",
  },
  // Street muralist, charming + easily distracted. Liam reads young,
  // animated, charismatic — Kai's whole pitch is the smile in his voice.
  kai: {
    characterKey: "kai",
    voiceId: "TX3LPaxmHKxFdv7VOQHJ", // Liam
    modelId: MODEL,
    settings: PRESET_EXPRESSIVE,
    notes: "Liam — young, charismatic male. Sells the 'paint-splattered charm'.",
  },
  // Perfumer who claims she can smell secrets. Charlotte is the closest
  // thing in the public library to a French-tinged sultry whisper.
  delphine: {
    characterKey: "delphine",
    voiceId: "XB0fDUnXU5powFXDhCwa", // Charlotte
    modelId: MODEL,
    settings: PRESET_EXPRESSIVE,
    notes: "Charlotte — sultry, accented female. Reads 'I can always tell'.",
  },
  // Bartender + bassist with a low, watchful smile. Adam is the deep
  // chest-voice that lives in a dive bar after closing.
  jules: {
    characterKey: "jules",
    voiceId: "pNInz6obpgDQGcFmaJgB", // Adam
    modelId: MODEL,
    settings: PRESET_GROUNDED,
    notes: "Adam — deep, controlled male. Bartender-after-eleven energy.",
  },
  // Climbing instructor + trail guide. Josh is calm-outdoors masculine
  // — the voice you'd actually trust on a belay rope.
  river: {
    characterKey: "river",
    voiceId: "TxGEqnHWrfWFTfGW9XjX", // Josh
    modelId: MODEL,
    settings: PRESET_GROUNDED,
    notes: "Josh — calm, outdoorsy male. Trail-guide cadence on every line.",
  },
  // Hospice nurse — soft voice, very steady hands. Rachel is the calm
  // narrator timbre that puts a stranger at ease in three seconds.
  sam: {
    characterKey: "sam",
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
    modelId: MODEL,
    settings: PRESET_HUSHED,
    notes: "Rachel — calm, gentle female. The 'kind face' compliment lives here.",
  },
};

/* ─────────────── shared innocent voice pool ──────────────────────── */

/**
 * Five distinct stock voices the non-killer candidates rotate through.
 * Picked to span gender + age + accent so a deck of four innocents
 * doesn't feel like the same person speaking. Mapping is deterministic
 * per candidate id (see `voiceForCandidate` below) so a single run
 * sounds consistent across cold-starts.
 */
export const INNOCENT_POOL: VoiceProfile[] = [
  {
    characterKey: "innocent_drew",
    voiceId: "29vD33N1CtxCmqQRPOHJ", // Drew
    modelId: MODEL,
    settings: PRESET_GROUNDED,
    notes: "Drew — mid-30s well-rounded male. Default 'normal guy' energy.",
  },
  {
    characterKey: "innocent_domi",
    voiceId: "AZnzlk1XvdvUeBnXmlld", // Domi
    modelId: MODEL,
    settings: PRESET_EXPRESSIVE,
    notes: "Domi — assertive female. The 'sharp opinions' innocent.",
  },
  {
    characterKey: "innocent_dorothy",
    voiceId: "ThT5KcBeYPX3keUQqHPh", // Dorothy
    modelId: MODEL,
    settings: PRESET_HUSHED,
    notes: "Dorothy — soft British female. Reads 'apprentice / curator'.",
  },
  {
    characterKey: "innocent_callum",
    voiceId: "N2lVS1w4EtoT3dr4eOWO", // Callum
    modelId: MODEL,
    settings: PRESET_GROUNDED,
    notes: "Callum — hoarse, mid-range male. Late-shift / sound-engineer fit.",
  },
  {
    characterKey: "innocent_emily",
    voiceId: "LcfcDJNUP1GQjkzn1xUU", // Emily
    modelId: MODEL,
    settings: PRESET_HUSHED,
    notes: "Emily — calm, mid-20s female. The chaplain / illustrator timbre.",
  },
];

/* ─────────────── secondary NPC voices (Dev / Morgan) ─────────────── */

/**
 * Pre-baked profiles for the two AI-dialogue NPCs whose portraits are
 * already bundled (A079-A084). No script today — these exist so a Pass 4
 * caller can `getVoiceForCharacterKey("dev")` without waiting on a voice
 * pass that names them mid-flight.
 */
export const NPC_VOICES: Record<"dev" | "morgan", VoiceProfile> = {
  dev: {
    characterKey: "dev",
    voiceId: "IKne3meq5aSn9XLyUdCD", // Charlie
    modelId: MODEL,
    settings: PRESET_EXPRESSIVE,
    notes: "Charlie — Australian male, distinct from the killer pool.",
  },
  morgan: {
    characterKey: "morgan",
    voiceId: "MF3mGyEYCl7XYWbV9V6O", // Elli
    modelId: MODEL,
    settings: PRESET_EXPRESSIVE,
    notes: "Elli — young, bright female. Carries decoy-NPC chatter.",
  },
};

/* ─────────────── lookup helpers ──────────────────────────────────── */

/**
 * All character keys that exist in the speaking universe, in a stable
 * order. Used by the pre-gen script to know which (character, line)
 * pairs to walk over.
 */
export const ALL_VOICE_PROFILES: VoiceProfile[] = [
  ...Object.values(KILLER_VOICES),
  ...INNOCENT_POOL,
  ...Object.values(NPC_VOICES),
];

/**
 * Stable, deterministic FNV-1a hash of a string. Small, no-deps, and
 * the same in Node + React Native — so the innocent-voice mapping
 * computed at pre-gen time matches the one resolved at playback time.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiplication, kept in unsigned space.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Resolve the voice profile for a candidate. Killer-candidates get
 * their identity's killer voice; innocents get a deterministic pick
 * from INNOCENT_POOL keyed on candidate id.
 *
 * Reads as a *pure* function of the candidate row so playback and
 * pre-gen stay in lockstep without sharing state.
 */
export function voiceForCandidate(candidate: Candidate): VoiceProfile {
  if (candidate.isKillerCandidate && candidate.identity) {
    return KILLER_VOICES[candidate.identity];
  }
  const idx = fnv1a(candidate.id) % INNOCENT_POOL.length;
  return INNOCENT_POOL[idx]!;
}

/**
 * Look up a profile by its `characterKey`. Returns `null` for unknown
 * keys so the caller can decide between "fall back to default" and
 * "fail loudly".
 */
export function getVoiceForCharacterKey(key: string): VoiceProfile | null {
  for (const p of ALL_VOICE_PROFILES) {
    if (p.characterKey === key) return p;
  }
  return null;
}
