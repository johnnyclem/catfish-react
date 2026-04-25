/**
 * Catfish tab layout.
 *
 * Pixel-art chrome doesn't fit iOS 26 liquid glass, so we always use the
 * classic Tabs renderer with hand-styled tints. Four tabs from the
 * source doc: Swipe / Matches / Journal / Profile.
 */

import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";

import { PIXEL_FONT } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";

export default function TabLayout() {
  const isWeb = Platform.OS === "web";

  // Sum unread suspect messages across every active thread so the Matches
  // tab bar pip reflects "anything new across all matches" rather than a
  // single thread. Cap the visible label to keep the badge compact.
  const unreadTotal = useGameState((s) =>
    (s.run?.threads ?? []).reduce((acc, t) => acc + (t.unreadCount ?? 0), 0),
  );
  const matchesBadge =
    unreadTotal > 0 ? (unreadTotal > 9 ? "9+" : String(unreadTotal)) : undefined;

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
          height: isWeb ? 84 : undefined,
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
          tabBarIcon: ({ color }) => <Feather name="heart" size={20} color={color} />,
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
