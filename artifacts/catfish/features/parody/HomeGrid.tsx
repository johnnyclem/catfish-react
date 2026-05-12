/**
 * iOS-style app grid for the parody phone home screen.
 *
 * Six tiles in a 4-column grid (the 5th + 6th wrap to row two) plus a
 * frosted dock with three shortcuts: a placeholder user tile, a
 * Game Center shortcut, and the Lots 'o Fish icon — both of which
 * route to the same destinations as their grid counterparts.
 *
 * Each parody-app tile renders its own code-drawn icon (no Feather
 * fallback, no SVG/PNG asset) so the grid reads as a cohesive set of
 * pixel-noir app icons in the Lots 'o Fish style.
 *
 * Task #59: tiles also surface an iOS-style red notification badge
 * in their upper-right corner. The Lots 'o Fish badge sums queued
 * match announcements + unread suspect-message totals across every
 * thread in the active run; the Journal badge counts facts captured
 * since the player last opened the Journal app this session.
 *
 * The home grid is stateless: tile taps fire the parent's
 * `onOpenApp` callback with one of the `ParodyAppId` values, and the
 * phone shell owns the actual screen routing.
 */
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";

import { AppNotificationBadge } from "./AppNotificationBadge";
import { BrowserIcon } from "./BrowserIcon";
import { EgoTripIcon } from "./EgoTripIcon";
import { FaceTimeIcon } from "./FaceTimeIcon";
import { JournalIcon } from "./JournalIcon";
import { LotsOfFishIcon } from "./LotsOfFishIcon";
import { PhoneIcon } from "./PhoneIcon";
import { PhotosIcon } from "./PhotosIcon";
import { SafeSpotIcon } from "./SafeSpotIcon";
import { SugarCoatIcon } from "./SugarCoatIcon";
import { WordLowIcon } from "./WordLowIcon";

export type ParodyAppId =
  | "browser"
  | "facetime"
  | "egoTrip"
  | "sugarCoat"
  | "safeSpot"
  | "wordLow"
  | "lotsOfFish"
  | "journal"
  | "phone"
  | "photos"
  | "gameCenter";

interface Props {
  onOpenApp: (id: ParodyAppId) => void;
}

interface AppTileSpec {
  id: ParodyAppId;
  name: string;
  /** Custom code-drawn icon component for this tile. */
  Icon: ComponentType<{ size: number }>;
}

const APPS: AppTileSpec[] = [
  { id: "egoTrip", name: "Ego Trip", Icon: EgoTripIcon },
  { id: "sugarCoat", name: "Sugar Coat", Icon: SugarCoatIcon },
  { id: "safeSpot", name: "Safe Spot", Icon: SafeSpotIcon },
  { id: "wordLow", name: "Word-Low", Icon: WordLowIcon },
  { id: "lotsOfFish", name: "Lots 'o Fish", Icon: LotsOfFishIcon },
  { id: "journal", name: "Journal", Icon: JournalIcon },
  { id: "browser", name: "Browser", Icon: BrowserIcon },
  { id: "phone", name: "Phone", Icon: PhoneIcon },
  { id: "facetime", name: "FaceTime", Icon: FaceTimeIcon },
  { id: "photos", name: "Photos", Icon: PhotosIcon },
];

