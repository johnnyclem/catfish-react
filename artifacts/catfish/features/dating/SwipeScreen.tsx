/**
 * Lots 'o Fish — Swipe screen.
 *
 * Hosts the existing `SwipeView` deck inside the parody phone shell.
 * Originally lived at `app/(tabs)/index.tsx` and ran as the root tab
 * bar's first slot; Task #59 moved it under the dating-app surface
 * the player opens by tapping the Lots 'o Fish tile on the parody
 * home grid.
 *
 * The phone shell handles the top safe-area inset + status bar above
 * us, so we don't add our own top padding here. We do still bounce
 * back to the title screen if the player somehow lands here without
 * an active run (debug reset, deep link), so the deck never tries to
 * render with no candidates to read.
 */
import { useEffect } from "react";
import { router } from "expo-router";
import { View } from "react-native";

import { useGameState } from "@/core/gameStore";
import { SwipeView } from "@/features/swipe/SwipeView";

export function SwipeScreen() {
  const hydrated = useGameState((s) => s.hydrated);
  const run = useGameState((s) => s.run);

  useEffect(() => {
    if (hydrated && !run) {
      router.replace("/");
    }
  }, [hydrated, run]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0420" }}>
      <SwipeView />
    </View>
  );
}
