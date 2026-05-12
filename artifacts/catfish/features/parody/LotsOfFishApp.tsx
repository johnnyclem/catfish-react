/**
 * Lots 'o Fish — internal app shell.
 *
 * Task #59 collapsed the previous root tab bar (Swipe / Matches /
 * Journal / Profile / Apps) into a parody phone home grid where
 * each app is a tile. Lots 'o Fish is one such tile, and it's the
 * only one with multiple sub-screens — so it gets its own
 * dating-app-style bottom tab bar that lives entirely inside the
 * phone shell. Picking a tab does NOT navigate the expo-router
 * stack; it just flips a value in `usePhoneShell`.
 *
 * The first time the player opens Lots 'o Fish in a session they
 * land on the dating-app splash (the "OPEN APP" reveal). After they
 * tap "OPEN APP" they're dropped on the Swipe deck inside this
 * shell, and the bottom tab bar appears so they can move between
 * Swipe / Matches / Profile without ever leaving the phone surface.
 *
 * The internal tab bar uses Feather icons + tiny pixel labels rather
 * than the larger PixelChrome buttons because it has to read as a
 * "real" dating-app chrome — the parody premise is that this is the
 * actual app the player thought they were using.
 */
import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { MatchesScreen } from "@/features/dating/MatchesScreen";
import { ProfileScreen } from "@/features/dating/ProfileScreen";
import { SocialFeedScreen } from "@/features/dating/SocialFeedScreen";
import { SuspectBoardScreen } from "@/features/journal/SuspectBoardScreen";
import { SwipeScreen } from "@/features/dating/SwipeScreen";

import { LotsOfFishSplash } from "./LotsOfFishSplash";
import { type LotsOfFishView, usePhoneShell } from "./phoneShellState";

interface TabSpec {
  view: Exclude<LotsOfFishView, "splash">;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}

const TABS: TabSpec[] = [
  { view: "swipe", label: "Swipe", icon: "heart" },
  { view: "matches", label: "Matches", icon: "message-circle" },
  { view: "social", label: "Social", icon: "grid" },
  { view: "board", label: "Board", icon: "book-open" },
  { view: "profile", label: "Profile", icon: "user" },
];

export function LotsOfFishApp() {
  const view = usePhoneShell((s) => s.lotsOfFishView);
  const setView = usePhoneShell((s) => s.setLotsOfFishView);
  // Mirror onto the matches badge so the tab bar pip stays in sync
  // with whatever the home grid showed. We use the same selector
  // so the two derived numbers can never diverge.
  const matchesBadge = useGameState((s) => {
    const run = s.run;
    if (!run || run.closed) return 0;
    const pending = (run.pendingMatchAnnouncements ?? []).length;
    const unread = (run.threads ?? []).reduce(
      (acc, t) => acc + (t.unreadCount ?? 0),
      0,
    );
    return pending + unread;
  });

  // Splash short-circuits the bottom tab bar so the reveal screen
  // gets the full surface and doesn't visually conflict with the
  // dating-app chrome it's about to introduce.
  if (view === "splash") {
    return <LotsOfFishSplash onOpen={() => setView("swipe")} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        {view === "swipe" && <SwipeScreen />}
        {view === "matches" && <MatchesScreen />}
        {view === "social" && <SocialFeedScreen />}
        {view === "board" && <SuspectBoardScreen />}
        {view === "profile" && <ProfileScreen />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = tab.view === view;
          const badge = tab.view === "matches" ? matchesBadge : 0;
          return (
            <Pressable
              key={tab.view}
              testID={`lof-tab-${tab.view}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${tab.label} tab`}
              onPress={() => setView(tab.view)}
              style={({ pressed }) => [
                styles.tab,
                pressed && { opacity: 0.6 },
              ]}
            >
              <View>
                <Feather
                  name={tab.icon}
                  size={22}
                  color={active ? cfPalette.cyan : cfPalette.fog}
                />
                {badge > 0 ? (
                  <View style={styles.badge} pointerEvents="none">
                    <Text style={styles.badgeText} >
                      {badge > 9 ? "9+" : String(badge)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? cfPalette.cyan : cfPalette.fog },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
  },
  body: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#0a0420",
    borderTopWidth: 1,
    borderTopColor: cfPalette.iron,
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 2,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 2,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#ff3b30",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },
  badgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 11,
    includeFontPadding: false,
  },
});
