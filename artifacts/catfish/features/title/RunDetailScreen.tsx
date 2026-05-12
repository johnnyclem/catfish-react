import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  NeonButton,
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { getIdentityModule } from "@/core/identities";

export default function RunDetailScreen() {
  const insets = useSafeAreaInsets();
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const archive = useGameState((s) => s.runArchive);
  const summary = archive.find((s) => s.runId === runId);

  if (!summary) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <ScanlineOverlay />
        <View style={styles.header}>
          <NeonButton
            label="← Back"
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
          />
        </View>
        <View style={styles.empty}>
          <PixelText size={8} color={cfPalette.ash} align="center">
            Run not found.
          </PixelText>
        </View>
      </View>
    );
  }

  const mod = getIdentityModule(summary.killer);
  const outcomeLabel = summary.caughtKiller
    ? "Caught the killer"
    : summary.outcome === "wrongfulAccusation"
      ? "Wrongful accusation"
      : summary.outcome === "metKillerStub"
        ? "Met the killer face-to-face"
        : "The killer escaped";
  const outcomeColor = summary.caughtKiller
    ? cfPalette.ok
    : cfPalette.err;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <NeonButton
          label="← Back"
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
        />
        <PixelText size={12} color={cfPalette.bone} uppercase glow style={{ marginTop: 12 }}>
          Case Summary
        </PixelText>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <PixelPanel variant="raised" style={styles.panel}>
          <PixelText size={9} color={cfPalette.bone} uppercase>
            Killer: {mod.displayName}
          </PixelText>
          <PixelText
            size={8}
            color={outcomeColor}
            uppercase
            glow
            style={{ marginTop: 8 }}
          >
            {outcomeLabel}
          </PixelText>
        </PixelPanel>

        <PixelPanel variant="raised" style={styles.panel}>
          <PixelText size={8} color={cfPalette.cyan} uppercase style={{ marginBottom: 10 }}>
            Stats
          </PixelText>
          <StatRow label="Days" value={String(summary.daysTaken)} />
          <StatRow label="Clues Discovered" value={String(summary.factsDiscovered)} />
          <StatRow label="Matches" value={String(summary.matchCount)} />
          <StatRow label="Swipes" value={String(summary.swipeCount)} />
        </PixelPanel>

        <NeonButton
          label="Play Again"
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => {
            router.back();
          }}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={statStyles.row}>
      <PixelText size={7} color={cfPalette.ash}>{label}</PixelText>
      <PixelText size={7} color={cfPalette.bone}>{value}</PixelText>
    </View>
  );
}

const statStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: cfPalette.iron,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 16,
  },
  panel: {
    padding: 14,
    marginBottom: 14,
  },
});
