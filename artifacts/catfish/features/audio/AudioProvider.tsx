import { useAudioPlayer } from "expo-audio";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";

import { useGameState } from "@/core/gameStore";
import { usePhoneShell } from "@/features/parody/phoneShellState";

import { type AmbienceName, ambienceAsset } from "./ambienceManifest";
import { subscribeSfx } from "./audioEvents";
import { bgmAsset, type BgmName } from "./bgmManifest";
import { sfxAsset, type SfxName } from "./sfxManifest";

/**
 * Module-load patch for `HTMLMediaElement.prototype.play` (web only).
 */
declare global {
  interface HTMLMediaElement {
    __catfishPlayPatched?: boolean;
  }
}
if (typeof HTMLMediaElement !== "undefined") {
  const proto = HTMLMediaElement.prototype;
  if (!proto.__catfishPlayPatched) {
    Object.defineProperty(proto, "__catfishPlayPatched", {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    const originalPlay = proto.play;
    proto.play = function patchedPlay(this: HTMLMediaElement) {
      const result = originalPlay.call(this);
      if (
        result &&
        typeof (result as Promise<void>).catch === "function"
      ) {
        (result as Promise<void>).catch(() => {});
      }
      return result;
    };
  }
}

const REQUIRES_USER_GESTURE = Platform.OS === "web";
const SFX_VOICES = 4;
const DUCK_FACTOR = 0.3;
const FADE_STEPS = 8;
const FADE_INTERVAL_MS = 40;

const STEP_SIZE = 1 / FADE_STEPS;

interface AudioDebug {
  musicPaused?: boolean;
  musicPlaying?: boolean;
  userInteracted?: boolean;
  sfxMuted?: boolean;
  musicMuted?: boolean;
  currentBgm?: BgmName;
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
  Object.assign(getDebug(), patch);
}

function safeRead<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function safePlay(player: { play: () => unknown }): void {
  let result: unknown;
  try {
    result = player.play();
  } catch {
    return;
  }
  if (
    result &&
    typeof (result as { then?: unknown }).then === "function" &&
    typeof (result as { catch?: unknown }).catch === "function"
  ) {
    (result as Promise<unknown>).catch(() => {});
  }
}

function resolveBgm(
  currentApp: string,
  lotsOfFishView: string,
  hasRun: boolean,
): BgmName {
  if (!hasRun) return "bgm_main_theme";
  switch (currentApp) {
    case "home":
      return "bgm_phone_os";
    case "lotsOfFish":
      if (lotsOfFishView === "swipe") return "bgm_swipe";
      return "bgm_chat";
    case "journal":
      return "bgm_phone_os";
    case "wordLow":
      return "bgm_arcade_wordlow";
    case "egoTrip":
      return "bgm_arcade_ego_trip";
    case "safeSpot":
    case "sugarCoat":
      return "bgm_arcade_general";
    default:
      return "noir_loop";
  }
}

function resolveAmbience(
  _currentApp: string,
  _lotsOfFishView: string,
): AmbienceName | null {
  return null;
}

/** Fade a player's volume from `from` to `to` in steps over `FADE_STEPS * FADE_INTERVAL_MS` ms. */
function fadeVolume(
  player: { volume: number },
  from: number,
  to: number,
  onDone?: () => void,
): void {
  let step = 0;
  try {
    player.volume = from;
  } catch {}
  const dir = to > from ? 1 : -1;
  const id = setInterval(() => {
    step++;
    const t = step * STEP_SIZE;
    const v = from + (to - from) * Math.min(t, 1);
    try {
      player.volume = Math.max(0, Math.min(1, v));
    } catch {}
    if (step >= FADE_STEPS) {
      clearInterval(id);
      onDone?.();
    }
  }, FADE_INTERVAL_MS);
}

export interface AudioDuckHandle {
  duck: () => void;
  unduck: () => void;
}

export const audioDuckRef: { current: AudioDuckHandle | null } = { current: null };

interface Props {
  children: ReactNode;
}

export function AudioProvider({ children }: Props) {
  // ── BGM: two players for crossfade
  const bgmA = useAudioPlayer();
  const bgmB = useAudioPlayer();

  // ── SFX: small fixed pool
  const sfx0 = useAudioPlayer();
  const sfx1 = useAudioPlayer();
  const sfx2 = useAudioPlayer();
  const sfx3 = useAudioPlayer();
  const sfxPool = useMemo(
    () => [sfx0, sfx1, sfx2, sfx3],
    [sfx0, sfx1, sfx2, sfx3],
  );
  const sfxCursor = useRef(0);

  // ── Ambience
  const ambiencePlayer = useAudioPlayer();

  // ── Store subscriptions
  const bgmVolume = useGameState((s) => s.bgmVolume);
  const sfxVolume = useGameState((s) => s.sfxVolume);
  const storedAmbienceVolume = useGameState((s) => s.ambienceVolume);
  const musicMuted = useGameState((s) => s.musicMuted);
  const sfxMuted = useGameState((s) => s.sfxMuted);
  const currentApp = usePhoneShell((s) => s.currentApp);
  const lotsOfFishView = usePhoneShell((s) => s.lotsOfFishView);
  const run = useGameState((s) => s.run);

  const currentBgm = useMemo(
    () => resolveBgm(currentApp, lotsOfFishView, !!run),
    [currentApp, lotsOfFishView, run],
  );
  const currentAmbience = useMemo(
    () => resolveAmbience(currentApp, lotsOfFishView),
    [currentApp, lotsOfFishView],
  );

  const userInteractedRef = useRef(!REQUIRES_USER_GESTURE);
  const activeSlotRef = useRef<0 | 1>(0);
  const duckedRef = useRef(false);
  const prevBgmVolumeRef = useRef(bgmVolume);
  const prevAmbienceVolumeRef = useRef(storedAmbienceVolume);

  const tryStartMusic = useCallback((): void => {
    if (useGameState.getState().musicMuted) return;
    if (!userInteractedRef.current) return;
    const player = activeSlotRef.current === 0 ? bgmA : bgmB;
    let alreadyPlaying = false;
    try {
      alreadyPlaying = player.playing;
    } catch {}
    if (!alreadyPlaying) safePlay(player);
  }, [bgmA, bgmB]);

  // ── BGM context switching + crossfade
  const prevBgmRef = useRef<BgmName>(currentBgm);

  useEffect(() => {
    if (currentBgm === prevBgmRef.current) return;
    prevBgmRef.current = currentBgm;

    const fromSlot = activeSlotRef.current;
    const toSlot = fromSlot === 0 ? 1 : 0;
    const fromPlayer = fromSlot === 0 ? bgmA : bgmB;
    const toPlayer = toSlot === 0 ? bgmA : bgmB;

    const targetVol = musicMuted ? 0 : bgmVolume;

    // Fade out current
    fadeVolume(fromPlayer, fromSlot === 0 ? bgmA.volume : bgmB.volume, 0, () => {
      try { fromPlayer.pause(); } catch {}
    });

    // Set up the new player
    try {
      toPlayer.replace(bgmAsset(currentBgm) as Parameters<typeof toPlayer.replace>[0]);
      toPlayer.loop = true;
      toPlayer.seekTo(0);
      toPlayer.volume = 0;
    } catch {
      return;
    }
    safePlay(toPlayer);

    // Fade in new
    fadeVolume(toPlayer, 0, targetVol);

    activeSlotRef.current = toSlot;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBgm]);

  // ── BGM initial load
  useEffect(() => {
    try {
      bgmA.replace(bgmAsset(currentBgm) as Parameters<typeof bgmA.replace>[0]);
      bgmA.loop = true;
      bgmA.volume = bgmVolume;
    } catch {}

    try {
      bgmB.loop = true;
      bgmB.volume = 0;
    } catch {}

    try {
      ambiencePlayer.loop = true;
      ambiencePlayer.volume = 0;
    } catch {}

    // Native: kick music immediately. Web: wait for first SFX.
    if (!REQUIRES_USER_GESTURE) {
      safePlay(bgmA);
    }

    return () => {
      try { bgmA.pause(); } catch {}
      try { bgmB.pause(); } catch {}
      try { ambiencePlayer.pause(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Volume/slider reactivity
  useEffect(() => {
    const player = activeSlotRef.current === 0 ? bgmA : bgmB;
    const targetVol = musicMuted ? 0 : duckedRef.current ? bgmVolume * DUCK_FACTOR : bgmVolume;
    fadeVolume(player, player.volume, targetVol);
    prevBgmVolumeRef.current = bgmVolume;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgmVolume, musicMuted]);

  // ── Music mute toggle
  useEffect(() => {
    const player = activeSlotRef.current === 0 ? bgmA : bgmB;
    if (musicMuted) {
      fadeVolume(player, player.volume, 0, () => {
        try { player.pause(); } catch {}
      });
    } else {
      safePlay(player);
      fadeVolume(player, player.volume, bgmVolume);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicMuted]);

  // ── Ambience lifecycle
  const prevAmbienceRef = useRef<AmbienceName | null>(currentAmbience);

  useEffect(() => {
    if (currentAmbience === prevAmbienceRef.current) return;
    prevAmbienceRef.current = currentAmbience;

    if (!currentAmbience) {
      fadeVolume(ambiencePlayer, ambiencePlayer.volume, 0, () => {
        try { ambiencePlayer.pause(); } catch {}
      });
      return;
    }

    try {
      ambiencePlayer.replace(
        ambienceAsset(currentAmbience) as Parameters<typeof ambiencePlayer.replace>[0],
      );
      ambiencePlayer.loop = true;
      ambiencePlayer.seekTo(0);
      ambiencePlayer.volume = 0;
    } catch {
      return;
    }
    safePlay(ambiencePlayer);
    fadeVolume(ambiencePlayer, 0, storedAmbienceVolume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAmbience]);

  useEffect(() => {
    const targetVol = musicMuted
      ? 0
      : duckedRef.current
        ? storedAmbienceVolume * DUCK_FACTOR
        : storedAmbienceVolume;
    fadeVolume(ambiencePlayer, ambiencePlayer.volume, targetVol);
    prevAmbienceVolumeRef.current = storedAmbienceVolume;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedAmbienceVolume, musicMuted]);

  // ── Ducking: expose handle
  const duckHandle: AudioDuckHandle = useMemo(
    () => ({
      duck: () => {
        if (duckedRef.current) return;
        duckedRef.current = true;
        const bgmTarget = bgmVolume * DUCK_FACTOR;
        const ambTarget = storedAmbienceVolume * DUCK_FACTOR;
        fadeVolume(activeSlotRef.current === 0 ? bgmA : bgmB, bgmVolume, bgmTarget);
        fadeVolume(ambiencePlayer, storedAmbienceVolume, ambTarget);
      },
      unduck: () => {
        if (!duckedRef.current) return;
        duckedRef.current = false;
        fadeVolume(activeSlotRef.current === 0 ? bgmA : bgmB, bgmVolume * DUCK_FACTOR, bgmVolume);
        fadeVolume(ambiencePlayer, storedAmbienceVolume * DUCK_FACTOR, storedAmbienceVolume);
      },
    }),
    [bgmVolume, storedAmbienceVolume, bgmA, bgmB, ambiencePlayer],
  );

  useEffect(() => {
    audioDuckRef.current = duckHandle;
    return () => { audioDuckRef.current = null; };
  }, [duckHandle]);

  // ── SFX bus subscription
  useEffect(() => {
    const handler = (name: SfxName): void => {
      if (!userInteractedRef.current) {
        userInteractedRef.current = true;
      }
      tryStartMusic();

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
        player.volume = sfxVolume;
        player.seekTo(0);
      } catch {
        return;
      }
      safePlay(player);
      if (__DEV__) {
        recordDebug({
          lastSfx: name,
          lastSfxAt: Date.now(),
          sfxFireCount: (getDebug().sfxFireCount ?? 0) + 1,
        });
      }
    };
    return subscribeSfx(handler);
  }, [sfxPool, sfxVolume, tryStartMusic]);

  // ── Debug shim
  useEffect(() => {
    if (!__DEV__) return;
    const tick = (): void => {
      const active = activeSlotRef.current === 0 ? bgmA : bgmB;
      recordDebug({
        musicPaused: safeRead(() => active.paused, true),
        musicPlaying: safeRead(() => active.playing, false),
        userInteracted: userInteractedRef.current,
        sfxMuted: useGameState.getState().sfxMuted,
        musicMuted: useGameState.getState().musicMuted,
        currentBgm,
      });
    };
    tick();
    const id = setInterval(tick, 250);
    return () => { clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgmA, bgmB, currentBgm]);

  return <>{children}</>;
}
