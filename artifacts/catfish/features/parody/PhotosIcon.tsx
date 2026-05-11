/**
 * Code-drawn "Photos" app icon.
 *
 * Pixel-noir camera/square-grid motif: a stylized camera body with
 * a square film-window in the center, drawn with View primitives on
 * PixelIconFrame so it reads as part of the same icon set as the other
 * parody home tiles.
 */
import { View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { PixelIconFrame } from "./PixelIconFrame";

interface Props {
  size: number;
}

export function PhotosIcon({ size }: Props) {
  const bodyW = Math.round(size * 0.72);
  const bodyH = Math.round(size * 0.52);
  const bodyX = (size - bodyW) / 2;
  const bodyY = (size - bodyH) / 2 + Math.round(size * 0.06);

  const lensR = Math.round(size * 0.18);
  const lensX = size / 2 - lensR;
  const lensY = bodyY + Math.round(bodyH * 0.28);

  const frameInset = Math.max(2, Math.round(size * 0.06));
  const flashY = bodyY + Math.round(size * 0.04);
  const flashW = Math.round(size * 0.12);
  const flashH = Math.max(2, Math.round(size * 0.06));

  const viewfinderW = Math.round(size * 0.14);
  const viewfinderH = Math.max(2, Math.round(size * 0.05));
  const viewfinderX = size / 2 - viewfinderW / 2;
  const viewfinderY = bodyY - Math.round(size * 0.02);

  return (
    <PixelIconFrame size={size}>
      {/* Camera body — dark panel. */}
      <View
        style={{
          position: "absolute",
          width: bodyW,
          height: bodyH,
          backgroundColor: cfPalette.iron,
          borderRadius: Math.max(2, Math.round(size * 0.06)),
          top: bodyY,
          left: bodyX,
        }}
      />
      {/* Top bump / viewfinder housing. */}
      <View
        style={{
          position: "absolute",
          width: viewfinderW,
          height: viewfinderH + Math.round(size * 0.06),
          backgroundColor: cfPalette.iron,
          borderTopLeftRadius: Math.max(1, Math.round(size * 0.025)),
          borderTopRightRadius: Math.max(1, Math.round(size * 0.025)),
          top: viewfinderY,
          left: viewfinderX,
        }}
      />
      {/* Lens ring — outer. */}
      <View
        style={{
          position: "absolute",
          width: lensR * 2,
          height: lensR * 2,
          borderRadius: lensR,
          borderWidth: Math.max(2, Math.round(size * 0.05)),
          borderColor: cfPalette.ash,
          top: lensY,
          left: lensX,
        }}
      />
      {/* Lens glass — inner circle. */}
      <View
        style={{
          position: "absolute",
          width: lensR * 2 - Math.max(4, Math.round(size * 0.1)),
          height: lensR * 2 - Math.max(4, Math.round(size * 0.1)),
          borderRadius: lensR,
          backgroundColor: cfPalette.navyHi,
          top: lensY + Math.max(2, Math.round(size * 0.05)),
          left: lensX + Math.max(2, Math.round(size * 0.05)),
        }}
      />
      {/* Lens glint. */}
      <View
        style={{
          position: "absolute",
          width: Math.max(2, Math.round(size * 0.07)),
          height: Math.max(2, Math.round(size * 0.07)),
          borderRadius: Math.max(1, Math.round(size * 0.035)),
          backgroundColor: cfPalette.cyan,
          top: lensY + Math.round(lensR * 0.35),
          left: lensX + Math.round(lensR * 1.25),
          opacity: 0.7,
        }}
      />
      {/* Flash cell. */}
      <View
        style={{
          position: "absolute",
          width: flashW,
          height: flashH,
          backgroundColor: cfPalette.fog,
          top: flashY,
          right: bodyX + Math.round(size * 0.08),
          borderRadius: Math.max(1, Math.round(size * 0.02)),
        }}
      />
    </PixelIconFrame>
  );
}