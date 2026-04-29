/**
 * Shared FRESH-START confirm flow for parody mini-games — Task #56.
 *
 * SafeSpot, EgoTrip, and SugarCoat each used to carry their own
 * near-identical copy of the "wipe a same-day saved run" confirm
 * dance: the same `showFreshStartConfirm` useState, the same press
 * handlers, the same `saveXSession(null)` wipe step. Three copies
 * meant three foot-guns; a fourth or fifth parody mini-game would
 * almost certainly be cloned from one of them, and there was no
 * structural guarantee the clone would be safe.
 *
 * This hook owns the contract:
 *
 *   1. `requestFreshStart()` opens the confirm overlay.
 *   2. `cancelFreshStart()` dismisses it without touching the
 *      saved-run snapshot.
 *   3. `confirmFreshStart()` is the only place the save callback
 *      is invoked with `null` (the wipe), followed by an optional
 *      `onAfterWipe` for game-specific cleanup (clearing a resume
 *      ref, transitioning phase, calling reset, etc.), then
 *      finally closing the overlay.
 *
 * Pin the wipe in one place and a future copy-paste of the FRESH
 * START flow into a fourth parody game can't accidentally
 * re-introduce the pre-Task-#49 inline-wipe shape — the confirm
 * Pressable just calls `confirmFreshStart` and the hook does the
 * rest.
 *
 * The `onAfterWipe` callback is what lets SugarCoat preserve its
 * `onPress={fresh.confirmFreshStart}` pattern even though its
 * after-wipe step is the entire `reset()` function (board re-seed,
 * score zeroing, wasRestoredRef flip, etc.). Without `onAfterWipe`
 * we'd have to wire SugarCoat's confirm Pressable to a one-off
 * inline lambda, defeating the point of the shared hook.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseFreshStartConfirmArgs<T> {
  /**
   * The per-game `saveXSession` action from the game store. The hook
   * calls it with `null` inside `confirmFreshStart` to wipe the saved
   * snapshot. Async (returns a Promise) is supported; the hook fires
   * it without awaiting since the user-facing transition shouldn't
   * block on AsyncStorage.
   */
  saveSession: (snap: T | null) => void | Promise<void>;
  /**
   * Optional follow-up the hook fires AFTER the wipe. Use this for
   * game-specific cleanup that has to happen on START FRESH but not
   * on KEEP SAVED RUN (e.g. clearing a resume ref, calling reset,
   * transitioning phase). The hook always closes the confirm overlay
   * itself after this fires, so callers don't need to duplicate that.
   */
  onAfterWipe?: () => void;
}

export interface UseFreshStartConfirmReturn {
  /** Whether the FRESH START confirm overlay is currently showing. */
  showFreshStartConfirm: boolean;
  /**
   * Direct setter — exposed so callers can clear the overlay from a
   * sibling reset path (e.g. the in-game restart flow's reset
   * also clears the fresh-start overlay if it happened to be open).
   */
  setShowFreshStartConfirm: (visible: boolean) => void;
  /** Open the confirm overlay. Wire to the per-game FRESH START button. */
  requestFreshStart: () => void;
  /** Dismiss the overlay without wiping. Wire to the cancel button. */
  cancelFreshStart: () => void;
  /**
   * Wipe the saved-run snapshot, run `onAfterWipe`, and close the
   * overlay. Wire to the confirm button. This is the ONE place the
   * `saveXSession(null)` wipe is allowed to fire from the FRESH
   * START flow — pinning it here is what makes the foot-gun
   * mechanically un-reintroducible across mini-games.
   */
  confirmFreshStart: () => void;
}

export function useFreshStartConfirm<T>(
  args: UseFreshStartConfirmArgs<T>,
): UseFreshStartConfirmReturn {
  const [showFreshStartConfirm, setShowFreshStartConfirm] = useState(false);

  // Mirror callbacks into refs so `confirmFreshStart` doesn't change
  // identity every render — important because the games wire it
  // directly to a Pressable's `onPress`, and a stable identity keeps
  // the React-Native gesture handler from re-binding on each render.
  const saveSessionRef = useRef(args.saveSession);
  const onAfterWipeRef = useRef(args.onAfterWipe);
  useEffect(() => {
    saveSessionRef.current = args.saveSession;
  }, [args.saveSession]);
  useEffect(() => {
    onAfterWipeRef.current = args.onAfterWipe;
  }, [args.onAfterWipe]);

  const requestFreshStart = useCallback(() => {
    setShowFreshStartConfirm(true);
  }, []);

  const cancelFreshStart = useCallback(() => {
    setShowFreshStartConfirm(false);
  }, []);

  const confirmFreshStart = useCallback(() => {
    // Wipe the saved-run snapshot. Fire-and-forget — AsyncStorage's
    // write is fast and a failure here doesn't change the user-facing
    // outcome (the in-memory state is already moving on).
    void saveSessionRef.current(null);
    // Game-specific after-wipe step (clear resume ref, reset board,
    // transition phase, …). Optional — a game with no follow-up
    // can omit it.
    onAfterWipeRef.current?.();
    setShowFreshStartConfirm(false);
  }, []);

  return {
    showFreshStartConfirm,
    setShowFreshStartConfirm,
    requestFreshStart,
    cancelFreshStart,
    confirmFreshStart,
  };
}
