/**
 * iOS-style app grid for the parody phone home screen.
 *
 * Nine tiles in a 4-column grid (plus a frosted dock with three
 * shortcuts: a placeholder user tile, a Goggle shortcut for one-tap
 * background checks, and the Lots 'o Fish icon).
 *
 * Each parody-app tile renders its own code-drawn icon so the grid
 * reads as a cohesive set of pixel-noir app icons in the Lots 'o Fish
 * style.
 *
 * Notification badges:
 *   - Lots 'o Fish: queued match announcements + unread suspect totals
 *   - Journal: facts captured since the player last opened the Journal
 *   - Goggle: matched candidates the player hasn't Googled yet
 *
 * The home grid is stateless: tile taps fire the parent's `onOpenApp`
 * callback with one of the `ParodyAppId` values, and the phone shell
 * owns the actual screen routing.
 */
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useGameState } from "@/core/gameStore";

import { AppNotificationBadge } from "./AppNotificationBadge";
import { FaceTimeIcon } from "./FaceTimeIcon";
import { GoggleIcon } from "./GoggleIcon";
import { InstagrimIcon } from "./InstagrimIcon";
import { JournalIcon } from "./JournalIcon";
import { LinkedOutIcon } from "./LinkedOutIcon";
import { LotsOfFishIcon } from "./LotsOfFishIcon";
import { PhoneIcon } from "./PhoneIcon";
import { PhotosIcon } from "./PhotosIcon";
import { SettingsIcon } from "@/features/settings/SettingsIcon";
import { usePhoneShell } from "./phoneShellState";

export type ParodyAppId =
  | "lotsOfFish"
  | "journal"
  | "goggle"
  | "linkedOut"
  | "instagrim"
  | "phone"
  | "facetime"
  | "photos"
  | "settings";

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
  { id: "lotsOfFish", name: "Lots 'o Fish", Icon: LotsOfFishIcon },
  { id: "journal", name: "Journal", Icon: JournalIcon },
  { id: "goggle", name: "Goggle", Icon: GoggleIcon },
  { id: "linkedOut", name: "LinkedOut", Icon: LinkedOutIcon },
  { id: "instagrim", name: "Instagrim", Icon: InstagrimIcon },
  { id: "phone", name: "Phone", Icon: PhoneIcon },
  { id: "facetime", name: "FaceTime", Icon: FaceTimeIcon },
  { id: "photos", name: "Photos", Icon: PhotosIcon },
  { id: "settings", name: "Settings", Icon: SettingsIcon },
];

export function HomeGrid({ onOpenApp }: Props) {
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

  const journalBadge = useGameState((s) => s.journalNewSinceLastVisit);

  // Goggle badge — number of matched candidates the player hasn't
  // background-checked yet. Seeded by ThreadView when a new match
  // opens; cleared the moment Goggle searches that candidate's name.
  const goggleBadge = usePhoneShell((s) => s.pendingBackgroundChecks.length);

  return (
    <View style={styles.root}>
      <LinearGradient
        // Indigo → purple → pink, low opacity.
        colors={["rgba(49, 46, 129, 0.65)", "rgba(88, 28, 135, 0.55)", "rgba(131, 24, 67, 0.55)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.grid}>
        {APPS.map((app) => {
          let badge = 0;
          let accLabel: string | undefined;
          if (app.id === "lotsOfFish") {
            badge = lotsOfFishBadge;
            if (badge > 0)
              accLabel = `${badge} new ${badge === 1 ? "alert" : "alerts"} in Lots 'o Fish`;
          } else if (app.id === "journal") {
            badge = journalBadge;
            if (badge > 0)
              accLabel = `${badge} new ${badge === 1 ? "fact" : "facts"} in the Journal`;
          } else if (app.id === "goggle") {
            badge = goggleBadge;
            if (badge > 0)
              accLabel = `${badge} new ${badge === 1 ? "lead" : "leads"} to background check`;
          }
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
          testID="parody-dock-goggle"
          accessibilityRole="button"
          accessibilityLabel="Open Goggle"
          onPress={() => onOpenApp("goggle")}
          style={styles.dockSlot}
        >
          {({ pressed }) => (
            <View style={pressed ? { opacity: 0.7 } : undefined}>
              <GoggleIcon size={52} />
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
});
