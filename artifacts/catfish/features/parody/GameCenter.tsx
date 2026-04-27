/**
 * Game Center — stacked list of the four playable parody mini-games.
 *
 * Routed to from the dock's Grid icon. Each row also surfaces the
 * player's persistent best score for that game (from the `parody`
 * slice of the store) so a returning player sees their progress at
 * a glance instead of having to launch each game to check.
 */
import { Feather } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useGameState } from "@/core/gameStore";

import type { ParodyAppId } from "./HomeGrid";

interface Props {
  onOpenApp: (id: ParodyAppId) => void;
  onExitToHome: () => void;
}

interface GameRow {
  id: Extract<
    ParodyAppId,
    "egoTrip" | "sugarCoat" | "safeSpot" | "wordLow"
  >;
  name: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor: string;
  bestLabel: string;
}

const ROWS: GameRow[] = [
  {
    id: "egoTrip",
    name: "Ego Trip",
    icon: "trending-up",
    iconColor: "#fb923c",
    bestLabel: "Best Ego",
  },
  {
    id: "sugarCoat",
    name: "Sugar Coat",
    icon: "gift",
    iconColor: "#ec4899",
    bestLabel: "Best Clout",
  },
  {
    id: "safeSpot",
    name: "Safe Spot",
    icon: "shield",
    iconColor: "#3b82f6",
    bestLabel: "Longest Survived",
  },
  {
    id: "wordLow",
    name: "Word-Low",
    icon: "type",
    iconColor: "#a1a1aa",
    bestLabel: "Best Streak",
  },
];

export function GameCenter({ onOpenApp, onExitToHome }: Props) {
  const parody = useGameState((s) => s.parody);

  function valueFor(id: GameRow["id"]): number {
    switch (id) {
      case "egoTrip":
        return parody.egoTripHighScore;
      case "sugarCoat":
        return parody.sugarCoatHighClout;
      case "safeSpot":
        return parody.safeSpotBestWave;
      case "wordLow":
        return parody.wordLowBestStreak;
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>APPS</Text>
      <View style={styles.divider} />
      <ScrollView contentContainerStyle={styles.list}>
        {ROWS.map((row) => (
          <Pressable
            key={row.id}
            testID={`parody-gamecenter-${row.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Open ${row.name}`}
            onPress={() => onOpenApp(row.id)}
            style={({ pressed }) => [
              styles.card,
              pressed && { backgroundColor: "#27272a" },
            ]}
          >
            <View style={styles.cardIcon}>
              <Feather name={row.icon} size={22} color={row.iconColor} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{row.name}</Text>
              <Text style={styles.cardCaption}>MINI-GAME</Text>
            </View>
            <View style={styles.cardScore}>
              <Text style={styles.cardScoreLabel}>{row.bestLabel}</Text>
              <Text style={styles.cardScoreValue}>{valueFor(row.id)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        testID="parody-gamecenter-exit"
        accessibilityRole="button"
        onPress={onExitToHome}
        style={({ pressed }) => [
          styles.exitBtn,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.exitLabel}>EXIT GAMES</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#09090b",
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  h1: {
    color: "white",
    fontSize: 36,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: -1,
    textTransform: "uppercase",
  },
  divider: {
    height: 1,
    backgroundColor: "#27272a",
    marginTop: 14,
    marginBottom: 18,
  },
  list: {
    gap: 14,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: "#18181b",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: -0.3,
  },
  cardCaption: {
    color: "#71717a",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  cardScore: {
    alignItems: "flex-end",
  },
  cardScoreLabel: {
    color: "#52525b",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  cardScoreValue: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    fontStyle: "italic",
    marginTop: 2,
  },
  exitBtn: {
    marginTop: 14,
    marginBottom: 12,
    backgroundColor: "#18181b",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#27272a",
    paddingVertical: 16,
    alignItems: "center",
  },
  exitLabel: {
    color: "#71717a",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
