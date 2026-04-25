/**
 * SwipeCard — the visual card on the swipe deck.
 *
 * Translated from the SwiftUI CardView in the source doc. Uses
 * react-native-gesture-handler + reanimated for the drag interaction.
 * Threshold for commit: 110pt (matches source). Right = match,
 * left = pass. The parent (`SwipeView`) handles deck advancement.
 */

import { useCallback, useImperativeHandle, useRef, forwardRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { AssetImage } from "@/components/AssetImage";
import { PixelPanel, PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { Candidate } from "@/core/models";

const SCREEN_W = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 110;
const FLICK_VELOCITY = 600;

interface SwipeCardProps {
  candidate: Candidate;
  isTop: boolean;
  stackIndex: number;
  onCommit: (direction: "left" | "right") => void;
}

export interface SwipeCardHandle {
  commit: (direction: "left" | "right") => void;
}

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { candidate, isTop, stackIndex, onCommit },
  ref,
) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // Idempotency guard — once a card commits (via gesture, flick, or button)
  // it must never commit again. Prevents stale-state duplicates that would
  // double-advance the deck cursor and corrupt run state.
  const hasCommittedRef = useRef(false);
  const isAnimatingRef = useRef(false);

  const finishCommit = useCallback(
    (direction: "left" | "right") => {
      if (hasCommittedRef.current) return;
      hasCommittedRef.current = true;
      onCommit(direction);
    },
    [onCommit],
  );

  const flyOff = useCallback(
    (direction: "left" | "right") => {
      if (hasCommittedRef.current || isAnimatingRef.current) return;
      isAnimatingRef.current = true;
      const target = direction === "right" ? SCREEN_W * 1.4 : -SCREEN_W * 1.4;
      tx.value = withTiming(target, { duration: 240 }, () => {
        runOnJS(finishCommit)(direction);
      });
    },
    [finishCommit, tx],
  );

  useImperativeHandle(ref, () => ({
    commit: (direction) => flyOff(direction),
  }));

  const pan = Gesture.Pan()
    .enabled(isTop)
    .onChange((e) => {
      if (hasCommittedRef.current || isAnimatingRef.current) return;
      tx.value = e.translationX;
      ty.value = e.translationY * 0.4;
    })
    .onEnd((e) => {
      if (hasCommittedRef.current || isAnimatingRef.current) return;
      const past = Math.abs(tx.value) > SWIPE_THRESHOLD;
      const flick = Math.abs(e.velocityX) > FLICK_VELOCITY;
      if (past || flick) {
        const dir = tx.value > 0 ? "right" : "left";
        isAnimatingRef.current = true;
        const target = dir === "right" ? SCREEN_W * 1.4 : -SCREEN_W * 1.4;
        tx.value = withTiming(target, { duration: 220 }, () => {
          runOnJS(finishCommit)(dir);
        });
      } else {
        tx.value = withSpring(0, { damping: 14 });
        ty.value = withSpring(0, { damping: 14 });
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      tx.value,
      [-SCREEN_W, 0, SCREEN_W],
      [-12, 0, 12],
      Extrapolation.CLAMP,
    );
    const stackOffset = isTop ? 0 : stackIndex * 8;
    const stackScale = isTop ? 1 : 1 - stackIndex * 0.04;
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value + stackOffset },
        { rotate: `${rotate}deg` },
        { scale: stackScale },
      ],
      zIndex: 100 - stackIndex,
    };
  });

  const passBadge = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-SWIPE_THRESHOLD, -20, 0], [1, 0.2, 0], Extrapolation.CLAMP),
    transform: [{ rotate: "-12deg" }],
  }));
  const matchBadge = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, 20, SWIPE_THRESHOLD], [0, 0.2, 1], Extrapolation.CLAMP),
    transform: [{ rotate: "12deg" }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, cardStyle]}>
        <PixelPanel variant="raised" style={styles.panel}>
          <View style={styles.portraitWrap}>
            <AssetImage
              id={candidate.portraitAssetId ?? "A500_avatar_placeholder"}
              style={styles.portrait}
              containerStyle={styles.portrait}
              resizeMode="cover"
            />
            <Animated.View style={[styles.badge, styles.passBadge, passBadge]}>
              <PixelText size={14} color={cfPalette.cyan} uppercase glow>
                pass
              </PixelText>
            </Animated.View>
            <Animated.View style={[styles.badge, styles.matchBadge, matchBadge]}>
              <PixelText size={14} color={cfPalette.pinkHot} uppercase glow>
                match
              </PixelText>
            </Animated.View>
          </View>

          <View style={styles.body}>
            <View style={styles.nameRow}>
              <PixelText size={14} color={cfPalette.bone} uppercase>
                {candidate.displayName}
              </PixelText>
              <PixelText size={10} color={cfPalette.ash}>
                {`  ${candidate.age}`}
              </PixelText>
            </View>
            <PixelText size={8} color={cfPalette.cyan} style={{ marginTop: 6 }}>
              {candidate.tagline}
            </PixelText>

            <View style={styles.divider} />

            <PixelText size={8} color={cfPalette.bone} style={{ lineHeight: 14 }}>
              {candidate.bio}
            </PixelText>

            {candidate.prompts.slice(0, 2).map((p, i) => (
              <View key={i} style={styles.promptRow}>
                <PixelText size={7} color={cfPalette.purpleHot}>
                  ▸{" "}
                </PixelText>
                <PixelText size={7} color={cfPalette.ash} style={{ flex: 1, lineHeight: 12 }}>
                  {p}
                </PixelText>
              </View>
            ))}
          </View>
        </PixelPanel>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  panel: {
    flex: 1,
    overflow: "hidden",
  },
  portraitWrap: {
    height: 240,
    backgroundColor: cfPalette.iron,
    borderBottomWidth: 2,
    borderBottomColor: cfPalette.purple,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  portrait: {
    width: "100%",
    height: "100%",
  },
  body: {
    padding: 14,
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  divider: {
    height: 2,
    backgroundColor: cfPalette.purple,
    marginVertical: 10,
  },
  promptRow: {
    flexDirection: "row",
    marginTop: 6,
    paddingRight: 8,
  },
  badge: {
    position: "absolute",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
  },
  passBadge: {
    top: 16,
    right: 16,
    borderColor: cfPalette.cyan,
    backgroundColor: "rgba(3,1,10,0.7)",
  },
  matchBadge: {
    top: 16,
    left: 16,
    borderColor: cfPalette.pinkHot,
    backgroundColor: "rgba(3,1,10,0.7)",
  },
});
