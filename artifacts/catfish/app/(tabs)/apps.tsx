/**
 * Tab 5 — Apps.
 *
 * Renders an iOS-style phone home grid with five tiles + a frosted
 * dock, plus the four playable parody mini-games and the meta
 * "Lots 'o Fish" splash that hands off to the existing Swipe tab.
 *
 * The Apps tab owns its own `currentApp` navigation state — each
 * tile push and the bottom home-indicator bar mutate it directly,
 * so the in-app navigation never leaves the tab stack. That keeps
 * the existing Swipe / Matches / Journal / Profile tabs untouched
 * and means the games never have to participate in expo-router.
 *
 * Lots 'o Fish is the one exception: its primary CTA does call
 * `router.replace("/")` so the player lands on the real Swipe deck
 * — that meta hand-off is the entire point of the app.
 */
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GameCenter } from "@/features/parody/GameCenter";
import { HomeGrid, type ParodyAppId } from "@/features/parody/HomeGrid";
import { HomeIndicator } from "@/features/parody/HomeIndicator";
import { LotsOfFishSplash } from "@/features/parody/LotsOfFishSplash";
import { PhoneStatusBar } from "@/features/parody/PhoneStatusBar";
import { EgoTrip } from "@/features/parody/games/EgoTrip";
import { SafeSpot } from "@/features/parody/games/SafeSpot";
import { SugarCoat } from "@/features/parody/games/SugarCoat";
import { WordLow } from "@/features/parody/games/WordLow";

type Surface = ParodyAppId | "HOME";

export default function AppsTab() {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<Surface>("HOME");
  const topPad = Math.max(insets.top, Platform.OS === "web" ? 16 : 8);
  const bottomPad = Math.max(0, insets.bottom);

  const goHome = () => setCurrent("HOME");

  return (
    <View
      style={[
        styles.root,
        { paddingTop: topPad, paddingBottom: bottomPad },
      ]}
    >
      <PhoneStatusBar />

      <View style={styles.surface}>
        {current === "HOME" ? (
          <HomeGrid onOpenApp={(id) => setCurrent(id)} />
        ) : null}

        {current === "lotsOfFish" ? (
          <LotsOfFishSplash onReturnHome={goHome} />
        ) : null}

        {current === "gameCenter" ? (
          <GameCenter onOpenApp={(id) => setCurrent(id)} onExitToHome={goHome} />
        ) : null}

        {current === "wordLow" ? <WordLow onExit={goHome} /> : null}
        {current === "egoTrip" ? <EgoTrip onExit={goHome} /> : null}
        {current === "safeSpot" ? <SafeSpot onExit={goHome} /> : null}
        {current === "sugarCoat" ? <SugarCoat onExit={goHome} /> : null}
      </View>

      <HomeIndicator onPress={goHome} disabled={current === "HOME"} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  surface: {
    flex: 1,
    overflow: "hidden",
  },
});
