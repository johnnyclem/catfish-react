/**
 * Code-drawn "FaceTime" app icon.
 *
 * Pixel-noir video-camera motif: a rounded rectangle (the camera body)
 * with a circular lens on the front and a small triangular stand, drawn
 * with View primitives on PixelIconFrame so it reads as part of the
 * same icon set as the other parody home tiles.
 */
import { View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { PixelIconFrame } from "./PixelIconFrame";

interface Props {
  size: number;
}

export function FaceTimeIcon({ size }: Props) {
  const bodyW = Math.round(size * 0.64);
  const bodyH = Math.round(size * 0.4);
  const bodyX = (size - bodyW) / 2;
  const bodyY = Math.round(size * 0.22);

  const lensR = Math.round(size * 0.13);
  const lensX = bodyX + Math.round(bodyW * 0.5) - lensR;
  const lensY = bodyY + Math.round(bodyH * 0.5) - lensR;

  const standW = Math.round(size * 0.2);
  const standH = Math.max(2, Math.round(size * 0.1));
  const standX = size / 2 - standW / 2;
  const standY = bodyY + bodyH;

  return (
    <PixelIconFrame size={size}>
      {/* Body — rounded rectangle. */}
      <View
        style={{
          position: "absolute",
          width: bodyW,
          height: bodyH,
          backgroundColor: cfPalette.iron,
          borderRadius: Math.max(2, Math.round(size * 0.08)),
          top: bodyY,
          left: bodyX,
        }}
      />
      {/* Lens — outer dark ring. */}
      <View
        style={{
          position: "absolute",
          width: lensR * 2,
          height: lensR * 2,
          borderRadius: lensR,
          backgroundColor: cfPalette.void,
          top: lensY,
          left: lensX,
        }}
      />
      {/* Lens — inner blue glass. */}
      <View
        style={{
          position: "absolute",
          width: Math.round(lensR * 1.3),
          height: Math.round(lensR * 1.3),
          borderRadius: Math.round(lensR * 0.65),
          backgroundColor: cfPalette.cyan,
          top: lensY + Math.round(lensR * 0.35),
          left: lensX + Math.round(lensR * 0.35),
          opacity: 0.6,
        }}
      />
      {/* Lens glint. */}
      <View
        style={{
          position: "absolute",
          width: Math.max(2, Math.round(size * 0.04)),
          height: Math.max(2, Math.round(size * 0.04)),
          borderRadius: 1,
          backgroundColor: cfPalette.bone,
          top: lensY + Math.round(lensR * 0.25),
          left: lensX + Math.round(lensR * 0.55),
          opacity: 0.8,
        }}
      />
      {/* Stand — small triangle underneath. */}
      <View
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          borderLeftWidth: standW / 2,
          borderRightWidth: standW / 2,
          borderBottomWidth: standH,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: cfPalette.iron,
          top: standY,
          left: standX,
        }}
      />
    </PixelIconFrame>
  );
}