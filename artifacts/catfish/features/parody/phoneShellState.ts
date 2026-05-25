/**
 * Phone-home shell navigation state.
 *
 * The parody phone home grid is the main interface (no root tab bar)
 * and a single `currentApp` value drives which surface fills the
 * phone shell. We lift that state into a dedicated Zustand store so
 * non-shell components — `EndOfRunCard`, the `LotsOfFishSplash`
 * "OPEN APP" CTA, the title screen, the chat header's "background
 * check" button — can route the player to a specific surface without
 * prop-drilling through `app/home.tsx`.
 *
 * Lots 'o Fish is the only "app" with internal sub-surfaces (its
 * own dating-app bottom tab bar exposing Swipe / Matches plus an
 * intro splash). Those get their own slice here too.
 *
 * Not persisted: a per-session navigation slot is enough; a player
 * who relaunches the app should land on the home grid, not deep
 * inside whatever screen they last left open.
 */
import { create } from "zustand";

import type { DateScene } from "@/core/dateScene";

/**
 * Every surface the phone shell can render. `home` is the parody
 * grid itself. The three investigation apps (`goggle`, `linkedOut`,
 * `instagrim`) are siblings of Lots 'o Fish so the player can hop
 * between dating and background-checking without nesting.
 */
export type PhoneShellApp =
  | "home"
  | "lotsOfFish"
  | "journal"
  | "phone"
  | "goggle"
  | "linkedOut"
  | "instagrim"
  | "facetime"
  | "photos"
  | "settings";

/**
 * Lots 'o Fish has two real "screens" (Swipe + Matches) plus its
 * splash intro.
 */
export type LotsOfFishView = "splash" | "swipe" | "matches";

/**
 * Journal has three sub-sections selected by a top pill bar:
 *   - notes: captured + authored facts (the original Journal body)
 *   - suspects: card-grid SuspectBoard
 *   - social: per-character Instagram-style feed
 */
export type JournalSection = "notes" | "suspects" | "social";

interface PhoneShellState {
  currentApp: PhoneShellApp;
  /** Active sub-screen within Lots 'o Fish. Ignored by other apps. */
  lotsOfFishView: LotsOfFishView;
  /** Active section within the Journal app. Ignored by other apps. */
  journalSection: JournalSection;
  /**
   * Flip to a new app surface. If the target is `lotsOfFish`, the
   * caller can also seed the inner view; otherwise the inner view
   * is left untouched so a player who tabs out of Lots 'o Fish to
   * a sibling app and back still lands on the same dating-app screen
   * they left.
   */
  openApp: (app: PhoneShellApp, view?: LotsOfFishView) => void;
  /** Convenience: go straight to the home grid. */
  goHome: () => void;
  /** Switch the dating-app bottom tab without re-mounting the shell. */
  setLotsOfFishView: (view: LotsOfFishView) => void;
  /** Switch the Journal sub-section without re-mounting the shell. */
  setJournalSection: (section: JournalSection) => void;
  /**
   * Candidate id to pre-filter the Journal by when navigating from
   * the SuspectBoard. Set before calling openApp("journal"); the
   * JournalApp reads it on mount then clears it.
   */
  journalFilterCandidateId?: string;
  /** Set the journal filter and optionally navigate to the journal app. */
  setJournalFilter: (candidateId?: string) => void;
  /**
   * Candidate id seeded by the chat header's "background check" button
   * (or any other deep-link). GoggleApp reads this on mount, prefills
   * its query with the candidate's displayName, fires the search once,
   * and clears the slot. Same pattern as `journalFilterCandidateId`.
   */
  pendingGoggleCandidate?: string;
  /**
   * Jump straight to Goggle preloaded with a candidate's name. Used by
   * the chat header so a single tap kicks off the background-check
   * flow without typing.
   */
  openGoggleForCandidate: (candidateId: string) => void;
  /** Clear the pending candidate slot once GoggleApp has consumed it. */
  consumePendingGoggleCandidate: () => void;
  /**
   * Candidates the player has matched with but not yet Googled. Seeded
   * whenever a new chat thread is opened (in ThreadView) and cleared
   * the moment that candidate's name is queried in Goggle. Drives the
   * Goggle home-grid badge so the player has a "new lead to background
   * check" cue.
   */
  pendingBackgroundChecks: string[];
  markBackgroundCheckPending: (candidateId: string) => void;
  clearBackgroundCheck: (candidateId: string) => void;
  /**
   * Currently-mounted date scene, or null when no date is active. The
   * phone shell renders a full-screen DateSceneView overlay above the
   * normal surface whenever this is set.
   */
  activeDateScene: DateScene | null;
  /** Mount a date scene as a full-screen overlay. */
  setActiveDateScene: (scene: DateScene | null) => void;
}

export const usePhoneShell = create<PhoneShellState>((set, get) => ({
  currentApp: "home",
  lotsOfFishView: "splash",
  journalSection: "notes",
  openApp: (app, view) =>
    set((prev) => ({
      currentApp: app,
      lotsOfFishView:
        app === "lotsOfFish" && view ? view : prev.lotsOfFishView,
    })),
  goHome: () => set({ currentApp: "home" }),
  setLotsOfFishView: (view) => set({ lotsOfFishView: view }),
  setJournalSection: (section) => set({ journalSection: section }),
  journalFilterCandidateId: undefined,
  setJournalFilter: (candidateId) =>
    set({ journalFilterCandidateId: candidateId }),
  pendingGoggleCandidate: undefined,
  openGoggleForCandidate: (candidateId) =>
    set({ currentApp: "goggle", pendingGoggleCandidate: candidateId }),
  consumePendingGoggleCandidate: () =>
    set({ pendingGoggleCandidate: undefined }),
  pendingBackgroundChecks: [],
  markBackgroundCheckPending: (candidateId) => {
    const list = get().pendingBackgroundChecks;
    if (list.includes(candidateId)) return;
    set({ pendingBackgroundChecks: [...list, candidateId] });
  },
  clearBackgroundCheck: (candidateId) => {
    const list = get().pendingBackgroundChecks;
    if (!list.includes(candidateId)) return;
    set({ pendingBackgroundChecks: list.filter((id) => id !== candidateId) });
  },
  activeDateScene: null,
  setActiveDateScene: (scene) => set({ activeDateScene: scene }),
}));
