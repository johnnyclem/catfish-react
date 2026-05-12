/**
 * iOS-style red notification badge for the parody phone home grid.
 *
 * Renders a pill-shaped red circle with a white pixel numeral pinned
 * to the upper-right corner of an app tile. Caps the visible label at
 * "9+" so a long-running game session doesn't blow the badge out
 * wider than its tile, and animates a brief scale-pulse whenever the
 * displayed count strictly increases — same easing curve the previous
 * root tab-bar pip used so a freshly-bumped badge "pops" exactly the
 * way players already learned.
 *
 * The badge mounts only when `count > 0`. We render nothing (and skip
 * the animation) when there's nothing to surface so a closed run or
 * an opened-then-cleared journal doesn't leave a stale 0-badge sitting
 * on the tile.
 */
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

interface Props {
  /** Numeric value to display. ≤0 hides the badge entirely. */
  count: number;
  /**
   * Accessibility hint announced to screen readers when the badge is
   * present. Caller knows the semantics ("3 unread messages",
   * "5 new facts") better than the badge does.
   */
  accessibilityLabel?: string;
}

export function AppNotificationBadge({ count, accessibilityLabel }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(count);

  useEffect(() => {
    const previous = prevCount.current;
    prevCount.current = count;
    // Pulse only on a real strict increase so re-renders that keep
    // the same value don't replay the bounce. Going from 0 → 1 (the
    // first new notification) and from 3 → 4 (a follow-up) both
    // trigger the same satisfying scale curve.
    if (count <= previous) return;
    if (count <= 0) return;

    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.45,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 6,
        stiffness: 140,
      }),
    ]).start();
  }, [count, scale]);

  if (count <= 0) return null;

  const label = count > 9 ? "9+" : String(count);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLabel={accessibilityLabel}
      style={[styles.badge, { transform: [{ scale }] }]}
    >
      <Text style={styles.text} >
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    // Sit nudged outside the tile's upper-right corner so the badge
    // reads as overlaying the icon rather than clipping into it.
    top: -6,
    right: -8,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    // iOS-y pink-red. We pick a hex value rather than reading from
    // `cfPalette` so the badge stays loud against any tile colour
    // (some tiles already use `pinkHot` as their foreground).
    backgroundColor: "#ff3b30",
    alignItems: "center",
    justifyContent: "center",
    // Subtle white ring keeps the badge legible even when it overlays
    // a same-coloured tile foreground.
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },
  text: {
    color: "white",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.2,
    lineHeight: 12,
    includeFontPadding: false,
  },
});
