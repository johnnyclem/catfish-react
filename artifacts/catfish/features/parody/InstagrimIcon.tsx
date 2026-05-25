/**
 * Code-drawn "Instagrim" social-feed icon.
 *
 * Pixel-noir take on the camera-with-viewfinder glyph: a rounded
 * gradient backplate (approximated by a single magenta fill since
 * gradients in the icon set are reserved for the home grid bg),
 * a square lens ring centered in the middle, and a small dot for the
 * top-right viewfinder. Reads as the Instagram parody at a glance.
 */
import { View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { PixelIconFrame } from "./PixelIconFrame";

interface Props {
  size: number;
}

export function InstagrimIcon({ size }: Props) {
  const stroke = Math.max(2, Math.round(size * 0.07));
  const plateInset = Math.round(size * 0.14);
  const plateSize = size - plateInset * 2;
  const lensSize = Math.round(size * 0.42);
  const lensInner = Math.round(size * 0.22);
  const dotSize = Math.max(2, Math.round(size * 0.08));

  return (
    <PixelIconFrame size={size}>
      {/* Magenta camera body backplate. */}
      <View
        style={{
          position: "absolute",
          top: plateInset,
          left: plateInset,
          width: plateSize,
          height: plateSize,
          backgroundColor: "#d62976",
          borderRadius: Math.round(size * 0.14),
          borderWidth: stroke,
          borderColor: cfPalette.bone,
        }}
      />
      {/* Outer lens ring. */}
      <View
        style={{
          position: "absolute",
          top: (size - lensSize) / 2,
          left: (size - lensSize) / 2,
          width: lensSize,
          height: lensSize,
          borderRadius: lensSize / 2,
          borderWidth: stroke,
          borderColor: cfPalette.bone,
        }}
      />
      {/* Inner lens fill. */}
      <View
        style={{
          position: "absolute",
          top: (size - lensInner) / 2,
          left: (size - lensInner) / 2,
          width: lensInner,
          height: lensInner,
          borderRadius: lensInner / 2,
          backgroundColor: "#0a0a0f",
        }}
      />
      {/* Viewfinder dot (top right). */}
      <View
        style={{
          position: "absolute",
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          top: plateInset + stroke + 2,
          right: plateInset + stroke + 2,
          backgroundColor: cfPalette.bone,
        }}
      />
    </PixelIconFrame>
  );
}
