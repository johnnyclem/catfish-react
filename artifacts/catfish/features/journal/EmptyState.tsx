/**
 * EmptyState — onboarding panel shown in the Journal tab while the
 * player has not captured any Facts yet. Explains the long-press
 * gesture so the gesture is discoverable even before Pass 2's chat
 * UI ships.
 */

import { StyleSheet, View } from "react-native";

import { AssetImage } from "@/components/AssetImage";
import {
  PixelPanel,
  PixelText,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";

interface EmptyStateProps {
  hasMatches: boolean;
}

export function EmptyState({ hasMatches }: EmptyStateProps) {
  return (
    <View style={styles.center}>
      <AssetImage
        id="A300_journal_book"
        style={styles.bookArt}
        containerStyle={styles.bookArt}
        resizeMode="contain"
      />

      <PixelPanel variant="raised" style={styles.panel}>
        <PixelText size={10} color={cfPalette.cyan} uppercase glow align="center">
          evidence locker
        </PixelText>
        <PixelText
          size={7}
          color={cfPalette.bone}
          align="center"
          style={styles.body}
        >
          {hasMatches
            ? "Open a chat thread, then tap and hold any\nmessage to extract it as a Fact. Captured\nFacts get filed under the suspect they came from."
            : "Match with a suspect first. Then tap and hold\nany of their messages to file the line as a\nFact in this case book."}
        </PixelText>

        <View style={styles.hintRow}>
          <PixelText size={6} color={cfPalette.purpleHot} uppercase>
            tip
          </PixelText>
          <PixelText
            size={6}
            color={cfPalette.ash}
            style={styles.hintText}
          >
            Captured Facts persist between sessions.
          </PixelText>
        </View>
      </PixelPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    paddingVertical: 24,
  },
  bookArt: {
    width: 160,
    height: 160,
  },
  panel: {
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 18,
    minWidth: 280,
    maxWidth: 360,
  },
  body: {
    marginTop: 12,
    lineHeight: 12,
  },
  hintRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  hintText: {
    lineHeight: 10,
  },
});
