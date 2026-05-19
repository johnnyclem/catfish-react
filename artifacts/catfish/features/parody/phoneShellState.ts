/**
 * Phone-home shell navigation state.
 *
 * After Task #59 the parody phone home grid is the main interface
 * (no root tab bar) and a single `currentApp` value drives which
 * surface fills the phone shell. We lift that state into a dedicated
 * Zustand store so non-shell components — `EndOfRunCard`, the
 * `LotsOfFishSplash` "OPEN APP" CTA, the title screen — can route
 * the player to a specific surface without prop-drilling through
 * `app/home.tsx`.
 *
 * Lots 'o Fish is the only "app" with internal sub-surfaces (its
 * own dating-app bottom tab bar exposing Swipe / Matches / Profile
 * plus an intro splash). Those get their own slice here too so a
 * caller can land the player on, say, "Lots 'o Fish → Matches"
 * directly. Mini-game surfaces are flat — they live entirely in
 * `currentApp`.
 *
 * Not persisted: a per-session navigation slot is enough; a player
 * who relaunches the app should land on the home grid, not deep
 * inside whatever screen they last left open.
 */
import { create } from "zustand";

import type { DateScene } from "@/core/dateScene";

/**
 * Every surface the phone shell can render. `home` is the parody
 * grid itself. Mini-games and the dating-app shortcut are siblings
 * because they're equal first-class apps from the player's point
 * of view — no nesting, no router stack.
 */
export type PhoneShellApp =
  | "home"
  | "lotsOfFish"
  | "journal"
  | "phone"
  | "browser"
  | "facetime"
  | "photos"
  | "gameCenter"
  | "egoTrip"
  | "sugarCoat"
  | "safeSpot"
  | "wordLow"
  | "settings";

/**
 * Lots 'o Fish has three real "screens" plus its splash intro. We
 * keep splash separate from the three bottom-tab views so a return
 * visit doesn't re-show the splash unless the caller explicitly
 * asks for it.
 */
export type LotsOfFishView = "splash" | "swipe" | "matches" | "profile" | "social" | "board";

interface PhoneShellState {
  currentApp: PhoneShellApp;
  /** Active sub-screen within Lots 'o Fish. Ignored by other apps. */
  lotsOfFishView: LotsOfFishView;
  /**
   * Flip to a new app surface. If the target is `lotsOfFish`, the
   * caller can also seed the inner view; otherwise the inner view
   * is left untouched so a player who tabs out of Lots 'o Fish to
   * a mini-game and back still lands on the same dating-app screen
   * they left.
   */
  openApp: (app: PhoneShellApp, view?: LotsOfFishView) => void;
  /** Convenience: go straight to the home grid. */
  goHome: () => void;
  /** Switch the dating-app bottom tab without re-mounting the shell. */
  setLotsOfFishView: (view: LotsOfFishView) => void;
  /**
   * Candidate id to pre-filter the Journal by when navigating from
   * the SuspectBoard. Set before calling openApp("journal"); the
   * JournalApp reads it on mount then clears it.
   */
  journalFilterCandidateId?: string;
  /** Set the journal filter and optionally navigate to the journal app. */
  setJournalFilter: (candidateId?: string) => void;
  /**
   * Currently-mounted date scene, or null when no date is active. The
   * phone shell renders a full-screen DateSceneView overlay above the
   * normal surface whenever this is set. Kept in memory only — the
   * DateDirector persists its own session to AsyncStorage for crash
   * recovery, and the run's `checkpoint` field re-seeds this slot on
   * cold start.
   */
  activeDateScene: DateScene | null;
  /** Mount a date scene as a full-screen overlay. */
  setActiveDateScene: (scene: DateScene | null) => void;
}

export const usePhoneShell = create<PhoneShellState>((set) => ({
  currentApp: "home",
  lotsOfFishView: "splash",
  openApp: (app, view) =>
    set((prev) => ({
      currentApp: app,
      lotsOfFishView:
        app === "lotsOfFish" && view ? view : prev.lotsOfFishView,
    })),
  goHome: () => set({ currentApp: "home" }),
  setLotsOfFishView: (view) => set({ lotsOfFishView: view }),
  journalFilterCandidateId: undefined,
  setJournalFilter: (candidateId) =>
    set({ journalFilterCandidateId: candidateId }),
  activeDateScene: null,
  setActiveDateScene: (scene) => set({ activeDateScene: scene }),
}));
