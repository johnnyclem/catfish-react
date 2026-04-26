/**
 * LikeStamp — brief "LIKE!" feedback toast shown after a right-swipe.
 *
 * Replaces the old behaviour of immediately popping `MatchCelebration`
 * on every right-swipe. Now that match resolution is deferred to
 * `advanceDay()` (Sleep), the swipe itself only needs a small,
 * non-blocking confirmation that the like was registered. The actual
 * celebration plays the next morning if (and only if) the candidate
 * reciprocates.
 *
 * The stamp auto-fades after `durationMs` (default 600ms) and clears
 * itself by calling `onHide`. It does not block touch input — the
 * player can keep swiping while the stamp is on screen.
 */

import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { PixelText } from "./PixelChrome";

import { cfPalette } from "@/constants/colors";

interface LikeStampProps {
  visible: boolean;
  /** Display name of the candidate that was liked. */
  candidateName: string;
  onHide: () => void;
  /** Total visible time before fade-out completes. */
  durationMs?: number;
}

export function LikeStamp({
  visible,
  candidateName,
  onHide,
  durationMs = 600,
}: LikeStampProps) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      scale.setValue(0.7);
      return;
    }
    // Pop in fast, hold, fade out. The hold gives the player just
    // enough time to register the LIKE before the next card lands.
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 7,
        stiffness: 180,
      }),
    ]).start();

    const fadeOut = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => onHide());
    }, Math.max(0, durationMs - 180));

    return () => clearTimeout(fadeOut);
  }, [visible, fade, scale, onHide, durationMs]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: fade }]}
      pointerEvents="none"
      testID="like-stamp"
    >
      <Animated.View
        style={[
          styles.stamp,
          { transform: [{ scale }, { rotate: "-8deg" }] },
        ]}
      >
        <PixelText size={18} color={cfPalette.pinkHot} uppercase glow align="center">
          like!
        </PixelText>
        <View style={styles.divider} />
        <PixelText size={8} color={cfPalette.bone} align="center">
          {candidateName}
        </PixelText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 80,
  },
  stamp: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    backgroundColor: "rgba(3,1,10,0.86)",
    borderWidth: 3,
    borderColor: cfPalette.pinkHot,
    alignItems: "center",
    minWidth: 180,
  },
  divider: {
    width: "60%",
    height: 1,
    backgroundColor: cfPalette.pinkHot,
    marginVertical: 8,
    opacity: 0.6,
  },
});
