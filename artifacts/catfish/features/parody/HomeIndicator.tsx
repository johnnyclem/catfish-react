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
      <View
        style={[
          styles.bar,
          {
            backgroundColor: disabled
              ? "rgba(120, 110, 160, 0.3)"
              : cfPalette.bone,
            opacity: disabled ? 0.4 : 0.8,
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    width: 130,
    height: 4,
    borderRadius: 2,
  },
});
