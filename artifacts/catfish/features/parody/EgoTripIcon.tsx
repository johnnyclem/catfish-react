/**
 * Code-drawn "Ego Trip" app icon.
 *
 * Three ascending pixel bars (short → medium → tall) topped with a
 * small upward arrow head — a chunky stand-in for the "trending up"
 * Feather glyph that used to live here. Captures the parody app's
 * clout-chasing vibe in the same View-only style as the fish icon.
 */
import { View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { PixelIconFrame } from "./PixelIconFrame";

interface Props {
  size: number;
}

export function EgoTripIcon({ size }: Props) {
  const barW = Math.round(size * 0.16);
  const gap = Math.max(1, Math.round(size * 0.06));
  const totalW = barW * 3 + gap * 2;
  const startX = (size - totalW) / 2;
  const baseY = size - Math.round(size * 0.22);

  // Bar heights step up so the silhouette reads as growth.
  const heights = [
    Math.round(size * 0.22),
    Math.round(size * 0.36),
    Math.round(size * 0.5),
  ];

  // Arrow head sits just above the tallest bar.
  const arrowSize = Math.round(size * 0.18);
  const tallestX = startX + 2 * (barW + gap) + barW / 2;
  const tallestTop = baseY - heights[2];

  return (
    <PixelIconFrame size={size}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: barW,
            height: h,
            backgroundColor: cfPalette.pinkHot,
            borderRadius: Math.max(1, Math.round(barW * 0.15)),
            top: baseY - h,
            left: startX + i * (barW + gap),
          }}
        />
      ))}
      {/* Arrow head — square rotated 45° above the tallest bar */}
      <View
        style={{
          position: "absolute",
          width: arrowSize,
          height: arrowSize,
          backgroundColor: cfPalette.pink,
          top: tallestTop - arrowSize * 0.7,
          left: tallestX - arrowSize / 2,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </PixelIconFrame>
  );
}
