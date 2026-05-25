/**
 * Code-drawn "LinkedOut" professional-network icon.
 *
 * Pixel-noir "in" mark: a small square dot above a taller bar
 * (the iconic lowercase 'i') plus a small 'n' shape rendered as
 * a stem + arch. Tinted in the blue/cyan corporate-network palette
 * so it reads instantly as the LinkedIn parody.
 */
import { View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { PixelIconFrame } from "./PixelIconFrame";

interface Props {
  size: number;
}

export function LinkedOutIcon({ size }: Props) {
  const blue = "#0a66c2";
  const stroke = Math.max(2, Math.round(size * 0.09));
  const baseY = Math.round(size * 0.7);
  const stemH = Math.round(size * 0.34);

  // "i" components
  const iX = Math.round(size * 0.26);
  const dotY = Math.round(size * 0.28);
  const dotSize = stroke + 1;

  // "n" components
  const nX = Math.round(size * 0.5);
  const nW = Math.round(size * 0.28);

  return (
    <PixelIconFrame size={size}>
      {/* Solid backplate so the marks read on the dark frame. */}
      <View
        style={{
          position: "absolute",
          top: Math.round(size * 0.18),
          left: Math.round(size * 0.14),
          width: Math.round(size * 0.72),
          height: Math.round(size * 0.64),
          backgroundColor: blue,
          borderRadius: Math.round(size * 0.08),
        }}
      />
      {/* i dot */}
      <View
        style={{
          position: "absolute",
          width: dotSize,
          height: dotSize,
          top: dotY,
          left: iX,
          backgroundColor: cfPalette.bone,
        }}
      />
      {/* i stem */}
      <View
        style={{
          position: "absolute",
          width: stroke,
          height: stemH,
          top: baseY - stemH,
          left: iX,
          backgroundColor: cfPalette.bone,
        }}
      />
      {/* n left stem */}
      <View
        style={{
          position: "absolute",
          width: stroke,
          height: stemH,
          top: baseY - stemH,
          left: nX,
          backgroundColor: cfPalette.bone,
        }}
      />
      {/* n arch top */}
      <View
        style={{
          position: "absolute",
          width: nW,
          height: stroke,
          top: baseY - stemH,
          left: nX,
          backgroundColor: cfPalette.bone,
        }}
      />
      {/* n right stem */}
      <View
        style={{
          position: "absolute",
          width: stroke,
          height: stemH - stroke,
          top: baseY - stemH + stroke,
          left: nX + nW - stroke,
          backgroundColor: cfPalette.bone,
        }}
      />
    </PixelIconFrame>
  );
}
