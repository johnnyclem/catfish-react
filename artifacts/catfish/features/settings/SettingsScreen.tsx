import { Feather } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Switch, View } from "react-native";

import { PixelPanel, PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";

interface Section {
  title: string;
  rows: Row[];
}

interface Row {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  label: string;
  description?: string;
  kind: "toggle";
  value: boolean;
  onToggle: (v: boolean) => void;
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
      <Switch
        value={row.value}
        onValueChange={row.onToggle}
        trackColor={{ false: cfPalette.iron, true: cfPalette.pinkHot }}
        thumbColor={row.value ? cfPalette.bone : cfPalette.ash}
      />
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
  const setScanlinesEnabled = useGameState((s) => s.setScanlinesEnabled);
  const setScreenShakeEnabled = useGameState((s) => s.setScreenShakeEnabled);
  const setReduceMotionEnabled = useGameState((s) => s.setReduceMotionEnabled);
  const setHighContrastTextEnabled = useGameState((s) => s.setHighContrastTextEnabled);
  const setVoiceMuted = useGameState((s) => s.setVoiceMuted);
  const setSfxMuted = useGameState((s) => s.setSfxMuted);
  const setMusicMuted = useGameState((s) => s.setMusicMuted);

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
          icon: "volume-2",
          iconColor: cfPalette.cyan,
          label: "Sound Effects",
          kind: "toggle",
          value: !sfxMuted,
          onToggle: (v) => setSfxMuted(!v),
        },
        {
          icon: "mic",
          iconColor: cfPalette.cyan,
          label: "Voice (TTS)",
          kind: "toggle",
          value: !voiceMuted,
          onToggle: (v) => setVoiceMuted(!v),
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
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

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
