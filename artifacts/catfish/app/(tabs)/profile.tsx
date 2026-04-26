/**
 * Tab 4 — Profile placeholder + DEBUG menu.
 *
 * Pass 1 surface includes a debug section that exposes the only two
 * destructive operations the engine supports today:
 *  - Force a specific KillerIdentity for the next run
 *  - Reset the active run
 *
 * The killer identity for the *current* run is intentionally never
 * displayed (would spoil the case). Forcing only takes effect on the
 * next "New Case" — confirmed inline.
 */

import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
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

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const run = useGameState((s) => s.run);
  const startNewRun = useGameState((s) => s.startNewRun);
  const resetRun = useGameState((s) => s.resetRun);
  const voiceMuted = useGameState((s) => s.voiceMuted);
  const setVoiceMuted = useGameState((s) => s.setVoiceMuted);
  const sfxMuted = useGameState((s) => s.sfxMuted);
  const setSfxMuted = useGameState((s) => s.setSfxMuted);
  const musicMuted = useGameState((s) => s.musicMuted);
  const setMusicMuted = useGameState((s) => s.setMusicMuted);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const topPad = Math.max(insets.top, Platform.OS === "web" ? 24 : 12);

  const handleForce = async (identity: KillerIdentity) => {
    if (busy) return;
    setBusy(true);
    try {
      await startNewRun(identity);
      setDebugMessage(
        `New run started — killer forced to ${getIdentityModule(identity).displayName}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await resetRun();
      setDebugMessage("Active run cleared. Returning to title…");
      setTimeout(() => router.replace("/"), 600);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: Platform.OS === "web" ? 100 : 24 },
      ]}
    >
      <ScanlineOverlay />

      <PixelText size={14} color={cfPalette.cyan} uppercase glow>
        you
      </PixelText>
      <PixelText size={7} color={cfPalette.ash} style={{ marginTop: 6 }}>
        The bait. The detective. The catfish.
      </PixelText>

      <PixelPanel variant="raised" style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          <AssetImage
            id="A500_avatar_placeholder"
            style={styles.avatar}
            containerStyle={styles.avatar}
            resizeMode="cover"
          />
        </View>
        <View style={{ flex: 1, paddingLeft: 14 }}>
          <PixelText size={11} color={cfPalette.bone} uppercase>
            Detective
          </PixelText>
          <PixelText size={8} color={cfPalette.cyan} style={{ marginTop: 6 }}>
            {run ? `case opened day ${run.day}` : "no active case"}
          </PixelText>
          <PixelText size={7} color={cfPalette.ash} style={{ marginTop: 8, lineHeight: 11 }}>
            Bio editing arrives in a later pass.
          </PixelText>
        </View>
      </PixelPanel>

      <PixelPanel style={styles.audioCard}>
        <PixelText size={9} color={cfPalette.cyan} uppercase>
          audio
        </PixelText>
        <PixelText size={7} color={cfPalette.ash} style={{ marginTop: 4, lineHeight: 11 }}>
          Three independent channels. Each choice survives across runs.
        </PixelText>
        <View style={styles.audioToggleRow}>
          <AudioToggle
            label="voices"
            description="Suspect dialogue"
            muted={voiceMuted}
            onToggle={() => void setVoiceMuted(!voiceMuted)}
            testID="voice-mute-toggle"
            accessibilityLabel="Mute suspect voices"
          />
          <AudioToggle
            label="sfx"
            description="Swipes, matches, file"
            muted={sfxMuted}
            onToggle={() => void setSfxMuted(!sfxMuted)}
            testID="sfx-mute-toggle"
            accessibilityLabel="Mute sound effects"
          />
          <AudioToggle
            label="music"
            description="Noir background"
            muted={musicMuted}
            onToggle={() => void setMusicMuted(!musicMuted)}
            testID="music-mute-toggle"
            accessibilityLabel="Mute background music"
          />
        </View>
      </PixelPanel>

      {run && (
        <PixelPanel style={styles.statsCard}>
          <PixelText size={9} color={cfPalette.purpleHot} uppercase>
            case file
          </PixelText>
          <View style={styles.statsGrid}>
            <Stat label="day" value={String(run.day)} />
            <Stat label="swipes" value={String(run.swipes.length)} />
            <Stat label="matches" value={String(run.matches.length)} />
            <Stat label="deck left" value={String(run.deck.length - run.deckCursor)} />
          </View>
        </PixelPanel>
      )}

      <PixelPanel style={styles.debugCard} borderColor={cfPalette.warn}>
        <PixelText size={9} color={cfPalette.warn} uppercase glow>
          ⚠ debug menu
        </PixelText>
        <PixelText size={7} color={cfPalette.ash} style={{ marginTop: 6, lineHeight: 11 }}>
          Force a killer for the NEXT run, or wipe the current case file.
          Identity of the active case is hidden on purpose.
        </PixelText>

        <PixelText size={7} color={cfPalette.cyan} uppercase style={{ marginTop: 14 }}>
          force killer (starts new run)
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
                onPress={() => handleForce(id)}
                style={styles.killerButton}
              />
            );
          })}
        </View>

        <NeonButton
          label="Reset Active Run"
          variant="danger"
          size="md"
          fullWidth
          onPress={handleReset}
          style={{ marginTop: 18 }}
        />

        {debugMessage && (
          <PixelText
            size={7}
            color={cfPalette.ok}
            align="center"
            style={{ marginTop: 12, lineHeight: 11 }}
          >
            {debugMessage}
          </PixelText>
        )}
      </PixelPanel>

      <PixelText size={6} color={cfPalette.fog} align="center" style={{ marginTop: 18 }}>
        catfish · pass 1 of 7
      </PixelText>
    </ScrollView>
  );
}

interface AudioToggleProps {
  label: string;
  description: string;
  muted: boolean;
  onToggle: () => void;
  testID: string;
  accessibilityLabel: string;
}

function AudioToggle({
  label,
  description,
  muted,
  onToggle,
  testID,
  accessibilityLabel,
}: AudioToggleProps) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.audioToggleCell,
        {
          opacity: pressed ? 0.6 : 1,
          borderColor: muted ? cfPalette.fog : cfPalette.cyan,
        },
      ]}
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: !muted }}
      accessibilityLabel={accessibilityLabel}
    >
      <PixelText
        size={9}
        color={muted ? cfPalette.fog : cfPalette.cyan}
        uppercase
        glow={!muted}
      >
        {label}
      </PixelText>
      <PixelText
        size={6}
        color={muted ? cfPalette.fog : cfPalette.bone}
        uppercase
        style={{ marginTop: 4 }}
      >
        {muted ? "off" : "on"}
      </PixelText>
      <PixelText
        size={5}
        color={cfPalette.ash}
        align="center"
        style={{ marginTop: 6, lineHeight: 8 }}
      >
        {description}
      </PixelText>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <PixelText size={14} color={cfPalette.pinkHot} glow>
        {value}
      </PixelText>
      <PixelText size={6} color={cfPalette.ash} uppercase style={{ marginTop: 4 }}>
        {label}
      </PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
  },
  content: {
    paddingHorizontal: 18,
  },
  profileCard: {
    flexDirection: "row",
    padding: 14,
    marginTop: 16,
  },
  avatarWrap: {
    width: 64,
    height: 64,
  },
  avatar: {
    width: 64,
    height: 64,
  },
  statsCard: {
    marginTop: 14,
    padding: 14,
  },
  audioCard: {
    marginTop: 14,
    padding: 14,
  },
  voiceToggle: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 2,
    alignItems: "center",
  },
  audioToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  audioToggleCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 2,
    alignItems: "center",
    minHeight: 86,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  statCell: {
    width: "50%",
    paddingVertical: 6,
    alignItems: "center",
  },
  debugCard: {
    marginTop: 14,
    padding: 14,
  },
  killerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  killerButton: {
    marginTop: 4,
  },
});
