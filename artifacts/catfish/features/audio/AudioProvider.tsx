/**
 * AudioProvider — single mount point for the app's non-voice audio.
 *
 * Two responsibilities:
 *
 *   1. Background music. Owns one looping `useAudioPlayer` for the
 *      noir pad loop. Plays/pauses in response to `musicMuted`.
 *      Browsers gate audio behind a user-gesture, so we lazily start
 *      playback the first time `playSfx` fires (any tap, swipe, etc.
 *      counts as that gesture). On native there's no such gate, so
 *      we attempt to start as soon as we mount.
 *
 *   2. SFX. Owns a small ring of `useAudioPlayer`s so two overlapping
 *      one-shots (e.g. swipe sound + match jingle) don't cut each
 *      other off. Each `playSfx` call grabs the oldest player in the
 *      ring, replaces its source, and plays from the start.
 *
 * Mounted once in `app/_layout.tsx`. Exposes a context-free API via
 * the `audioEvents` bus, so call-sites that aren't React (the store,
 * helpers, etc) don't need to wire props through.
 */
import { useAudioPlayer } from "expo-audio";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";

import { useGameState } from "@/core/gameStore";

import { subscribeSfx } from "./audioEvents";
import { MUSIC_LOOP_ASSET, sfxAsset, type SfxName } from "./sfxManifest";

/**
 * On native there's no autoplay gate, so we can start music as soon
 * as the player is ready. On web (and unknown platforms, which we
 * treat conservatively) we wait for a user gesture first.
 */
const REQUIRES_USER_GESTURE = Platform.OS === "web";

/** How many overlapping one-shots we can support without truncation. */
const SFX_VOICES = 4;

/** Music volume — pad sits below dialogue and SFX. */
const MUSIC_VOLUME = 0.32;

/** SFX volume — clearly audible over music but never harsh. */
const SFX_VOLUME = 0.85;

/** Dev-only debug shape exposed on `window.__catfishAudio`. */
interface AudioDebug {
  musicPaused?: boolean;
  musicPlaying?: boolean;
  musicCurrentTime?: number;
  userInteracted?: boolean;
  sfxMuted?: boolean;
  musicMuted?: boolean;
  voiceMuted?: boolean;
  lastSfx?: SfxName;
  lastSfxAt?: number;
  lastSuppressed?: SfxName;
  lastSuppressedAt?: number;
  sfxFireCount?: number;
}

const DEBUG_KEY = "__catfishAudio";

function getDebug(): AudioDebug {
  const g = globalThis as unknown as Record<string, AudioDebug | undefined>;
  if (!g[DEBUG_KEY]) g[DEBUG_KEY] = {};
  return g[DEBUG_KEY] as AudioDebug;
}

function recordDebug(patch: Partial<AudioDebug>): void {
  const cur = getDebug();
  Object.assign(cur, patch);
}

function safeRead<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

interface Props {
  children: ReactNode;
}

