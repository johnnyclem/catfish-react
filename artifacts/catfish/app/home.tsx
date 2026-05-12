/**
 * Phone-home shell — the parody phone interface.
 *
 * Task #59 collapsed the previous root tab bar (Swipe / Matches /
 * Journal / Profile / Apps) into a single phone-home grid. This route
 * is now the post-title destination: every "Continue Case" / "Start
 * New Case" CTA, every End-of-Run "Start New Case", and every chat
 * thread's `router.back()` resolves here.
 *
 * The shell renders, top to bottom:
 *   1. PhoneStatusBar — fake iOS status row (time + battery glyph)
 *   2. The current `surface` from `usePhoneShell` — home grid, the
 *      Lots 'o Fish dating-app shell, the standalone Journal app, or
 *      one of the four parody mini-games.
 *   3. HomeIndicator — the "back to home" pill that mirrors the iOS
 *      bottom-edge swipe and works from anywhere except the home grid.
 *
 * The actual surface flipping is owned by `usePhoneShell`, which lets
 * non-shell components (the End-of-Run card, the title screen) seed
 * which app should be visible when the player lands here next.
 *
 * Why a single route instead of nested expo-router screens? Two
 * reasons. First, swapping the visible surface inside one screen keeps
 * `markJournalVisited` + the dating-app sub-tabs cheap (no re-mount,
 * no router stack pushes). Second, the home-indicator pill should
 * never push or pop the router — it's a "go home inside the OS"
 * gesture, not a navigation history primitive — so it's much simpler
 * to drive from local state than from `router.back`.
 */
import { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGameState } from "@/core/gameStore";

import { BrowserApp } from "@/features/phone/BrowserApp";
import { PhotosApp } from "@/features/parody/PhotosApp";
import { PhoneApp } from "@/features/phone/PhoneApp";
import { FaceTimeApp } from "@/features/phone/FaceTimeApp";
import { GameCenter } from "@/features/parody/GameCenter";
import { HomeGrid } from "@/features/parody/HomeGrid";
import { HomeIndicator } from "@/features/parody/HomeIndicator";
import SettingsScreen from "@/features/settings/SettingsScreen";
import { JournalApp } from "@/features/parody/JournalApp";
import { LotsOfFishApp } from "@/features/parody/LotsOfFishApp";
import { PhoneStatusBar } from "@/features/parody/PhoneStatusBar";
import { usePhoneShell } from "@/features/parody/phoneShellState";
import { EgoTrip } from "@/features/parody/games/EgoTrip";
import { SafeSpot } from "@/features/parody/games/SafeSpot";
import { SugarCoat } from "@/features/parody/games/SugarCoat";
import { WordLow } from "@/features/parody/games/WordLow";

export default function PhoneHomeShell() {
  const insets = useSafeAreaInsets();
  const currentApp = usePhoneShell((s) => s.currentApp);
  const openApp = usePhoneShell((s) => s.openApp);
  const goHome = usePhoneShell((s) => s.goHome);
  const setLotsOfFishView = usePhoneShell((s) => s.setLotsOfFishView);
  const markJournalVisited = useGameState((s) => s.markJournalVisited);

  const topPad = Math.max(insets.top, Platform.OS === "web" ? 16 : 8);
  const bottomPad = Math.max(0, insets.bottom);

  // Tapping the Journal tile should clear the new-facts badge before
  // the player even sees the Journal contents. JournalApp also calls
  // markJournalVisited on mount, but firing it from the routing edge
  // means the badge clears the instant the surface flips — no
  // single-frame "1 new fact" flash before the inner effect runs.
  useEffect(() => {
    if (currentApp === "journal") {
      void markJournalVisited();
    }
  }, [currentApp, markJournalVisited]);

  // Phase 11.5 — checkpoint restoration on mount. If the run has a
  // mid-game checkpoint (e.g. an active Date scene), auto-navigate
  // to the appropriate phone-shell surface instead of the home grid.
  const run = useGameState((s) => s.run);
  const checkpointHandled = useRef(false);
  useEffect(() => {
    if (checkpointHandled.current) return;
    if (!run?.checkpoint) return;
    const cp = run.checkpoint;
    switch (cp.type) {
      case "facetime":
        openApp("facetime");
        break;
      case "chat":
        if (cp.screen) {
          setLotsOfFishView(cp.screen as any);
        }
        openApp("lotsOfFish");
        break;
      case "date":
        // Date scenes are handled by Lots 'o Fish's swipe tab.
        // Landing on the home grid is the safe default until the
        // full Date mode surface lands in a future phase.
        openApp("lotsOfFish", "swipe");
        break;
    }
    checkpointHandled.current = true;
  }, [run, openApp, setLotsOfFishView]);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: topPad, paddingBottom: bottomPad },
      ]}
    >
      <PhoneStatusBar />

      <View style={styles.surface}>
        {currentApp === "home" && (
          <HomeGrid onOpenApp={(id) => openApp(id)} />
        )}
        {currentApp === "lotsOfFish" && <LotsOfFishApp />}
        {currentApp === "journal" && <JournalApp />}
        {currentApp === "phone" && <PhoneApp />}
        {currentApp === "browser" && <BrowserApp />}
        {currentApp === "facetime" && <FaceTimeApp />}
        {currentApp === "photos" && <PhotosApp />}
        {currentApp === "gameCenter" && (
          <GameCenter
            onOpenApp={(id) => openApp(id)}
            onExitToHome={goHome}
          />
        )}
        {currentApp === "wordLow" && <WordLow onExit={goHome} />}
        {currentApp === "egoTrip" && <EgoTrip onExit={goHome} />}
        {currentApp === "safeSpot" && <SafeSpot onExit={goHome} />}
        {currentApp === "sugarCoat" && <SugarCoat onExit={goHome} />}
        {currentApp === "settings" && <SettingsScreen />}
      </View>

      <HomeIndicator
        onPress={() => {
          // Returning home from inside Lots 'o Fish should reset the
          // dating-app view to the splash so the next entry replays
          // the meta reveal — without this, hopping out and back in
          // would silently land the player on whichever tab they
          // last had open.
          if (currentApp === "lotsOfFish") {
            setLotsOfFishView("splash");
          }
          goHome();
        }}
        disabled={currentApp === "home"}
      />
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
