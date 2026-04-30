/**
 * Code-drawn "Journal" app icon.
 *
 * Pixel-noir notebook silhouette: stacked off-white "page" rectangles
 * peeking out behind a deep purple cover with a single horizontal
 * spine accent, drawn with `View`s on the same `PixelIconFrame` the
 * other parody-home tiles use so the journal reads as part of the
 * same icon set.
 *
 * No SVG / PNG asset — every layer is a `View`, so the icon scales
 * cleanly from the 56-pixel home tile up to whatever a future
 * gallery view might want.
 */
import { View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { PixelIconFrame } from "./PixelIconFrame";

interface Props {
  size: number;
}

export function JournalIcon({ size }: Props) {
  // Cover dimensions — slightly taller than wide for a notebook feel.
  const coverW = Math.round(size * 0.62);
  const coverH = Math.round(size * 0.7);
  const coverX = (size - coverW) / 2;
  const coverY = (size - coverH) / 2;

  // Three pages peek out below + to the right of the cover, so the
  // icon reads as a thick, well-thumbed case file rather than a
  // single sheet. Each page is offset by 1–2px, creating the
  // staggered stack silhouette.
  const pageOffset = Math.max(1, Math.round(size * 0.04));

  // Spine — thin vertical band on the cover's left edge.
  const spineW = Math.max(2, Math.round(size * 0.06));

  // Two horizontal lines on the cover stand in for ruled-page text
  // without committing to a literal grid.
  const lineH = Math.max(1, Math.round(size * 0.04));
  const lineW = Math.round(coverW * 0.55);
  const lineX = coverX + spineW + Math.round(coverW * 0.12);

  return (
    <PixelIconFrame size={size}>
      {/* Bottom-most page (lightest, furthest offset). */}
      <View
        style={{
          position: "absolute",
          width: coverW,
          height: coverH,
          backgroundColor: "#e8e3d3",
          top: coverY + pageOffset * 2,
          left: coverX + pageOffset * 2,
          borderRadius: Math.max(1, Math.round(size * 0.03)),
        }}
      />
      {/* Middle page. */}
      <View
        style={{
          position: "absolute",
          width: coverW,
          height: coverH,
          backgroundColor: "#f5f0df",
          top: coverY + pageOffset,
          left: coverX + pageOffset,
          borderRadius: Math.max(1, Math.round(size * 0.03)),
        }}
      />
      {/* Cover — purple-noir to tie back to journal title text. */}
      <View
        style={{
          position: "absolute",
          width: coverW,
          height: coverH,
          backgroundColor: cfPalette.purpleHot,
          top: coverY,
          left: coverX,
          borderRadius: Math.max(1, Math.round(size * 0.03)),
        }}
      />
      {/* Spine accent — slightly darker bar pinned to the cover's left edge. */}
      <View
        style={{
          position: "absolute",
          width: spineW,
          height: coverH,
          backgroundColor: cfPalette.purple,
          top: coverY,
          left: coverX,
        }}
      />
      {/* Two ruled-line accents on the cover. */}
      <View
        style={{
          position: "absolute",
          width: lineW,
          height: lineH,
          backgroundColor: cfPalette.bone,
          top: coverY + Math.round(coverH * 0.42),
          left: lineX,
          opacity: 0.85,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: lineW,
          height: lineH,
          backgroundColor: cfPalette.bone,
          top: coverY + Math.round(coverH * 0.58),
          left: lineX,
          opacity: 0.7,
        }}
      />
    </PixelIconFrame>
  );
}
