/**
 * TitleScreen — Pass 1 entry point.
 * Translated from the SwiftUI Title view in the source doc.
 *  - Shows the logo, taglines, and a primary "New Case" / "Continue" CTA.
 *  - Routes into the (tabs) layout once a CaseRun exists.
 */

import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssetImage } from "@/components/AssetImage";
import {
  NeonButton,
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { ALL_KILLERS, KillerIdentity } from "@/core/models";
import { getIdentityModule } from "@/core/identities";

export default function TitleScreen() {
  const insets = useSafeAreaInsets();
  const run = useGameState((s) => s.run);
  const hydrated = useGameState((s) => s.hydrated);
  const startNewRun = useGameState((s) => s.startNewRun);
  const [debugOpen, setDebugOpen] = useState(false);

  const topPad = Math.max(insets.top, Platform.OS === "web" ? 24 : 16);
  const bottomPad = Math.max(insets.bottom, 16);

  // Parallax phone graphic animation
  const parallaxAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(parallaxAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(parallaxAnim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [parallaxAnim]);

  const parallaxY = parallaxAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const evidenceCount = run ? run.facts.filter((f) => f.committed).length : 0;

  const enterCase = useCallback(() => {
    router.replace("/home" as never);
  }, []);

  const handleNewCase = useCallback(async () => {
    if (run && !run.closed) {
      Alert.alert(
        "Start New Case?",
        "This will end your current investigation. All progress will be lost.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start New", style: "destructive", onPress: async () => {
            await startNewRun();
            enterCase();
          }},
        ],
      );
    } else {
      await startNewRun();
      enterCase();
    }
  }, [run, startNewRun, enterCase]);

  const handleForceKiller = useCallback(async (identity: KillerIdentity) => {
    await startNewRun(identity);
    enterCase();
  }, [startNewRun, enterCase]);

  const handleViewRunHistory = useCallback(() => {
    router.push("/run-history" as never);
  }, []);

  if (!hydrated) {
    return (
      <View style={styles.center}>
        <PixelText size={10} color={cfPalette.ash}>
          loading…
        </PixelText>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <ScanlineOverlay />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateY: parallaxY }] }}>
          <View style={styles.logoWrap}>
            <AssetImage
              id="A001_title_logo"
              style={styles.logo}
              containerStyle={styles.logo}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <PixelText
          size={9}
          color={cfPalette.cyan}
          align="center"
          uppercase
          glow
          style={{ marginTop: 16, letterSpacing: 2 }}
        >
          a dating-detective story
        </PixelText>

        <PixelPanel variant="raised" style={styles.tagline}>
          <PixelText size={8} color={cfPalette.bone} align="center" style={{ lineHeight: 14 }}>
            Five suspects.{"\n"}One killer behind a profile.{"\n"}
            <PixelText size={8} color={cfPalette.pinkHot}>
              swipe carefully.
            </PixelText>
          </PixelText>
        </PixelPanel>

        <View style={styles.buttons}>
          {run && !run.closed ? (
            <>
              <NeonButton
                label="Continue Case"
                variant="primary"
                size="lg"
                fullWidth
                onPress={enterCase}
              />
              <PixelText size={7} color={cfPalette.ash} align="center" style={{ marginTop: 12 }}>
                {`day ${run.day}  ·  ${run.deck.length} suspects  ·  ${evidenceCount} clues  ·  ${run.swipes.length} swipes`}
              </PixelText>
              <NeonButton
                label="New Case (Reset)"
                variant="ghost"
                size="sm"
                fullWidth
                onPress={handleNewCase}
                style={{ marginTop: 18 }}
              />
            </>
          ) : (
            <>
              <NeonButton
                label="Start New Case"
                variant="primary"
                size="lg"
                fullWidth
                onPress={handleNewCase}
              />
              {run && run.closed ? (
                <PixelText
                  size={7}
                  color={cfPalette.ash}
                  align="center"
                  style={{ marginTop: 12, lineHeight: 12 }}
                >
                  {`last case closed on day ${run.day} — start a new one to play again`}
                </PixelText>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.runHistoryWrap}>
          <NeonButton
            label="View Run History"
            variant="ghost"
            size="sm"
            fullWidth
            onPress={handleViewRunHistory}
          />
        </View>

        <View style={styles.debugWrap}>
          <NeonButton
            label={debugOpen ? "▾ DEBUG" : "▸ DEBUG"}
            variant="ghost"
            size="sm"
            onPress={() => setDebugOpen((v) => !v)}
          />
          {debugOpen && (
            <PixelPanel style={styles.debugPanel} borderColor={cfPalette.warn}>
              <PixelText size={7} color={cfPalette.warn} uppercase glow>
                ⚠ force killer (starts new run)
              </PixelText>
              <PixelText
                size={6}
                color={cfPalette.ash}
                style={{ marginTop: 6, lineHeight: 10 }}
              >
                Picks the suspect for a fresh case. Overwrites any active run.
              </PixelText>
              <View style={styles.killerGrid}>
                {ALL_KILLERS.map((id) => {
                  const mod = getIdentityModule(id);
                  return (
                    <NeonButton
                      key={id}
                      label={mod.displayName}
                      variant="ghost"
                      size="sm"
                      onPress={() => handleForceKiller(id)}
                    />
                  );
                })}
              </View>
            </PixelPanel>
          )}
        </View>

        <View style={styles.footer}>
          <PixelText size={6} color={cfPalette.fog} align="center">
            v0.1.0 — pass 1 build
          </PixelText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
    paddingHorizontal: 22,
  },
  center: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "stretch",
    paddingVertical: 24,
  },
  logoWrap: {
    alignItems: "center",
    marginTop: 12,
  },
  logo: {
    width: 240,
    height: 200,
  },
  tagline: {
    marginTop: 28,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  buttons: {
    marginTop: 36,
  },
  runHistoryWrap: {
    marginTop: 24,
  },
  debugWrap: {
    marginTop: 28,
    alignItems: "center",
  },
  debugPanel: {
    marginTop: 12,
    padding: 14,
    width: "100%",
  },
  killerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  footer: {
    marginTop: 36,
  },
});
