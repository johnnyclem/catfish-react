/**
 * TitleScreen — Pass 1 entry point.
 * Translated from the SwiftUI Title view in the source doc.
 *  - Shows the logo, taglines, and a primary "New Case" / "Continue" CTA.
 *  - Routes into the (tabs) layout once a CaseRun exists.
 */

import { router } from "expo-router";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssetImage } from "@/components/AssetImage";
import {
  NeonButton,
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameContext";

export default function TitleScreen() {
  const insets = useSafeAreaInsets();
  const { run, hydrated, startNewRun } = useGameState();

  const topPad = Math.max(insets.top, Platform.OS === "web" ? 24 : 16);
  const bottomPad = Math.max(insets.bottom, 16);

  const enterCase = () => {
    router.replace("/(tabs)");
  };

  const handleNewCase = async () => {
    await startNewRun();
    enterCase();
  };

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
        <View style={styles.logoWrap}>
          <AssetImage
            id="A001_title_logo"
            style={styles.logo}
            containerStyle={styles.logo}
            resizeMode="contain"
          />
        </View>

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
          {run ? (
            <>
              <NeonButton
                label="Continue Case"
                variant="primary"
                size="lg"
                fullWidth
                onPress={enterCase}
              />
              <PixelText size={7} color={cfPalette.ash} align="center" style={{ marginTop: 12 }}>
                {`day ${run.day}  ·  ${run.matches.length} matches  ·  ${run.swipes.length} swipes`}
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
            <NeonButton
              label="Start New Case"
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleNewCase}
            />
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
  footer: {
    marginTop: 36,
  },
});
