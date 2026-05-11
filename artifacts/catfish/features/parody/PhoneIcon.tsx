/**
 * Code-drawn "Phone" app icon.
 *
 * Pixel-noir handset motif: a stylized old-school telephone handset
 * centered on the icon, drawn with View primitives on PixelIconFrame
 * so it reads as part of the same icon set as the other parody home tiles.
 */
import { View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { PixelIconFrame } from "./PixelIconFrame";

interface Props {
  size: number;
}

export function PhoneIcon({ size }: Props) {
  const bodyH = Math.round(size * 0.26);
  const bodyW = Math.round(size * 0.6);
  const bodyX = (size - bodyW) / 2;
  const bodyY = (size - bodyH) / 2 + Math.round(size * 0.04);

  const earpieceH = Math.round(size * 0.18);
  const earpieceW = Math.round(size * 0.22);
  const earpieceX = bodyX + Math.round(bodyW * 0.12);
  const earpieceY = bodyY - Math.round(size * 0.08);

  const mouthpieceH = Math.round(size * 0.14);
  const mouthpieceW = Math.round(size * 0.26);
  const mouthpieceX = bodyX + Math.round(bodyW * 0.36);
  const mouthpieceY = bodyY + bodyH - Math.round(size * 0.06);

  const cordW = Math.max(2, Math.round(size * 0.04));
  const cordX = bodyX + Math.round(bodyW * 0.08);
  const cordTopY = bodyY + bodyH;
  const cordBottomY = Math.round(size * 0.82);

  return (
    <PixelIconFrame size={size}>
      {/* Cord — wavy vertical line from mouthpiece area down. */}
      <View
        style={{
          position: "absolute",
          width: cordW,
          backgroundColor: cfPalette.ash,
          top: cordTopY,
          left: cordX,
          height: cordBottomY - cordTopY,
          borderRadius: cordW / 2,
        }}
      />
      {/* Handset body — horizontal bar. */}
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
      {/* Earpiece — raised bump at the left end. */}
      <View
        style={{
          position: "absolute",
          width: earpieceW,
          height: earpieceH,
          backgroundColor: cfPalette.iron,
          borderRadius: Math.max(2, Math.round(size * 0.06)),
          top: earpieceY,
          left: earpieceX,
        }}
      />
      {/* Mouthpiece — raised bump at the right end. */}
      <View
        style={{
          position: "absolute",
          width: mouthpieceW,
          height: mouthpieceH,
          backgroundColor: cfPalette.iron,
          borderRadius: Math.max(2, Math.round(size * 0.05)),
          top: mouthpieceY,
          left: mouthpieceX,
        }}
      />
      {/* Earpiece speaker dots. */}
      {[0, 1].map((i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: Math.max(2, Math.round(size * 0.04)),
            height: Math.max(2, Math.round(size * 0.04)),
            borderRadius: Math.max(1, Math.round(size * 0.02)),
            backgroundColor: cfPalette.navyHi,
            top: earpieceY + Math.round(earpieceH * 0.3) + i * Math.round(earpieceH * 0.3),
            left: earpieceX + Math.round(earpieceW * 0.25),
          }}
        />
      ))}
      {/* Mouthpiece grill dots. */}
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: Math.max(2, Math.round(size * 0.05)),
            height: Math.max(1, Math.round(size * 0.03)),
            borderRadius: 1,
            backgroundColor: cfPalette.navyHi,
            top: mouthpieceY + Math.round(mouthpieceH * 0.3),
            left: mouthpieceX + Math.round(mouthpieceW * 0.2) + i * Math.round(mouthpieceW * 0.25),
          }}
        />
      ))}
    </PixelIconFrame>
  );
}