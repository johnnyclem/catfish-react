/**
 * Lots 'o Fish splash screen — the meta payoff.
 *
 * Reveals that the dating app the player has been using all run is
 * called "Lots 'o Fish". The primary "OPEN APP" CTA hands off to the
 * existing Swipe tab via `router.replace("/")` so the player is taken
 * straight into the swipe deck (and the Apps tab is still in the
 * tab bar to come back to). The secondary "RETURN HOME" drops them
 * back to the parody phone home grid without leaving the Apps tab.
 */
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LotsOfFishIcon } from "./LotsOfFishIcon";

interface Props {
  onReturnHome: () => void;
}

export function LotsOfFishSplash({ onReturnHome }: Props) {
  return (
    <View style={styles.root}>
      <LotsOfFishIcon size={192} />
      <Text style={styles.wordmark}>LOTS &lsquo;O{"\n"}FISH</Text>
      <Pressable
        testID="parody-lotsofish-open"
        accessibilityRole="button"
        accessibilityLabel="Open Lots 'o Fish — returns to the Swipe tab"
        onPress={() => {
          // Switch to the Swipe tab. We target the (tabs) group
          // explicitly — the same route TitleScreen.enterCase uses to
          // enter the tab navigator — so behavior is unambiguous even
          // if a route named "/" is ever added at the app root. The
          // `as never` cast avoids gating on expo-router's generated
          // typed-routes union.
          router.replace("/(tabs)" as never);
        }}
        style={({ pressed }) => [
          styles.primary,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.primaryLabel}>OPEN APP</Text>
      </Pressable>
      <Pressable
        testID="parody-lotsofish-back"
        accessibilityRole="button"
        accessibilityLabel="Return to phone home"
        onPress={onReturnHome}
        style={({ pressed }) => [
          styles.secondary,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.secondaryLabel}>RETURN HOME</Text>
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
  secondary: {
    width: "100%",
    backgroundColor: "#18181b",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: -10,
  },
  secondaryLabel: {
    color: "#71717a",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
