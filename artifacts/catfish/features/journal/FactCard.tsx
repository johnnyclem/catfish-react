/**
 * FactCard — single captured Fact rendered inside a SuspectGroup.
 *
 * Shows the quoted line plus when it was captured, and exposes a
 * pixel-art ✕ chip the player can tap to discard the entry. The
 * actual quote text is rendered in a slightly larger pixel size for
 * legibility — most captured lines will be conversational fragments.
 */

import { Pressable, StyleSheet, View } from "react-native";

import { PixelPanel, PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { Fact } from "@/core/models";

interface FactCardProps {
  fact: Fact;
  onDiscard: (factId: string) => void;
}

export function FactCard({ fact, onDiscard }: FactCardProps) {
  const quote = fact.capturedQuote ?? "(missing quote)";
  const day = fact.capturedOnDay ?? 0;

  return (
    <PixelPanel variant="default" style={styles.card}>
      <View style={styles.header}>
        <PixelText size={6} color={cfPalette.cyan} uppercase>
          {`day ${day}`}
        </PixelText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard fact"
          hitSlop={10}
          onPress={() => onDiscard(fact.id)}
          style={({ pressed }) => [
            styles.discard,
            pressed && { opacity: 0.6 },
          ]}
        >
          <PixelText size={8} color={cfPalette.ash} uppercase>
            ✕
          </PixelText>
        </Pressable>
      </View>

      <View style={styles.quoteRow}>
        <PixelText size={11} color={cfPalette.purpleHot} style={styles.quoteGlyph}>
          “
        </PixelText>
        <PixelText
          size={9}
          color={cfPalette.bone}
          style={styles.quoteBody}
        >
          {quote}
        </PixelText>
      </View>
    </PixelPanel>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  discard: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: cfPalette.fog,
  },
  quoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  quoteGlyph: {
    marginRight: 6,
    marginTop: -2,
    lineHeight: 12,
  },
  quoteBody: {
    flex: 1,
    lineHeight: 14,
  },
});
