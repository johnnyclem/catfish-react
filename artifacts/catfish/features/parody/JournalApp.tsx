/**
 * Phone-shell wrapper around the Journal screen.
 *
 * The Journal is the home of all sleuthing surfaces — notes/facts,
 * the suspect board, and the per-character social feed all live
 * here so the dating-app shell can stay focused on matching and
 * messaging. A top pill bar flips between the three sections
 * without remounting the surface.
 *
 * The Journal's iOS-style red badge on the home screen counts facts
 * captured since the player last visited; opening the Journal must
 * clear that badge the moment the surface mounts.
 */
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";

import { JournalScreen } from "@/features/journal/JournalScreen";
import { SocialFeedScreen } from "@/features/journal/SocialFeedScreen";
import { SuspectBoardScreen } from "@/features/journal/SuspectBoardScreen";
import { emitSfx } from "@/features/audio/audioEvents";
import {
  type JournalSection,
  usePhoneShell,
} from "./phoneShellState";

interface SectionSpec {
  id: JournalSection;
  label: string;
}

const SECTIONS: SectionSpec[] = [
  { id: "notes", label: "Notes" },
  { id: "suspects", label: "Suspects" },
  { id: "social", label: "Social" },
];

export function JournalApp() {
  const markJournalVisited = useGameState((s) => s.markJournalVisited);
  const section = usePhoneShell((s) => s.journalSection);
  const setSection = usePhoneShell((s) => s.setJournalSection);

  useEffect(() => {
    // Fire-and-forget — the action persists the new "seen" baseline
    // so the badge stays cleared across cold starts. We don't await
    // because the UI doesn't block on the write.
    void markJournalVisited();
  }, [markJournalVisited]);

  return (
    <View style={styles.root}>
      <View style={styles.sectionBar}>
        {SECTIONS.map((s) => {
          const active = s.id === section;
          return (
            <Pressable
              key={s.id}
              testID={`journal-section-${s.id}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${s.label} section`}
              onPress={() => {
                if (s.id === section) return;
                emitSfx("tab_switch");
                setSection(s.id);
              }}
              style={({ pressed }) => [
                styles.sectionPill,
                active && styles.sectionPillActive,
                pressed && !active && { opacity: 0.7 },
              ]}
            >
              <PixelText
                size={7}
                color={active ? cfPalette.void : cfPalette.bone}
                uppercase
              >
                {s.label}
              </PixelText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {section === "notes" && <JournalScreen />}
        {section === "suspects" && <SuspectBoardScreen />}
        {section === "social" && <SocialFeedScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
  },
  sectionBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: cfPalette.purple,
    backgroundColor: cfPalette.panel,
  },
  sectionPillActive: {
    backgroundColor: cfPalette.cyan,
    borderColor: cfPalette.cyanHot,
  },
  body: {
    flex: 1,
  },
});
