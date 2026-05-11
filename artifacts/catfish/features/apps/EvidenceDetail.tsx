/**
 * EvidenceDetail — full-screen detail overlay for a single evidence item
 * in the Photos app.
 *
 * Shows the image, the fact text, and a source label (day, fact kind,
 * and aboutCharacter when set). Dismissed by tapping outside or the ✕.
 */
import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { AssetImage } from "@/components/AssetImage";
import { PixelPanel, PixelText, ScanlineOverlay } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import type { Fact } from "@/core/models";

interface EvidenceDetailProps {
  fact: Fact & { payload: { imageAssetID: string; text: string; subject?: string } };
  onClose: () => void;
}

const KIND_LABELS: Record<string, string> = {
  static: "authored · static",
  variable: "authored · variable",
  conditional: "authored · conditional",
  captured: "player-captured",
};

export function EvidenceDetail({ fact, onClose }: EvidenceDetailProps) {
  const imageId = fact.payload.imageAssetID;
  const dayLabel = `day ${fact.day}`;
  const kindLabel = KIND_LABELS[fact.kind] ?? fact.kind;
  const subjectLabel = fact.payload.subject
    ? `about: ${fact.payload.subject}`
    : fact.aboutCharacter
      ? `about: ${fact.aboutCharacter}`
      : null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.panel}>
          <ScanlineOverlay />
          <PixelPanel variant="raised" style={styles.inner}>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={10}
            >
              <PixelText size={9} color={cfPalette.ash} uppercase>
                ✕ close
              </PixelText>
            </Pressable>

            <View style={styles.imageWrap}>
              <AssetImage
                id={imageId}
                style={styles.image}
                containerStyle={styles.image}
                resizeMode="contain"
              />
            </View>

            <PixelText
              size={9}
              color={cfPalette.bone}
              style={styles.factText}
            >
              {fact.payload.text}
            </PixelText>

            <View style={styles.meta}>
              <PixelText size={6} color={cfPalette.ash}>
                {dayLabel} · {kindLabel}
              </PixelText>
              {subjectLabel && (
                <PixelText
                  size={6}
                  color={cfPalette.purpleHot}
                  style={{ marginTop: 4 }}
                >
                  {subjectLabel}
                </PixelText>
              )}
            </View>
          </PixelPanel>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  panel: {
    width: "100%",
    maxWidth: 400,
  },
  inner: {
    padding: 16,
    alignItems: "center",
  },
  closeBtn: {
    alignSelf: "flex-end",
    padding: 4,
    marginBottom: 8,
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 1,
    marginBottom: 16,
  },
  image: {
    width: "100%",
    height: "100%",
    borderWidth: 2,
    borderColor: cfPalette.purple,
    borderRadius: 4,
  },
  factText: {
    lineHeight: 15,
    textAlign: "center",
    marginBottom: 12,
  },
  meta: {
    alignItems: "center",
  },
});