/**
 * DateMusicPlayer — crossfading music bed for date scenes.
 *
 * Implements the warm ↔ tense crossfade described in catfish_audio-brief.md:
 * "date_mode_loop_warm ↔ date_mode_loop_tense crossfade is the most important
 * musical moment in the game."
 *
 * Volume hierarchy (loudest → quietest):
 *   1. Voice        — full level
 *   2. Stings       — peak at -6dB relative to voice
 *   3. UI SFX       — peak at -10dB relative to voice
 *   4. Music        — sits at -15dB during voice, -8dB without voice
 *   5. Diegetic amb — sits at -25dB always, -30dB during voice
 *
 * Crossfade timing: fires on Focus Shift (tellEligible choice lands).
 * Not on every single beat — only first tell-eligible choice per scene
 * to avoid feeling manipulative (per audio brief open question #3).
 */

import { useAudioPlayer } from "expo-audio";
import { useEffect, useRef } from "react";

import { useGameState } from "@/core/gameStore";
import { DateMusicMode } from "@/core/dateScene";

/* ─────────────── track definitions ─────────────── */

interface DateTrack {
  id: string;
  /** Volume when this track is the active bed (no voice playing). */
  activeVolume: number;
  /** Volume when this track is the fading-out bed. */
  fadeVolume: number;
}

/** Two-track config. Keys match the asset ids in sfxManifest. */
const WARM_TRACK: DateTrack = {
  id: "date_mode_loop_warm",
  activeVolume: 0.5,
  fadeVolume: 0,
};

const TENSE_TRACK: DateTrack = {
  id: "date_mode_loop_tense",
  activeVolume: 0,
  fadeVolume: 0,
};

const CROSSFADE_DURATION_MS = 1200;

const VOICE_DUCK_LEVEL = 0.18;    // -15dB expressed as linear gain
const NO_VOICE_LEVEL = 0.38;       // -8dB expressed as linear gain

/* ─────────────── hook ─────────────── */

interface DateMusicState {
  musicMode: DateMusicMode;
  setMusicMode: (mode: DateMusicMode) => void;
}

/**
 * Two-player crossfade for date mode music beds.
 *
 * Player A holds warm, Player B holds tense. When mode flips,
 * A fades out and B fades in simultaneously — true crossfade,
 * not a hard switch.
 *
 * The hook also watches `voiceMuted` to apply auto-ducking:
 * when voice is playing, both beds drop to VOICE_DUCK_LEVEL so
 * the player-perceived hierarchy stays intact.
 */
export function useDateMusic(): DateMusicState {
  const playerWarm = useAudioPlayer();
  const playerTense = useAudioPlayer();
  const currentModeRef = useRef<DateMusicMode>("warm");
  const voiceMuted = useGameState((s) => s.voiceMuted);

  // Initialize both players: warm starts active at full volume,
  // tense starts silent.
  useEffect(() => {
    playerWarm.loop = true;
    playerTense.loop = true;
    playerWarm.volume = WARM_TRACK.activeVolume;
    playerTense.volume = TENSE_TRACK.fadeVolume;
    playerWarm.play();
    playerTense.play();
  }, [playerWarm, playerTense]);

  // Auto-duck: if voice is unmuted, both beds duck when warm is playing.
  // When voice is muted, restore to NO_VOICE_LEVEL so music is audible.
  useEffect(() => {
    const target =
      voiceMuted || !playerWarm.playing
        ? NO_VOICE_LEVEL
        : VOICE_DUCK_LEVEL;
    playerWarm.volume = target;
    playerTense.volume = target;
  }, [voiceMuted, playerWarm, playerTense]);

  const setMusicMode = (mode: DateMusicMode) => {
    if (mode === currentModeRef.current) return;
    currentModeRef.current = mode;

    const now = Date.now();
    const steps = 20;
    const stepDuration = CROSSFADE_DURATION_MS / steps;

    if (mode === "tense") {
      // Crossfade: warm fades out, tense fades in.
      let step = 0;
      const interval = setInterval(() => {
        step++;
        const progress = step / steps;
        playerWarm.volume = WARM_TRACK.activeVolume * (1 - progress);
        playerTense.volume = TENSE_TRACK.activeVolume * progress;
        if (step >= steps) {
          clearInterval(interval);
          playerWarm.volume = WARM_TRACK.fadeVolume;
          playerTense.volume = TENSE_TRACK.activeVolume;
        }
      }, stepDuration);
    } else {
      // Crossfade back: tense fades out, warm fades in.
      let step = 0;
      const interval = setInterval(() => {
        step++;
        const progress = step / steps;
        playerTense.volume = TENSE_TRACK.activeVolume * (1 - progress);
        playerWarm.volume = WARM_TRACK.activeVolume * progress;
        if (step >= steps) {
          clearInterval(interval);
          playerTense.volume = TENSE_TRACK.fadeVolume;
          playerWarm.volume = WARM_TRACK.activeVolume;
        }
      }, stepDuration);
    }
  };

  return { musicMode: currentModeRef.current, setMusicMode };
}