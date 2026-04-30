/**
 * Lots 'o Fish splash screen — the meta payoff.
 *
 * Reveals that the dating app the player has been using all run is
 * called "Lots 'o Fish". After Task #59 the dating app lives entirely
 * inside the parody phone shell, so "OPEN APP" no longer pops the
 * router stack — it flips the Lots 'o Fish internal view from `splash`
 * to `swipe` via the parent's `onOpen` callback, and the dating-app
 * shell takes over the surface. The home-indicator pill at the foot
 * of the phone shell is the way back to the home grid, so we no
 * longer surface a secondary "RETURN HOME" button here.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LotsOfFishIcon } from "./LotsOfFishIcon";

interface Props {
  /** Hand off to the dating-app Swipe surface inside the phone shell. */
  onOpen: () => void;
}

export function LotsOfFishSplash({ onOpen }: Props) {
  return (
    <View style={styles.root}>
      <LotsOfFishIcon size={192} />
      <Text style={styles.wordmark}>LOTS &lsquo;O{"\n"}FISH</Text>
      <Pressable
        testID="parody-lotsofish-open"
        accessibilityRole="button"
        accessibilityLabel="Open Lots 'o Fish — enters the dating app"
        onPress={onOpen}
        style={({ pressed }) => [
          styles.primary,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.primaryLabel}>OPEN APP</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 28,
  },
  wordmark: {
    color: "#ec4899",
    fontSize: 40,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: -2,
    textAlign: "center",
    textTransform: "uppercase",
    lineHeight: 38,
  },
  primary: {
    width: "100%",
    backgroundColor: "white",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
  },
  primaryLabel: {
    color: "black",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
