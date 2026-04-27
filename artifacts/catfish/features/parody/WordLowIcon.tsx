/**
 * Code-drawn "Word-Low" app icon.
 *
 * Three chunky letter tiles — green/yellow/grey — referencing the
 * Wordle row that the parody is poking fun at. Built from stacked
 * `View`s so it scales cleanly at every render size, no asset load.
 */
import { View } from "react-native";

import { cfPalette } from "@/constants/colors";

import { PixelIconFrame } from "./PixelIconFrame";

interface Props {
  size: number;
}

export function WordLowIcon({ size }: Props) {
  const tileSize = Math.round(size * 0.22);
  const gap = Math.max(1, Math.round(size * 0.04));
  const totalW = tileSize * 3 + gap * 2;
  const startX = (size - totalW) / 2;
  const startY = (size - tileSize) / 2;
  const tileRadius = Math.max(1, Math.round(tileSize * 0.12));

  // Wordle-row palette: hit / partial / miss.
  const tileColors = [cfPalette.ok, cfPalette.warn, cfPalette.iron];

  return (
    <PixelIconFrame size={size}>
      {tileColors.map((c, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: tileSize,
            height: tileSize,
            backgroundColor: c,
            top: startY,
            left: startX + i * (tileSize + gap),
            borderRadius: tileRadius,
          }}
        />
      ))}
    </PixelIconFrame>
  );
}
