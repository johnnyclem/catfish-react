/**
 * Code-drawn "Lots 'o Fish" app icon.
 *
 * Reproduces the user's draft `LotsOfFishIcon` (pink scanlines + chunky
 * blue fish silhouette with X-ed eyes + faint CRT scanlines) using
 * stacked `View`s instead of an SVG/PNG so it scales cleanly from
 * 28×28 (game-center list) up to 192×192 (splash) without ever
 * loading an asset.
 *
 * The fish is drawn as a triangular tail + a body oval + two
 * mouth/eye crosses. It's intentionally chunky and pixel-y — close
 * enough to the draft for the meta gag to land, simple enough to
 * stay legible at small sizes.
 */
import { StyleSheet, View } from "react-native";

import { cfPalette } from "@/constants/colors";

interface Props {
  size: number;
}

export function LotsOfFishIcon({ size }: Props) {
  // Derive sub-element dimensions from the outer size so the icon
  // stays self-similar at every render scale.
  const radius = Math.max(4, Math.round(size * 0.13));
  const lineCount = 8;
  const lineGap = (size - 2) / (lineCount + 1);
  const fishW = Math.round(size * 0.62);
  const fishH = Math.round(size * 0.34);
  const eyeSize = Math.max(2, Math.round(size * 0.06));

  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push(
      <View
        key={i}
        style={{
          position: "absolute",
          top: lineGap * (i + 1),
          left: 0,
          right: 0,
          height: Math.max(1, Math.round(size * 0.012)),
          backgroundColor: cfPalette.pinkHot,
          opacity: 0.45,
        }}
      />,
    );
  }

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: Math.max(1, Math.round(size * 0.02)),
        },
      ]}
    >
      {lines}
      {/* Fish body — squashed oval */}
      <View
        style={{
          position: "absolute",
          width: fishW,
          height: fishH,
          backgroundColor: "#3b82f6",
          borderRadius: fishH / 2,
          top: (size - fishH) / 2,
          left: (size - fishW) / 2,
        }}
      />
      {/* Tail — small square offset to the right */}
      <View
        style={{
          position: "absolute",
          width: Math.round(fishH * 0.7),
          height: Math.round(fishH * 0.7),
          backgroundColor: "#2563eb",
          top: (size - fishH * 0.7) / 2,
          right: (size - fishW) / 2 - Math.round(fishH * 0.35),
          transform: [{ rotate: "45deg" }],
        }}
      />
      {/* Two X-ed eyes — render as overlapping bars */}
      <Eye
        size={eyeSize}
        top={(size - fishH) / 2 + Math.round(fishH * 0.25)}
        left={(size - fishW) / 2 + Math.round(fishW * 0.18)}
      />
      <Eye
        size={eyeSize}
        top={(size - fishH) / 2 + Math.round(fishH * 0.25)}
        left={(size - fishW) / 2 + Math.round(fishW * 0.36)}
      />
    </View>
  );
}

function Eye({
  size,
  top,
  left,
}: {
  size: number;
  top: number;
  left: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size * 2,
        height: size * 2,
        top,
        left,
      }}
    >
      <View
        style={{
          position: "absolute",
          width: size * 2,
          height: Math.max(1, Math.round(size * 0.5)),
          backgroundColor: cfPalette.void,
          top: size,
          transform: [{ rotate: "45deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size * 2,
          height: Math.max(1, Math.round(size * 0.5)),
          backgroundColor: cfPalette.void,
          top: size,
          transform: [{ rotate: "-45deg" }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: "#0a0a0f",
    borderColor: "rgba(255, 47, 143, 0.5)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
