/**
 * Phone-shell wrapper around the Photos evidence gallery.
 *
 * The Photos app surfaces discovered facts that have associated image
 * assets (the A3xx evidence range) in a scrollable grid. Tapping a
 * thumbnail expands it to a full-screen detail view with the fact text
 * and source label.
 *
 * The app is accessible from the home grid regardless of whether the
 * run is active or closed — evidence from previous cases can still be
 * studied on subsequent sessions.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { isFactRevealedYet } from "@/core/factBootstrap";
import { useGameState } from "@/core/gameStore";

import { EvidenceDetail } from "@/features/apps/EvidenceDetail";
import { AssetImage } from "@/components/AssetImage";
import type { Fact } from "@/core/models";

export function PhotosApp() {
  const run = useGameState((s) => s.run);

  const facts = run?.facts ?? [];
  const evidence = facts.filter(
    (f) =>
      f.committed &&
      f.payload.imageAssetID != null &&
      (!run || isFactRevealedYet(f, run)),
  ) as Array<Fact & { payload: { imageAssetID: string; text: string; subject?: string } }>;

  type EvidenceFact = (typeof evidence)[number];
  const [selected, setSelected] = useState<EvidenceFact | null>(null);

  if (evidence.length === 0) {
    return (
      <View style={styles.empty}>
        <PixelText size={10} color={cfPalette.ash} align="center" uppercase>
          no evidence yet
        </PixelText>
        <PixelText
          size={7}
          color={cfPalette.fog}
          align="center"
          style={{ marginTop: 8, lineHeight: 12 }}
        >
          capture facts from suspects to build your case file.
        </PixelText>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.grid}>
        {evidence.map((fact) => (
          <Pressable
            key={fact.id}
            testID={`photos-thumb-${fact.id}`}
            onPress={() => setSelected(fact)}
            style={({ pressed }) => [styles.thumb, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel={`View evidence: ${fact.payload.text}`}
          >
            <AssetImage
              id={fact.payload.imageAssetID}
              style={styles.thumbImg}
              containerStyle={styles.thumbImg}
              resizeMode="cover"
            />
            <PixelText
              size={5}
              color={cfPalette.fog}
              style={styles.thumbLabel}
            >
              {fact.payload.text}
            </PixelText>
          </Pressable>
        ))}
      </ScrollView>
      {selected && (
        <EvidenceDetail fact={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    padding: 12,
    paddingBottom: 32,
  },
  thumb: {
    width: "31%",
    marginBottom: 8,
  },
  thumbImg: {
    width: "100%",
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: cfPalette.iron,
    borderRadius: 4,
  },
  thumbLabel: {
    marginTop: 2,
    lineHeight: 8,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
});