export function HomeGrid({ onOpenApp }: Props) {
  // Lots 'o Fish badge — anything in the active run that wants the
  // player's attention inside the dating app. We sum pending match
  // celebrations + unread suspect messages across every thread so a
  // single number captures both "you have a new match to greet" and
  // "an existing match wrote back". Hidden when the run is closed
  // (the End-of-Run card owns the screen) or absent (title screen
  // path before the player taps "Start New Case").
  const lotsOfFishBadge = useGameState((s) => {
    const run = s.run;
    if (!run || run.closed) return 0;
    const pending = (run.pendingMatchAnnouncements ?? []).length;
    const unread = (run.threads ?? []).reduce(
      (acc, t) => acc + (t.unreadCount ?? 0),
      0,
    );
    return pending + unread;
  });

  // Journal badge — facts captured since the player last opened the
  // Journal app this session. Cleared by `markJournalVisited` the
  // moment the player taps the Journal tile (the phone shell calls
  // it from its surface-router effect).
  const journalBadge = useGameState((s) => s.journalNewSinceLastVisit);

  return (
    <View style={styles.root}>
      <LinearGradient
        // Indigo → purple → pink, low opacity, per the user's draft.
        colors={["rgba(49, 46, 129, 0.65)", "rgba(88, 28, 135, 0.55)", "rgba(131, 24, 67, 0.55)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.grid}>
        {APPS.map((app) => {
          const badge =
            app.id === "lotsOfFish"
              ? lotsOfFishBadge
              : app.id === "journal"
                ? journalBadge
                : 0;
          const accLabel =
            app.id === "lotsOfFish" && badge > 0
              ? `${badge} new ${badge === 1 ? "alert" : "alerts"} in Lots 'o Fish`
              : app.id === "journal" && badge > 0
                ? `${badge} new ${badge === 1 ? "fact" : "facts"} in the Journal`
                : undefined;
          return (
            <AppTile
              key={app.id}
              spec={app}
              onPress={() => onOpenApp(app.id)}
              badgeCount={badge}
              badgeAccessibilityLabel={accLabel}
            />
          );
        })}
      </View>

      {/* Frosted dock at the bottom */}
      <View style={styles.dock}>
        <View style={styles.dockSlot}>
          <View style={[styles.dockTile, styles.dockUser]}>
            <Feather name="user" size={26} color="rgba(255, 255, 255, 0.5)" />
          </View>
        </View>
        <Pressable
          testID="parody-dock-gamecenter"
          accessibilityRole="button"
          accessibilityLabel="Open Game Center"
          onPress={() => onOpenApp("gameCenter")}
          style={styles.dockSlot}
        >
          {({ pressed }) => (
            <View
              style={[
                styles.dockTile,
                styles.dockGameCenter,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="grid" size={26} color="#4f46e5" />
            </View>
          )}
        </Pressable>
        <Pressable
          testID="parody-dock-lotsofish"
          accessibilityRole="button"
          accessibilityLabel="Open Lots 'o Fish"
          onPress={() => onOpenApp("lotsOfFish")}
          style={styles.dockSlot}
        >
          {({ pressed }) => (
            <View style={pressed ? { opacity: 0.7 } : undefined}>
              <LotsOfFishIcon size={52} />
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

interface TileProps {
  spec: AppTileSpec;
  onPress: () => void;
  badgeCount: number;
  badgeAccessibilityLabel?: string;
}

function AppTile({
  spec,
  onPress,
  badgeCount,
  badgeAccessibilityLabel,
}: TileProps) {
  const Icon = spec.Icon;
  return (
    <Pressable
      testID={`parody-app-${spec.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Open ${spec.name}`}
      onPress={onPress}
      style={styles.tileSlot}
    >
      {({ pressed }) => (
        <View style={styles.tileInner}>
          <View
            style={[
              styles.tileFrame,
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
          >
            <Icon size={TILE_SIZE} />
            {/* Badge sits on the icon (overflow visible) so the pill
                pokes out over the tile's upper-right corner. The
                tile label below is unaffected. */}
            <AppNotificationBadge
              count={badgeCount}
              accessibilityLabel={badgeAccessibilityLabel}
            />
          </View>
          <Text style={styles.tileLabel} >
            {spec.name}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const TILE_SIZE = 56;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1a0930",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 18,
    paddingTop: 36,
    rowGap: 26,
  },
  tileSlot: {
    width: "25%",
    alignItems: "center",
  },
  tileInner: {
    alignItems: "center",
    gap: 6,
  },
  tileFrame: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    // Allow the notification badge to overflow the tile's frame so
    // the pill nudges past the icon's upper-right corner instead of
    // clipping inside it.
    overflow: "visible",
  },
  tileLabel: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: 64,
  },
  dock: {
    position: "absolute",
    bottom: 18,
    left: "5%",
    right: "5%",
    height: 78,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 10,
  },
  dockSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  dockTile: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dockUser: {
    backgroundColor: "rgba(39, 39, 42, 0.8)",
  },
  dockGameCenter: {
    backgroundColor: cfPalette.bone,
  },
});
