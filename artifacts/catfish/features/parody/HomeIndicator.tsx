/**
 * Bottom "home indicator" pill used at the foot of the parody phone
 * surface. Tapping it returns to the home grid from inside any app —
 * it's the parody-OS equivalent of the iOS bottom-edge swipe.
 *
 * Renders a generous invisible touch target around the visible pill so
 * even fat-fingered taps near the bottom of the screen are forgiving;
 * the pill itself stays slim to read like the real OS chrome.
 */
import { Pressable, StyleSheet, View } from "react-native";

import { PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";

interface Props {
  onPress: () => void;
  /** Disable the tap target — used on the home screen itself. */
  disabled?: boolean;
}

export function HomeIndicator({ onPress, disabled }: Props) {
  return (
    <Pressable
      testID="parody-home-indicator"
      accessibilityRole="button"
      accessibilityLabel="Return to phone home screen"
      onPress={onPress}
      disabled={disabled}
      style={styles.hit}
      hitSlop={12}
    >
      {/* Task #68 — explicit "home" caption above the bone pill so
          players who don't recognize the iOS-style indicator have a
          discoverable way back to the home grid. The caption hides
          on the home screen itself (where the indicator is disabled
          and irrelevant). */}
      {!disabled ? (
        <PixelText
          size={6}
          color={cfPalette.ash}
          uppercase
          align="center"
          style={styles.caption}
        >
          home
        </PixelText>
      ) : null}
      <View
        style={[
          styles.bar,
          {
            backgroundColor: disabled
              ? "rgba(120, 110, 160, 0.3)"
              : cfPalette.bone,
            // Bumped from 0.8 → 1.0 so the pill reads as an actual
            // affordance instead of decorative chrome.
            opacity: disabled ? 0.4 : 1,
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    marginBottom: 4,
    letterSpacing: 1.5,
  },
  bar: {
    width: 130,
    height: 4,
    borderRadius: 2,
  },
});
