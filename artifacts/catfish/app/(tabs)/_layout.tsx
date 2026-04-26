/**
 * Catfish tab layout.
 *
 * Pixel-art chrome doesn't fit iOS 26 liquid glass, so we always use the
 * classic Tabs renderer with hand-styled tints. Four tabs from the
 * source doc: Swipe / Matches / Journal / Profile.
 */

import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PIXEL_FONT } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";

// Inner content height for the tab bar (icon + label + a touch of
// breathing room). The actual rendered height inflates this by the
// device's bottom safe-area inset on web — see comment below.
const TAB_BAR_CONTENT_HEIGHT = 64;

export default function TabLayout() {
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  // On native (iOS/Android), react-navigation already inflates the tab
  // bar by the safe-area inset, so leaving height undefined gives the
  // correct behaviour automatically. On web (mobile Safari on iPhone
  // in particular), nothing does that for us — without explicit
  // padding the bar sits flush against the bottom edge of the
  // viewport, INSIDE the iOS home-indicator swipe-up gesture zone.
  // Players then have to fight gesture conflicts to tap any tab.
  // Inflating the bar by `insets.bottom` lifts the icons clear of the
  // gesture arc while keeping the label/icon content area unchanged.
  const webHeight = TAB_BAR_CONTENT_HEIGHT + insets.bottom;

  // Sum unread suspect messages across every active thread so the Matches
  // tab bar pip reflects "anything new across all matches" rather than a
  // single thread. Cap the visible label to keep the badge compact.
  const unreadTotal = useGameState((s) =>
    (s.run?.threads ?? []).reduce((acc, t) => acc + (t.unreadCount ?? 0), 0),
  );
  const matchesBadge =
    unreadTotal > 0 ? (unreadTotal > 9 ? "9+" : String(unreadTotal)) : undefined;

  // Task #30 — surface queued "It's a Match!" celebrations on the Swipe
  // tab so the player still notices new matches if they sleep and then
  // immediately switch to Chat / Journal / Profile. The Swipe tab is
  // where the celebration overlay actually drains, so the badge is a
  // pointer back to the place that owns the queue. Closed runs hide
  // the badge — the End-of-Run card is in charge of the screen and a
  // stray pip would imply more swipe work to do.
  //
  // Task #32 — render the badge ourselves inside `tabBarIcon` so we can
  // pulse it when the count grows. React Navigation's stock
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
          fontSize: 7,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: cfPalette.navy,
          borderTopWidth: 2,
          borderTopColor: cfPalette.purple,
          elevation: 0,
          height: isWeb ? webHeight : undefined,
          paddingBottom: isWeb ? insets.bottom : undefined,
        },
        tabBarBackground: () => (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: cfPalette.navy }]}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Swipe",
          tabBarIcon: ({ color }) => (
            <SwipeTabIcon color={color} count={pendingMatches} runOpen={runOpen} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          tabBarIcon: ({ color }) => (
            <Feather name="message-circle" size={20} color={color} />
          ),
          tabBarBadge: matchesBadge,
          tabBarBadgeStyle: {
            backgroundColor: cfPalette.pinkHot,
            color: cfPalette.void,
            fontFamily: PIXEL_FONT,
            fontSize: 9,
          },
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
    </Tabs>
  );
}

interface SwipeTabIconProps {
  color: string;
  count: number;
  runOpen: boolean;
}

/**
 * Heart icon + queued-match badge, rendered together so the badge can
 * pulse when the count grows. The pulse fires only on a strict
 * count-increase (so re-renders that keep the same value don't replay
 * it), and is suppressed while the run is closed — the badge itself is
 * already hidden in that case, so animating empty space would be
 * wasteful and visually wrong.
 */
function SwipeTabIcon({ color, count, runOpen }: SwipeTabIconProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(count);

  useEffect(() => {
    const previous = prevCount.current;
    prevCount.current = count;

    if (!runOpen) return;
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
  }, [count, runOpen, scale]);

  const showBadge = runOpen && count > 0;
  const label = count > 9 ? "9+" : String(count);

  return (
    <View style={swipeIconStyles.wrap}>
      <Feather name="heart" size={20} color={color} />
      {showBadge ? (
        <Animated.View
          style={[swipeIconStyles.badge, { transform: [{ scale }] }]}
          pointerEvents="none"
          accessibilityLabel={`${count} new ${count === 1 ? "match" : "matches"}`}
        >
          <Text style={swipeIconStyles.badgeText} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const swipeIconStyles = StyleSheet.create({
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
    backgroundColor: cfPalette.cyan,
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
