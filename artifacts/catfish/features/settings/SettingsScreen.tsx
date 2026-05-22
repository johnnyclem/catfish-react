import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";

import { NeonButton, PixelPanel, PixelText } from "@/components/PixelChrome";
import { PixelSlider } from "@/components/PixelSlider";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { ALL_KILLERS, KillerIdentity } from "@/core/models";
import { getIdentityModule } from "@/core/identities";

interface Section {
  title: string;
  rows: Row[];
}

interface Row {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  label: string;
  description?: string;
  kind: "toggle" | "slider";
  value: boolean | number;
  onToggle?: (v: boolean) => void;
  onSlider?: (v: number) => void;
  disabled?: boolean;
}

function SettingsRow({ row }: { row: Row }) {
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.left}>
        <Feather name={row.icon} size={16} color={row.iconColor} style={rowStyles.icon} />
        <View style={rowStyles.textCol}>
          <PixelText size={8} color={cfPalette.bone}>{row.label}</PixelText>
          {row.description ? (
            <PixelText size={6} color={cfPalette.fog} style={{ marginTop: 2 }}>
              {row.description}
            </PixelText>
          ) : null}
        </View>
      </View>
      {row.kind === "toggle" ? (
        <Switch
          value={!!row.value}
          onValueChange={row.onToggle ?? (() => {})}
          trackColor={{ false: cfPalette.iron, true: cfPalette.pinkHot }}
          thumbColor={row.value ? cfPalette.bone : cfPalette.ash}
        />
      ) : (
        <View style={rowStyles.sliderWrap}>
          <PixelSlider
            value={row.value as number}
            onValueChange={row.onSlider ?? (() => {})}
            disabled={row.disabled}
          />
        </View>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const scanlinesEnabled = useGameState((s) => s.scanlinesEnabled);
  const screenShakeEnabled = useGameState((s) => s.screenShakeEnabled);
  const reduceMotionEnabled = useGameState((s) => s.reduceMotionEnabled);
  const highContrastTextEnabled = useGameState((s) => s.highContrastTextEnabled);

  const voiceMuted = useGameState((s) => s.voiceMuted);
  const sfxMuted = useGameState((s) => s.sfxMuted);
  const musicMuted = useGameState((s) => s.musicMuted);
  const bgmVolume = useGameState((s) => s.bgmVolume);
  const sfxVolume = useGameState((s) => s.sfxVolume);
  const voiceVolume = useGameState((s) => s.voiceVolume);
  const ambienceVolume = useGameState((s) => s.ambienceVolume);

  const setScanlinesEnabled = useGameState((s) => s.setScanlinesEnabled);
  const setScreenShakeEnabled = useGameState((s) => s.setScreenShakeEnabled);
  const setReduceMotionEnabled = useGameState((s) => s.setReduceMotionEnabled);
  const setHighContrastTextEnabled = useGameState((s) => s.setHighContrastTextEnabled);
  const setVoiceMuted = useGameState((s) => s.setVoiceMuted);
  const setSfxMuted = useGameState((s) => s.setSfxMuted);
  const setMusicMuted = useGameState((s) => s.setMusicMuted);
  const setBgmVolume = useGameState((s) => s.setBgmVolume);
  const setSfxVolume = useGameState((s) => s.setSfxVolume);
  const setVoiceVolume = useGameState((s) => s.setVoiceVolume);
  const setAmbienceVolume = useGameState((s) => s.setAmbienceVolume);

  const sections: Section[] = [
    {
      title: "Audio",
      rows: [
        {
          icon: "music",
          iconColor: cfPalette.cyan,
          label: "Music",
          kind: "toggle",
          value: !musicMuted,
          onToggle: (v) => setMusicMuted(!v),
        },
        {
          icon: "music",
          iconColor: cfPalette.fog,
          label: "Music Volume",
          kind: "slider",
          value: bgmVolume,
          onSlider: setBgmVolume,
          disabled: musicMuted,
        },
        {
          icon: "volume-2",
          iconColor: cfPalette.cyan,
          label: "Sound Effects",
          kind: "toggle",
          value: !sfxMuted,
          onToggle: (v) => setSfxMuted(!v),
        },
        {
          icon: "volume-2",
          iconColor: cfPalette.fog,
          label: "SFX Volume",
          kind: "slider",
          value: sfxVolume,
          onSlider: setSfxVolume,
          disabled: sfxMuted,
        },
        {
          icon: "mic",
          iconColor: cfPalette.cyan,
          label: "Voice (TTS)",
          kind: "toggle",
          value: !voiceMuted,
          onToggle: (v) => setVoiceMuted(!v),
        },
        {
          icon: "mic",
          iconColor: cfPalette.fog,
          label: "Voice Volume",
          kind: "slider",
          value: voiceVolume,
          onSlider: setVoiceVolume,
          disabled: voiceMuted,
        },
        {
          icon: "radio",
          iconColor: cfPalette.cyan,
          label: "Ambience",
          kind: "slider",
          value: ambienceVolume,
          onSlider: setAmbienceVolume,
        },
      ],
    },
    {
      title: "Display",
      rows: [
        {
          icon: "monitor",
          iconColor: cfPalette.purpleHot,
          label: "CRT Scanlines",
          kind: "toggle",
          value: scanlinesEnabled,
          onToggle: setScanlinesEnabled,
        },
        {
          icon: "smartphone",
          iconColor: cfPalette.purpleHot,
          label: "Screen Shake",
          kind: "toggle",
          value: screenShakeEnabled,
          onToggle: setScreenShakeEnabled,
        },
      ],
    },
    {
      title: "Accessibility",
      rows: [
        {
          icon: "eye",
          iconColor: cfPalette.ok,
          label: "Reduce Motion",
          description: "Disables non-essential animations",
          kind: "toggle",
          value: reduceMotionEnabled,
          onToggle: setReduceMotionEnabled,
        },
        {
          icon: "type",
          iconColor: cfPalette.ok,
          label: "High Contrast Text",
          kind: "toggle",
          value: highContrastTextEnabled,
          onToggle: setHighContrastTextEnabled,
        },
      ],
    },
    {
      title: "About",
      rows: [
        {
          icon: "info",
          iconColor: cfPalette.ash,
          label: "Version",
          description: "v0.1.0 — pass 1 build",
          kind: "toggle",
          value: true,
          onToggle: () => {},
        },
      ],
    },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <PixelText size={12} color={cfPalette.bone} uppercase glow>
          Settings
        </PixelText>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <PixelText size={7} color={cfPalette.cyan} uppercase style={styles.sectionTitle}>
              {section.title}
            </PixelText>
            <PixelPanel variant="raised" style={styles.panel}>
              {section.rows.map((row) => (
                <SettingsRow key={row.label} row={row} />
              ))}
            </PixelPanel>
          </View>
        ))}

        <DebugSection />

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/**
 * Debug section — force a killer for the NEXT run, or wipe the
 * current case file. Lives in Settings since it's a tester-facing
 * tool, not a player-facing one; previously lived in the dating-app
 * "Profile" tab.
 */
