/**
 * iOS-style app grid for the parody phone home screen.
 *
 * Five tiles in a 4-column grid (the 5th wraps to row two) plus a
 * frosted dock with three shortcuts: a placeholder user tile, a
 * Game Center shortcut, and the Lots 'o Fish icon — both of which
 * route to the same destinations as their grid counterparts.
 *
 * The home grid is stateless: tile taps fire the parent's
 * `onOpenApp` callback with one of the `ParodyAppId` values, and the
 * Apps tab owns the actual screen routing.
 */
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { LotsOfFishIcon } from "./LotsOfFishIcon";

export type ParodyAppId =
  | "egoTrip"
  | "sugarCoat"
  | "safeSpot"
  | "wordLow"
  | "lotsOfFish"
  | "gameCenter";

interface Props {
  onOpenApp: (id: ParodyAppId) => void;
}

interface AppTileSpec {
  id: ParodyAppId;
  name: string;
  /** Feather icon name, or `null` to render the custom LotsOfFish art. */
  icon: React.ComponentProps<typeof Feather>["name"] | null;
  gradient: readonly [string, string] | null;
  iconColor?: string;
  /** Flat (no gradient) tile background — used by Word-Low. */
  flatBg?: string;
}

const APPS: AppTileSpec[] = [
  {
    id: "egoTrip",
    name: "Ego Trip",
    icon: "trending-up",
    gradient: ["#fb923c", "#ec4899"],
  },
  {
    id: "sugarCoat",
    name: "Sugar Coat",
    icon: "gift",
    gradient: ["#ec4899", "#9333ea"],
  },
  {
    id: "safeSpot",
    name: "Safe Spot",
    icon: "shield",
    gradient: ["#3b82f6", "#4f46e5"],
  },
  {
    id: "wordLow",
    name: "Word-Low",
    icon: "type",
    gradient: null,
    flatBg: "#27272a",
  },
  {
    id: "lotsOfFish",
    name: "Lots 'o Fish",
    icon: null,
    gradient: null,
  },
];

export function HomeGrid({ onOpenApp }: Props) {
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
        {APPS.map((app) => (
          <AppTile key={app.id} spec={app} onPress={() => onOpenApp(app.id)} />
        ))}
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
}

function AppTile({ spec, onPress }: TileProps) {
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
            {spec.id === "lotsOfFish" ? (
              <LotsOfFishIcon size={56} />
            ) : spec.gradient ? (
              <LinearGradient
                colors={spec.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tileGradient}
              >
                {spec.icon ? (
                  <Feather name={spec.icon} size={28} color="white" />
                ) : null}
              </LinearGradient>
            ) : (
              <View
                style={[
                  styles.tileGradient,
                  { backgroundColor: spec.flatBg ?? "#27272a" },
                ]}
              >
                {spec.icon ? (
                  <Feather name={spec.icon} size={28} color="white" />
                ) : null}
              </View>
            )}
          </View>
          <Text style={styles.tileLabel} numberOfLines={1}>
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
  },
  tileGradient: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
