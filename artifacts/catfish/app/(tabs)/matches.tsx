/**
 * Tab 2 — Matches placeholder.
 *
 * Pass 1 only: lists the names of right-swiped candidates with the day
 * they matched. Pass 2 owns chat threads.
 */

import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssetImage } from "@/components/AssetImage";
import {
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";

export default function MatchesTab() {
  const insets = useSafeAreaInsets();
  const run = useGameState((s) => s.run);
  const topPad = Math.max(insets.top, Platform.OS === "web" ? 24 : 12);

  const matches = run?.matches ?? [];

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScanlineOverlay />
      <PixelText size={14} color={cfPalette.cyan} uppercase glow style={styles.title}>
        matches
      </PixelText>
      <PixelText size={7} color={cfPalette.ash} style={styles.subtitle}>
        Pass 2 will turn these into chat threads.
      </PixelText>

      <ScrollView contentContainerStyle={styles.list}>
        {matches.length === 0 ? (
          <PixelPanel variant="raised" style={styles.empty}>
            <PixelText size={9} color={cfPalette.ash} align="center" style={{ lineHeight: 14 }}>
              No matches yet.{"\n"}Swipe right on someone to start a thread.
            </PixelText>
          </PixelPanel>
        ) : (
          matches.map((m) => {
            const cand = run!.deck.find((c) => c.id === m.candidateId);
            return (
              <PixelPanel key={m.id} variant="default" style={styles.row}>
                <View style={styles.avatarWrap}>
                  <AssetImage
                    id={cand?.portraitAssetId ?? "A500_avatar_placeholder"}
                    style={styles.avatar}
                    containerStyle={styles.avatar}
                    resizeMode="cover"
                  />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <PixelText size={10} color={cfPalette.bone} uppercase>
                    {cand?.displayName ?? "unknown"}
                  </PixelText>
                  <PixelText size={7} color={cfPalette.ash} style={{ marginTop: 4 }}>
                    {`matched day ${m.matchedOnDay}`}
                  </PixelText>
                </View>
                <PixelText size={7} color={cfPalette.purpleHot} uppercase>
                  Pass 2
                </PixelText>
              </PixelPanel>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
    paddingHorizontal: 18,
  },
  title: {
    marginTop: 8,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
  },
  list: {
    paddingBottom: Platform.OS === "web" ? 100 : 24,
    gap: 10,
  },
  empty: {
    padding: 28,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  avatarWrap: {
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
  },
});
