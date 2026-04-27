/**
 * Catfish tab layout.
 *
 * Pixel-art chrome doesn't fit iOS 26 liquid glass, so we always use the
 * classic Tabs renderer with hand-styled tints. Five tabs:
 * Swipe / Matches / Journal / Profile / Apps. The Apps tab is the
 * parody-phone home screen with the four playable mini-games and the
 * Lots 'o Fish meta splash.
 */

import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PIXEL_FONT } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";

// Inner content height for the tab bar (icon + label + a touch of
// breathing room). The rendered height inflates this by the device's
// bottom safe-area inset so the icons sit clear of the iOS home
// indicator on every platform.
const TAB_BAR_CONTENT_HEIGHT = 64;

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // Sum unread suspect messages across every active thread so the Matches
  // tab bar pip reflects "anything new across all matches" rather than a
  // single thread.
  const unreadTotal = useGameState((s) =>
    (s.run?.threads ?? []).reduce((acc, t) => acc + (t.unreadCount ?? 0), 0),
  );

  // Task #30 — surface queued "It's a Match!" celebrations on the Swipe
  // tab so the player still notices new matches if they sleep and then
  // immediately switch to Chat / Journal / Profile. The Swipe tab is
  // where the celebration overlay actually drains, so the badge is a
  // pointer back to the place that owns the queue. Closed runs hide
  // the badge — the End-of-Run card is in charge of the screen and a
  // stray pip would imply more swipe work to do.
  //
  // Task #32 / #34 — render both badges ourselves inside `tabBarIcon`
  // so we can pulse them when the count grows. React Navigation's stock
  // `tabBarBadge` is a static string with no animation hook.
  const runOpen = useGameState((s) => !!s.run && !s.run.closed);
  const pendingMatches = useGameState((s) =>
    s.run && !s.run.closed ? (s.run.pendingMatchAnnouncements ?? []).length : 0,
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cfPalette.pinkHot,
        tabBarInactiveTintColor: cfPalette.fog,
        tabBarLabelStyle: {
          fontFamily: PIXEL_FONT,
          // Bumped 7 → 9 so the tiny pixel labels are actually readable
          // on a phone — the previous 7px rendered as a fuzzy smudge on
          // iOS native, which is what made players think the tab bar
          // wasn't there at all.
          fontSize: 9,
          // Letter-spacing tightened from 1 → 0.5 to make room for the
          // 5th "Apps" tab without truncating any label on narrower
          // phones.
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginTop: 2,
        },
        tabBarStyle: {
          // navyHi (#1a1040) gives noticeably more contrast against the
          // navyDeep (#0a0420) screen background than the previous navy
          // (#10082c) — on iPhone displays the old combo was nearly the
          // same color and the bar effectively disappeared.
          backgroundColor: cfPalette.navyHi,
          borderTopWidth: 2,
          borderTopColor: cfPalette.pinkHot,
          elevation: 0,
          // Always pin the bar with an explicit height so react-navigation
          // can never auto-collapse it on a device whose insets it
          // misreads. On native we still add insets.bottom so the icons
          // sit clear of the home indicator; the inner content area
          // stays TAB_BAR_CONTENT_HEIGHT either way.
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          // Keep the bar in the layout flow rather than letting
          // react-navigation pick `position: 'absolute'`, which would
          // cause the swipe deck to flow underneath it and obscure the
          // PASS/LIKE buttons on phones with a short viewport.
          position: "relative",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Swipe",
          tabBarIcon: ({ color }) => (
            <PulseBadgeIcon
              iconName="heart"
              color={color}
              count={pendingMatches}
              visible={runOpen && pendingMatches > 0}
              shouldPulse={runOpen}
              badgeColor={cfPalette.cyan}
              accessibilityLabel={`${pendingMatches} new ${
                pendingMatches === 1 ? "match" : "matches"
              }`}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          tabBarIcon: ({ color }) => (
            <PulseBadgeIcon
              iconName="message-circle"
              color={color}
              count={unreadTotal}
              visible={unreadTotal > 0}
              shouldPulse={runOpen}
              badgeColor={cfPalette.pinkHot}
              accessibilityLabel={`${unreadTotal} unread ${
                unreadTotal === 1 ? "message" : "messages"
              }`}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: "Journal",
          tabBarIcon: ({ color }) => <Feather name="book" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Feather name="user" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="apps"
        options={{
          title: "Apps",
          tabBarIcon: ({ color }) => <Feather name="grid" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

interface PulseBadgeIconProps {
  iconName: React.ComponentProps<typeof Feather>["name"];
  color: string;
  count: number;
  /** Whether the numeric badge should be rendered at all. */
  visible: boolean;
  /**
   * Whether a strict count-increase should trigger the pulse animation.
   * Pass `false` while the run is closed so the badge doesn't twitch
   * on top of the End-of-Run card.
   */
  shouldPulse: boolean;
  badgeColor: string;
  accessibilityLabel?: string;
}

/**
 * Tab icon + small numeric badge that briefly scale-pulses whenever
 * `count` strictly increases. The pulse fires only on a real increase
 * (so re-renders that keep the same value don't replay it), and is
 * suppressed when `shouldPulse` is false.
 *
 * Used by both the Swipe tab (queued match celebrations) and the
 * Matches tab (unread suspect messages across threads) so they feel
 * consistent — same scale curve, same timing.
 */
function PulseBadgeIcon({
  iconName,
  color,
  count,
  visible,
  shouldPulse,
  badgeColor,
  accessibilityLabel,
}: PulseBadgeIconProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(count);

  useEffect(() => {
    const previous = prevCount.current;
    prevCount.current = count;

    if (!shouldPulse) return;
    if (count <= previous) return;

    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.45,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 6,
        stiffness: 140,
      }),
    ]).start();
  }, [count, shouldPulse, scale]);

  const label = count > 9 ? "9+" : String(count);

  return (
    <View style={pulseBadgeStyles.wrap}>
      <Feather name={iconName} size={20} color={color} />
      {visible ? (
        <Animated.View
          style={[
            pulseBadgeStyles.badge,
            { backgroundColor: badgeColor, transform: [{ scale }] },
          ]}
          pointerEvents="none"
          accessibilityLabel={accessibilityLabel}
        >
          <Text style={pulseBadgeStyles.badgeText} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const pulseBadgeStyles = StyleSheet.create({
  wrap: {
    width: 28,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: cfPalette.void,
    fontFamily: PIXEL_FONT,
    fontSize: 9,
    lineHeight: 10,
    includeFontPadding: false,
  },
});
