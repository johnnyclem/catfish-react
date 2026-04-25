/**
 * UndoDiscardBanner — short-lived "Fact discarded" toast for the
 * Journal tab.
 *
 * Renders whenever `gameStore.recentlyDiscarded` is non-null. The
 * store owns the expiry timer (see `removeFact` in `gameStore.ts`) so
 * the undo window stays honest even if the player navigates away from
 * the Journal tab — this component only handles presentation. Tapping
 * UNDO restores the fact in place; letting the store-side timer fire
 * silently drops the stash and the banner unmounts on the next
 * subscription tick.
 */

import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { PixelPanel, PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";

interface UndoDiscardBannerProps {
  /**
   * Distance to lift the banner above the bottom edge so it clears the
   * tab bar / safe area inset. Computed by the Journal screen.
   */
  bottomOffset: number;
}

export function UndoDiscardBanner({ bottomOffset }: UndoDiscardBannerProps) {
  const recentlyDiscarded = useGameState((s) => s.recentlyDiscarded);
  const restoreFact = useGameState((s) => s.restoreFact);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!recentlyDiscarded) return;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      // Snap state back so the next discard animates in cleanly.
      opacity.setValue(0);
      translateY.setValue(12);
    };
  }, [recentlyDiscarded, opacity, translateY]);

  if (!recentlyDiscarded) return null;

  const preview = (recentlyDiscarded.capturedQuote ?? "").trim();
  const truncated =
    preview.length > 48 ? `${preview.slice(0, 45).trimEnd()}…` : preview;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom: bottomOffset, opacity, transform: [{ translateY }] },
      ]}
    >
      <PixelPanel variant="raised" borderColor={cfPalette.cyan} style={styles.panel}>
        <View style={styles.body}>
          <PixelText size={7} color={cfPalette.cyan} uppercase>
            fact discarded
          </PixelText>
          {truncated.length > 0 && (
            <PixelText size={8} color={cfPalette.bone} style={styles.preview}>
              {`“${truncated}”`}
            </PixelText>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo discard"
          hitSlop={8}
          onPress={() => {
            void restoreFact(recentlyDiscarded.id);
          }}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        >
          <PixelText size={9} color={cfPalette.pinkHot} uppercase glow>
            undo
          </PixelText>
        </Pressable>
      </PixelPanel>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 18,
    right: 18,
  },
  panel: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  body: {
    flex: 1,
    paddingRight: 12,
  },
  preview: {
    marginTop: 6,
    lineHeight: 14,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: cfPalette.pinkHot,
    backgroundColor: cfPalette.panel,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: { cursor: "pointer" } as object,
      default: {},
    }),
  },
  chipPressed: {
    opacity: 0.65,
    transform: [{ translateY: 1 }],
  },
});
