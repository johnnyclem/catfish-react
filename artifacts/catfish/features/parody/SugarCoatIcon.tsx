/**
 * Code-drawn "Sugar Coat" app icon.
 *
 * Chunky pixel-art heart, rendered cell-by-cell from a 7×6 bitmap of
 * `View`s. Stays on-brand with the Tinder-parody dating-clout vibe of
 * the app and lands the meta gag: a pixel heart instead of a polished
 * SVG. Uses the same View-only approach as `LotsOfFishIcon`.
 */
import { View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { PixelIconFrame } from "./PixelIconFrame";

interface Props {
  size: number;
}

// 7 columns × 6 rows. `1` = pixel on, `0` = pixel off.
const HEART_PATTERN = [
  "0110110",
  "1111111",
  "1111111",
  "0111110",
  "0011100",
  "0001000",
];

export function SugarCoatIcon({ size }: Props) {
  const cols = HEART_PATTERN[0].length;
  const rows = HEART_PATTERN.length;
  const cell = Math.max(1, Math.floor(size * 0.1));
  const totalW = cell * cols;
  const totalH = cell * rows;
  const startX = Math.round((size - totalW) / 2);
  const startY = Math.round((size - totalH) / 2);

  const cells: React.ReactNode[] = [];
  HEART_PATTERN.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== "1") continue;
      cells.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            width: cell,
            height: cell,
            backgroundColor: cfPalette.pinkHot,
            top: startY + r * cell,
            left: startX + c * cell,
          }}
        />,
      );
    }
  });

  return <PixelIconFrame size={size}>{cells}</PixelIconFrame>;
}