export function AudioProvider({ children }: Props) {
  // ── Music: one player, looping. We pass the source on construction
  //    so the player has it ready the moment we want to start.
  const musicPlayer = useAudioPlayer(MUSIC_LOOP_ASSET);

  // ── SFX: a small fixed pool. Hooks must be called in a stable
  //    order, so we declare them explicitly rather than mapping. Four
  //    voices is plenty for our event density (no scene fires more
  //    than 2 in the same tick).
  const sfx0 = useAudioPlayer();
  const sfx1 = useAudioPlayer();
  const sfx2 = useAudioPlayer();
  const sfx3 = useAudioPlayer();
  const sfxPool = useMemo(
    () => [sfx0, sfx1, sfx2, sfx3],
    [sfx0, sfx1, sfx2, sfx3],
  );
  const sfxCursor = useRef(0);

  const musicMuted = useGameState((s) => s.musicMuted);
  const sfxMuted = useGameState((s) => s.sfxMuted);

  // Has the user interacted yet? Only meaningful on web — native
  // doesn't gate audio behind a gesture. We also re-attempt music on
  // every subsequent SFX in case the first try was autoplay-blocked.
  const userInteractedRef = useRef(!REQUIRES_USER_GESTURE);

  /**
   * Try to start the music if it isn't already running and isn't
   * muted. Safe to call repeatedly — `play()` on a player that's
   * already playing is a no-op, and a blocked attempt simply leaves
   * the player paused for the next tap to retry.
   */
  const tryStartMusic = (): void => {
    if (useGameState.getState().musicMuted) return;
    if (!userInteractedRef.current) return;
    try {
      if (!musicPlayer.playing) {
        musicPlayer.play();
      }
    } catch {
      /* idle-player throw on web before load — fine */
    }
  };

  // ── Music lifecycle
  useEffect(() => {
    try {
      musicPlayer.loop = true;
      musicPlayer.volume = MUSIC_VOLUME;
    } catch {
      // Idle/web players can throw on attribute set before load — fine.
    }
    // Native: kick music immediately on mount. Web: wait for first SFX.
    tryStartMusic();
    return () => {
      try {
        musicPlayer.pause();
      } catch {
        /* idle-player throw on web — fine */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicPlayer]);

  useEffect(() => {
    if (musicMuted) {
      try {
        musicPlayer.pause();
      } catch {
        /* see above */
      }
      return;
    }
    tryStartMusic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicMuted, musicPlayer]);

  // ── SFX bus subscription
  useEffect(() => {
    const handler = (name: SfxName): void => {
      // Mark gesture & retry music start on EVERY SFX — a previous
      // autoplay-blocked attempt would have left music paused, so
      // each successive tap is another chance to satisfy the policy.
      if (!userInteractedRef.current) {
        userInteractedRef.current = true;
      }
      tryStartMusic();
      // Honor mute *at fire time* — the store may have flipped between
      // when the event was emitted and when we got here.
      if (useGameState.getState().sfxMuted) {
        if (__DEV__) {
          recordDebug({ lastSuppressed: name, lastSuppressedAt: Date.now() });
        }
        return;
      }

      const player = sfxPool[sfxCursor.current % sfxPool.length];
      if (!player) return;
      sfxCursor.current = (sfxCursor.current + 1) % sfxPool.length;
      try {
        player.replace(sfxAsset(name) as Parameters<typeof player.replace>[0]);
        player.volume = SFX_VOLUME;
        player.seekTo(0);
        player.play();
        if (__DEV__) {
          recordDebug({
            lastSfx: name,
            lastSfxAt: Date.now(),
            sfxFireCount: (getDebug().sfxFireCount ?? 0) + 1,
          });
        }
      } catch {
        // A pool slot may be mid-decode of its previous source — we
        // don't want a single dropped click to crash the whole bus.
      }
    };
    return subscribeSfx(handler);
  }, [musicPlayer, sfxPool]);

  // ── Dev-only debug shim
  // Exposes minimal player state on `window.__catfishAudio` so the e2e
  // test agent can verify behavior without trying to introspect the
  // (detached) HTMLAudioElement nodes that expo-audio creates.
  useEffect(() => {
    if (!__DEV__) return;
    const tick = (): void => {
      recordDebug({
        musicPaused: safeRead(() => musicPlayer.paused, true),
        musicPlaying: safeRead(() => musicPlayer.playing, false),
        musicCurrentTime: safeRead(() => musicPlayer.currentTime, 0),
        userInteracted: userInteractedRef.current,
        sfxMuted: useGameState.getState().sfxMuted,
        musicMuted: useGameState.getState().musicMuted,
        voiceMuted: useGameState.getState().voiceMuted,
      });
    };
    tick();
    const id = setInterval(tick, 250);
    return () => {
      clearInterval(id);
    };
  }, [musicPlayer]);

  // No need to render anything — we're a side-effect provider.
  return <>{children}</>;
}
