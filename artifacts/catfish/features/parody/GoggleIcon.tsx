/**
 * Code-drawn "Goggle" search-app icon.
 *
 * Pixel-noir take on a search-engine glyph: a chunky pixel "G"
 * sitting on the parody frame so it matches the rest of the home-grid
 * icon set. The G is rendered as three rectangular strokes (outer ring
 * approximation + inner crossbar) so it stays legible at the small
 * tile sizes used in the grid and dock.
 */
import { View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { PixelIconFrame } from "./PixelIconFrame";

interface Props {
  size: number;
}

export function GoggleIcon({ size }: Props) {
  const stroke = Math.max(2, Math.round(size * 0.09));
  const cx = size / 2;
  const cy = size / 2;
  const radius = Math.round(size * 0.3);

  return (
    <PixelIconFrame size={size}>
      {/* Outer ring of the G — square so it reads pixel-y. */}
      <View
        style={{
          position: "absolute",
          width: radius * 2,
          height: radius * 2,
          top: cy - radius,
          left: cx - radius,
          borderWidth: stroke,
          borderColor: cfPalette.cyan,
        }}
      />
      {/* Cut a slot out of the right side so the ring reads as a "G". */}
      <View
        style={{
          position: "absolute",
          width: radius,
          height: stroke + 2,
          backgroundColor: "#0a0a0f",
          top: cy - Math.round(stroke / 2) - 1,
          left: cx,
        }}
      />
      {/* Inner crossbar — the G's spur. */}
      <View
        style={{
          position: "absolute",
          width: Math.round(radius * 0.9),
          height: stroke,
          backgroundColor: cfPalette.pinkHot,
          top: cy + Math.round(stroke * 0.2),
          left: cx,
        }}
      />
    </PixelIconFrame>
  );
}
