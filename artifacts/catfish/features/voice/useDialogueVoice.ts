/**
 * useDialogueVoice — single-track voice playback for chat threads.
 *
 * Behavior contract:
 *   1. The hook owns one `expo-audio` AudioPlayer for its lifetime.
 *   2. `playLine(...)` enqueues a clip; consecutive calls play in
 *      order so a multi-line suspect turn is heard end-to-end.
 *   3. The hook short-circuits when `voiceMuted` is on so a stale
 *      queue doesn't keep firing after the player turns voices off.
 *   4. On unmount the queue drains (we don't replay on remount —
 *      ThreadView gates auto-play to *new* messages only).
 *
 * Resolution order for a given (candidate, beatKey, lineIndex):
 *   pre-generated bundled clip → live TTS proxy → silently noop.
 */
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef } from "react";

import { audioKey, getAudioAsset } from "@/assets/audioManifest";
import { useGameState } from "@/core/gameStore";
import type { Candidate } from "@/core/models";
import { voiceForCandidate, type VoiceProfile } from "@/core/voiceProfiles";

import { fetchVoiceClip } from "./voiceClient";

interface QueueItem {
  /** Either a Metro asset reference or an absolute URI. */
  source: number | object | { uri: string };
  /** Diagnostic — surfaced in dev logs only. */
  label: string;
}

export interface DialogueVoiceController {
  /**
   * Enqueue a single suspect line for playback. Resolves once the
   * line has been *queued* (not necessarily finished playing). Safe
   * to await in a loop to push a whole turn into the queue in order.
   */
  playLine: (
    candidate: Candidate,
    beatKey: string,
    lineIndex: number,
    text: string,
  ) => Promise<void>;
  /** Drop any queued lines and stop the current one. */
  stop: () => void;
}

export function useDialogueVoice(): DialogueVoiceController {
  // useAudioPlayer with no source creates an idle player; we feed it
  // sources via .replace() as queued items become current.
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const voiceMuted = useGameState((s) => s.voiceMuted);

  const queueRef = useRef<QueueItem[]>([]);
  const playingRef = useRef(false);
  // Tracks the last status.didJustFinish *count* we've serviced so an
  // identical event fired by useAudioPlayerStatus's internal polling
  // doesn't re-trigger the next-track logic on every re-render.
  const lastFinishHandledRef = useRef(0);
  const finishCounterRef = useRef(0);
  // Serializes playLine() across async fetches so a slow live-TTS
  // call for line N+0 cannot be overtaken by a baked clip for line
  // N+1. Always reset to a resolved promise — never rejected — so a
  // single failed line can't poison the chain.
  const enqueueLockRef = useRef<Promise<void>>(Promise.resolve());

  const playNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      playingRef.current = false;
      return;
    }
    playingRef.current = true;
    try {
      // expo-audio accepts an asset module ref OR an object with `uri`.
      // The cast is annotated rather than `any` so the union-shape
      // contract above is documented at the call-site.
      player.replace(next.source as Parameters<typeof player.replace>[0]);
      player.play();
    } catch (err) {
      // Don't let a single bad clip strand the queue — log, then
      // schedule the next item.
      if (__DEV__) {
        console.warn("[voice] play failed for", next.label, err);
      }
      playingRef.current = false;
      // Recurse via microtask so we don't blow the stack on a
      // pathological queue.
      Promise.resolve().then(playNext);
    }
  }, [player]);

  // expo-audio raises didJustFinish on the status object after each
  // clip. We service it once per finish — see lastFinishHandledRef.
  useEffect(() => {
    if (status?.didJustFinish && playingRef.current) {
      finishCounterRef.current += 1;
      if (finishCounterRef.current !== lastFinishHandledRef.current) {
        lastFinishHandledRef.current = finishCounterRef.current;
        playingRef.current = false;
        playNext();
      }
    }
  }, [status?.didJustFinish, playNext]);

  // Mute mid-stream → drain the queue and pause whatever's current.
  // Also reset the enqueue chain so a re-mute after un-mute starts
  // from a clean baseline (no stranded inflight fetches in flight).
  useEffect(() => {
    if (voiceMuted) {
      queueRef.current = [];
      try {
        player.pause();
      } catch {
        /* idle player on web throws, which is fine */
      }
      playingRef.current = false;
      enqueueLockRef.current = Promise.resolve();
    }
  }, [voiceMuted, player]);

  const enqueue = useCallback(
    (item: QueueItem) => {
      queueRef.current.push(item);
      if (!playingRef.current) {
        playNext();
      }
    },
    [playNext],
  );

  const playLine = useCallback<DialogueVoiceController["playLine"]>(
    async (candidate, beatKey, lineIndex, text) => {
      if (voiceMuted) return;

      const profile: VoiceProfile = voiceForCandidate(candidate);
      const key = audioKey(profile.characterKey, beatKey, lineIndex);

      // Lock ordering at call-time — every playLine() chains onto the
      // previous one, so slow live-TTS lookups can't be jumped by a
      // subsequent baked-clip enqueue. The promise resolves once *this*
      // line is enqueued (not when the audio finishes — the audio
      // player's own queue handles serial playback).
      const next = enqueueLockRef.current.then(async () => {
        // Re-check mute inside the chain — the user may have toggled
        // off while we were waiting for our turn.
        if (useGameState.getState().voiceMuted) return;

        // Hot path — pre-generated clips bundle as static asset modules.
        const baked = getAudioAsset(key);
        if (baked !== undefined) {
          enqueue({ source: baked, label: key });
          return;
        }

        // Live TTS fallback — fetch + base64 + queue.
        try {
          const { uri } = await fetchVoiceClip({ profile, text });
          if (useGameState.getState().voiceMuted) return;
          enqueue({ source: { uri }, label: `live:${key}` });
        } catch (err) {
          if (__DEV__) {
            console.warn("[voice] live TTS failed for", key, err);
          }
        }
      });
      // Swallow rejections in the chain so one failing fetch doesn't
      // permanently strand subsequent calls.
      enqueueLockRef.current = next.catch(() => undefined);
      return next;
    },
    [enqueue, voiceMuted],
  );

  const stop = useCallback(() => {
    queueRef.current = [];
    try {
      player.pause();
    } catch {
      /* see above */
    }
    playingRef.current = false;
  }, [player]);

  // Belt-and-braces cleanup — Expo's AudioPlayer is auto-released when
  // the hook unmounts but we still want to drop our queue so we don't
  // leak references to large data URIs across navigation.
  useEffect(() => {
    return () => {
      queueRef.current = [];
    };
  }, []);

  return { playLine, stop };
}
