/**
 * Shared visual frame for the parody home-screen icons.
 *
 * Mirrors the dark `#0a0a0f` background, faint pink CRT scanlines and
 * `pinkHot` border that `LotsOfFishIcon` uses, so every parody app
 * tile reads as part of the same noir-pixel set without each icon
 * duplicating the same ~30 lines of frame setup.
 *
 * Each per-app icon (Word-Low, Safe Spot, Ego Trip, Sugar Coat)
 * supplies its own pixel-art motif as children; this component just
 * handles the framing so the motif sits on the same canvas as the
 * fish silhouette inside `LotsOfFishIcon`.
 */
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { cfPalette } from "@/constants/colors";

interface Props {
  size: number;
  children: ReactNode;
}

export function PixelIconFrame({ size, children }: Props) {
  const radius = Math.max(4, Math.round(size * 0.13));
  const lineCount = 8;
  const lineGap = (size - 2) / (lineCount + 1);
  const lineThickness = Math.max(1, Math.round(size * 0.012));

  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push(
      <View
        key={i}
        style={{
          position: "absolute",
          top: lineGap * (i + 1),
          left: 0,
          right: 0,
          height: lineThickness,
          backgroundColor: cfPalette.pinkHot,
          opacity: 0.45,
        }}
      />,
    );
  }

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: Math.max(1, Math.round(size * 0.02)),
        },
      ]}
    >
      {lines}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: "#0a0a0f",
    borderColor: "rgba(255, 47, 143, 0.5)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
