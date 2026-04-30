/**
 * Phone-shell wrapper around the Journal screen.
 *
 * The Journal lives as its own home-grid app after Task #59. Its
 * iOS-style red badge on the home screen counts facts captured since
 * the player last visited; opening the Journal must clear that badge
 * the moment the surface mounts.
 *
 * We can't call `markJournalVisited` from inside `JournalScreen`
 * itself because the same screen body needs to keep working in
 * isolation (component preview, future fullscreen variants). Wrapping
 * it here keeps the side-effect at the routing boundary where it
 * actually belongs.
 */
import { useEffect } from "react";

import { useGameState } from "@/core/gameStore";

import { JournalScreen } from "@/features/journal/JournalScreen";

export function JournalApp() {
  const markJournalVisited = useGameState((s) => s.markJournalVisited);

  useEffect(() => {
    // Fire-and-forget — the action persists the new "seen" baseline
    // so the badge stays cleared across cold starts. We don't await
    // because the UI doesn't block on the write.
    void markJournalVisited();
  }, [markJournalVisited]);

  return <JournalScreen />;
}