function DebugSection() {
  const startNewRun = useGameState((s) => s.startNewRun);
  const resetRun = useGameState((s) => s.resetRun);
  const [busy, setBusy] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);

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
    <View style={styles.section}>
      <PixelText size={7} color={cfPalette.warn} uppercase style={styles.sectionTitle}>
        ⚠ Debug
      </PixelText>
      <PixelPanel variant="raised" style={styles.panel} borderColor={cfPalette.warn}>
        <PixelText size={7} color={cfPalette.ash} style={{ lineHeight: 11 }}>
          Force a killer for the next run, or wipe the current case file.
          Identity of the active case is hidden on purpose.
        </PixelText>

        <PixelText size={7} color={cfPalette.cyan} uppercase style={{ marginTop: 14 }}>
          force killer (starts new run)
        </PixelText>
        <View style={debugStyles.killerGrid}>
          {ALL_KILLERS.map((id) => {
            const mod = getIdentityModule(id);
            return (
              <NeonButton
                key={id}
                label={mod.displayName}
                variant="ghost"
                size="sm"
                onPress={() => handleForce(id)}
                style={debugStyles.killerButton}
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
    </View>
  );
}

const debugStyles = StyleSheet.create({
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

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  icon: {
    marginRight: 10,
  },
  textCol: {
    flex: 1,
  },
  sliderWrap: {
    width: 100,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 40,
    paddingBottom: 16,
    alignItems: "center",
  },
  scroll: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 8,
    paddingLeft: 4,
  },
  panel: {
    padding: 14,
  },
});
