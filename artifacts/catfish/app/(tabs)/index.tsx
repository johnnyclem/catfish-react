/**
 * Tab 1 — Swipe deck. Renders the SwipeView from features/swipe.
 */

import { useEffect } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SwipeView } from "@/features/swipe/SwipeView";
import { router } from "expo-router";
import { useGameState } from "@/core/gameContext";

export default function SwipeTab() {
  const insets = useSafeAreaInsets();
  const { hydrated, run } = useGameState();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 16) : insets.top;

  // If we ever land here without a run (deep link, debug reset), bounce out.
  useEffect(() => {
    if (hydrated && !run) {
      router.replace("/");
    }
  }, [hydrated, run]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0420", paddingTop: topPad }}>
      <SwipeView />
    </View>
  );
}
