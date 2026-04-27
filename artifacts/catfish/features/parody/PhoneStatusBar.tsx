/**
 * Code-drawn iOS-style status bar for the parody phone home screen.
 *
 * Lives inside the Apps tab and renders along the very top of the
 * playable area (below the safe-area inset). All chrome is drawn
 * with `View`s + `Feather` icons — no PNG assets — so the bar
 * stays sharp at any density and ships zero new bytes.
 *
 * Updates the displayed time once a minute. We pick a very long
 * interval (60s) on purpose: more frequent ticks would re-render
 * the entire phone chrome whenever a player is mid-game, which
 * would yank focus from `requestAnimationFrame`-driven games like
 * Ego Trip and Safe Spot.
 */
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { cfPalette } from "@/constants/colors";

function formatClock(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const mm = m < 10 ? `0${m}` : String(m);
  return `${hh}:${mm}`;
}

export function PhoneStatusBar() {
  const [now, setNow] = useState<string>(() => formatClock());

  useEffect(() => {
    // Coarse 60s ticker keeps the in-game render budget intact.
    const id = setInterval(() => setNow(formatClock()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.row} pointerEvents="none">
      <Text style={styles.time}>{now}</Text>
      <View style={styles.icons}>
        <Feather name="bar-chart-2" size={11} color={cfPalette.bone} />
        <Feather name="wifi" size={11} color={cfPalette.bone} />
        <Feather name="battery" size={13} color={cfPalette.bone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 28,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  time: {
    color: cfPalette.bone,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    opacity: 0.9,
  },
  icons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    opacity: 0.85,
  },
});
