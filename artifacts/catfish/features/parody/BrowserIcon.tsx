/**
 * Code-drawn "Browser" app icon.
 *
 * Pixel-noir compass/globe motif: concentric rings suggesting a globe
 * with a horizontal "search bar" underneath, drawn with View primitives
 * on PixelIconFrame so it reads as part of the same icon set as the
 * other parody home tiles.
 */
import { View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { PixelIconFrame } from "./PixelIconFrame";

interface Props {
  size: number;
}

export function BrowserIcon({ size }: Props) {
  const cx = size / 2;
  const cy = size * 0.38;

  const outerR = Math.round(size * 0.28);
  const innerR = Math.round(size * 0.18);
  const dotR = Math.max(1, Math.round(size * 0.05));

  return (
    <PixelIconFrame size={size}>
      {/* Outer ring — the globe outline. */}
      <View
        style={{
          position: "absolute",
          width: outerR * 2,
          height: outerR * 2,
          borderRadius: outerR,
          borderWidth: Math.max(1, Math.round(size * 0.04)),
          borderColor: cfPalette.iron,
          top: cy - outerR,
          left: cx - outerR,
        }}
      />
      {/* Horizontal equator line through the globe. */}
      <View
        style={{
          position: "absolute",
          width: outerR * 2,
          height: Math.max(1, Math.round(size * 0.04)),
          backgroundColor: cfPalette.iron,
          top: cy - Math.round(size * 0.02),
          left: cx - outerR,
        }}
      />
      {/* Vertical meridian arc — simple approximation with a tall thin rect clipped. */}
      <View
        style={{
          position: "absolute",
          width: Math.max(1, Math.round(size * 0.04)),
          height: outerR * 2,
          backgroundColor: cfPalette.iron,
          top: cy - outerR,
          left: cx - Math.round(size * 0.02),
        }}
      />
      {/* Center dot. */}
      <View
        style={{
          position: "absolute",
          width: dotR * 2,
          height: dotR * 2,
          borderRadius: dotR,
          backgroundColor: cfPalette.cyan,
          top: cy - dotR,
          left: cx - dotR,
        }}
      />
      {/* Search bar underneath — a narrow pill shape. */}
      <View
        style={{
          position: "absolute",
          width: Math.round(size * 0.7),
          height: Math.round(size * 0.1),
          borderRadius: Math.round(size * 0.05),
          backgroundColor: cfPalette.iron,
          top: size * 0.78,
          left: (size - size * 0.7) / 2,
        }}
      />
      {/* Magnifying glass dot inside the bar. */}
      <View
        style={{
          position: "absolute",
          width: Math.max(2, Math.round(size * 0.04)),
          height: Math.max(2, Math.round(size * 0.04)),
          borderRadius: Math.round(size * 0.02),
          backgroundColor: cfPalette.fog,
          top: size * 0.78 + Math.round(size * 0.03),
          left: (size - size * 0.7) / 2 + Math.round(size * 0.05),
        }}
      />
    </PixelIconFrame>
  );
}