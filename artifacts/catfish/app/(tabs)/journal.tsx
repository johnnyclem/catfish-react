/**
 * Tab 3 — Journal placeholder.
 *
 * Pass 1 only: shows the locked Journal cover. Pass 5 will own Fact
 * commitment, contradiction wall, and the accusation flow.
 */

import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssetImage } from "@/components/AssetImage";
import {
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";

export default function JournalTab() {
  const insets = useSafeAreaInsets();
  const run = useGameState((s) => s.run);
  const topPad = Math.max(insets.top, Platform.OS === "web" ? 24 : 12);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScanlineOverlay />

      <PixelText size={14} color={cfPalette.purpleHot} uppercase glow style={styles.title}>
        the journal
      </PixelText>
      <PixelText size={7} color={cfPalette.ash} style={styles.subtitle}>
        Locked until Pass 5.
      </PixelText>

      <View style={styles.center}>
        <AssetImage
          id="A300_journal_book"
          style={styles.bookArt}
          containerStyle={styles.bookArt}
          resizeMode="contain"
        />

        <PixelPanel variant="raised" style={styles.lockPanel}>
          <PixelText size={10} color={cfPalette.cyan} uppercase glow align="center">
            evidence locker
          </PixelText>
          <PixelText
            size={7}
            color={cfPalette.bone}
            align="center"
            style={{ marginTop: 12, lineHeight: 12 }}
          >
            Future passes will let you commit conversations to facts,{"\n"}
            stack contradictions, and finally accuse the killer.
          </PixelText>

          {run && (
            <View style={styles.statRow}>
              <PixelText size={7} color={cfPalette.ash}>
                {`facts captured: ${run.facts.filter((f) => f.committed).length}`}
              </PixelText>
            </View>
          )}
        </PixelPanel>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
    paddingHorizontal: 18,
  },
  title: { marginTop: 8 },
  subtitle: { marginTop: 6 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: Platform.OS === "web" ? 90 : 24,
  },
  bookArt: {
    width: 180,
    height: 180,
  },
  lockPanel: {
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 18,
    minWidth: 280,
  },
  statRow: {
    marginTop: 14,
    alignItems: "center",
  },
});
