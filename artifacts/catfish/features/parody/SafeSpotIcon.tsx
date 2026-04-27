/**
 * Code-drawn "Safe Spot" app icon.
 *
 * Chunky cyan map-pin silhouette: rounded square head + downward
 * triangular point (a square rotated 45°), with a small dark hole at
 * the head's centre. Plays off the Citizen-style "where am I safe"
 * vibe of the parody app, in the same View-only style as the
 * `LotsOfFishIcon` fish silhouette.
 */
import { View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { PixelIconFrame } from "./PixelIconFrame";

interface Props {
  size: number;
}

export function SafeSpotIcon({ size }: Props) {
  const headSize = Math.round(size * 0.46);
  const pointSize = Math.round(size * 0.26);
  const dotSize = Math.round(size * 0.16);

  const totalH = headSize + pointSize * 0.5;
  const startY = (size - totalH) / 2;

  return (
    <PixelIconFrame size={size}>
      {/* Triangular point — square rotated 45°, layered behind the head */}
      <View
        style={{
          position: "absolute",
          width: pointSize,
          height: pointSize,
          backgroundColor: cfPalette.cyan,
          top: startY + headSize - pointSize * 0.5,
          left: (size - pointSize) / 2,
          transform: [{ rotate: "45deg" }],
        }}
      />
      {/* Pin head — rounded cyan square */}
      <View
        style={{
          position: "absolute",
          width: headSize,
          height: headSize,
          backgroundColor: cfPalette.cyan,
          borderRadius: headSize / 2,
          top: startY,
          left: (size - headSize) / 2,
        }}
      />
      {/* Hole in the centre of the head — dark dot */}
      <View
        style={{
          position: "absolute",
          width: dotSize,
          height: dotSize,
          backgroundColor: cfPalette.void,
          borderRadius: dotSize / 2,
          top: startY + (headSize - dotSize) / 2,
          left: (size - dotSize) / 2,
        }}
      />
    </PixelIconFrame>
  );
}
