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
import { useGameState } from "@/core/gameStore";
import { ALL_KILLERS, KillerIdentity } from "@/core/models";
import { getIdentityModule } from "@/core/identities";
import { useState } from "react";

export default function TitleScreen() {
  const insets = useSafeAreaInsets();
  const run = useGameState((s) => s.run);
  const hydrated = useGameState((s) => s.hydrated);
  const startNewRun = useGameState((s) => s.startNewRun);
  const [debugOpen, setDebugOpen] = useState(false);

  const topPad = Math.max(insets.top, Platform.OS === "web" ? 24 : 16);
  const bottomPad = Math.max(insets.bottom, 16);

  const enterCase = () => {
    // Land the player on the parody phone home grid; from there the
    // dating app is one tile away. Routing to /home (the new shell)
    // replaces the legacy /(tabs) entry from the pre-#59 layout.
    router.replace("/home" as never);
  };

  const handleNewCase = async () => {
    await startNewRun();
    enterCase();
  };

  const handleForceKiller = async (identity: KillerIdentity) => {
    await startNewRun(identity);
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
            <>
              <NeonButton
                label="Start New Case"
                variant="primary"
                size="lg"
                fullWidth
                onPress={handleNewCase}
              />
              {run && run.closed ? (
                // Closed-run footnote — explains why "Continue" is gone
                // so the player doesn't think their save was wiped.
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
