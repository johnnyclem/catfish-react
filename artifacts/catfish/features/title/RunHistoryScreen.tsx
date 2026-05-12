import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
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

export default function RunHistoryScreen() {
  const insets = useSafeAreaInsets();
  const archive = useGameState((s) => s.runArchive);

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
        <PixelText size={12} color={cfPalette.bone} uppercase glow style={{ marginTop: 8 }}>
          Run History
        </PixelText>
      </View>

      {archive.length === 0 ? (
        <View style={styles.empty}>
          <PixelText size={8} color={cfPalette.ash} align="center">
            No closed cases yet.
          </PixelText>
          <PixelText size={8} color={cfPalette.ash} align="center" style={{ marginTop: 4 }}>
            Go catch a killer.
          </PixelText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {archive.map((summary) => {
            const mod = getIdentityModule(summary.killer);
            const outcomeLabel = summary.caughtKiller
              ? "Caught!"
              : summary.outcome === "wrongfulAccusation"
                ? "Wrong Accusation"
                : summary.outcome === "metKillerStub"
                  ? "Met face-to-face"
                  : "Escaped";
            const outcomeColor = summary.caughtKiller
              ? cfPalette.ok
              : cfPalette.err;

            return (
              <Pressable
                key={summary.runId}
                onPress={() =>
                  router.push(`/run-detail/${summary.runId}` as never)
                }
              >
                {({ pressed }) => (
                  <PixelPanel
                    style={[styles.runCard, pressed && { opacity: 0.7 }]}
                    variant="raised"
                  >
                    <View style={styles.cardTop}>
                      <PixelText size={9} color={cfPalette.bone} uppercase>
                        {mod.displayName}
                      </PixelText>
                      <PixelText size={8} color={outcomeColor} uppercase glow>
                        {outcomeLabel}
                      </PixelText>
                    </View>
                    <View style={styles.cardStats}>
                      <PixelText size={7} color={cfPalette.ash}>
                        {summary.daysTaken} {summary.daysTaken === 1 ? "day" : "days"}
                      </PixelText>
                      <PixelText size={7} color={cfPalette.ash}>
                        {summary.factsDiscovered} clues
                      </PixelText>
                      <PixelText size={7} color={cfPalette.ash}>
                        {summary.matchCount} matches
                      </PixelText>
                    </View>
                  </PixelPanel>
                )}
              </Pressable>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

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
    paddingHorizontal: 32,
  },
  scroll: {
    paddingHorizontal: 16,
  },
  runCard: {
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardStats: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
});
