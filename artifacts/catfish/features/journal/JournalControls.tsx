/**
 * JournalControls — filter + sort header for the Journal tab.
 *
 * Renders two compact rows of pixel chips:
 *   1. A horizontally-scrollable suspect filter ("All" + one chip per
 *      suspect with at least one captured Fact).
 *   2. A sort toggle: "newest first" vs "by day captured".
 *
 * Behavior is purely view-side — controls are owned by the Journal tab
 * and applied inside its memoized group computation.
 */

import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { Candidate, CandidateId } from "@/core/models";

export type JournalSortMode = "newest" | "byDay";

interface JournalControlsProps {
  suspects: Candidate[];
  selectedSuspectId: CandidateId | null;
  onSelectSuspect: (id: CandidateId | null) => void;
  sortMode: JournalSortMode;
  onChangeSort: (mode: JournalSortMode) => void;
}

export function JournalControls({
  suspects,
  selectedSuspectId,
  onSelectSuspect,
  sortMode,
  onChangeSort,
}: JournalControlsProps) {
  return (
    <View style={styles.wrap}>
      {suspects.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label="All"
            active={selectedSuspectId === null}
            onPress={() => onSelectSuspect(null)}
          />
          {suspects.map((s) => (
            <Chip
              key={s.id}
              label={s.displayName}
              active={selectedSuspectId === s.id}
              onPress={() =>
                onSelectSuspect(selectedSuspectId === s.id ? null : s.id)
              }
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.sortRow}>
        <PixelText size={6} color={cfPalette.ash} uppercase style={styles.sortLabel}>
          sort
        </PixelText>
        <SortPill
          label="Newest first"
          active={sortMode === "newest"}
          onPress={() => onChangeSort("newest")}
        />
        <SortPill
          label="By day captured"
          active={sortMode === "byDay"}
          onPress={() => onChangeSort("byDay")}
        />
      </View>
    </View>
  );
}

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${label}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.7 },
      ]}
    >
      <PixelText
        size={7}
        color={active ? cfPalette.void : cfPalette.bone}
        uppercase
      >
        {label}
      </PixelText>
    </Pressable>
  );
}

function SortPill({ label, active, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sort ${label}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sortPill,
        active && styles.sortPillActive,
        pressed && { opacity: 0.7 },
      ]}
    >
      <PixelText
        size={6}
        color={active ? cfPalette.void : cfPalette.ash}
        uppercase
      >
        {label}
      </PixelText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingRight: 12,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: cfPalette.purple,
    backgroundColor: cfPalette.panel,
  },
  chipActive: {
    backgroundColor: cfPalette.cyan,
    borderColor: cfPalette.cyanHot,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  sortLabel: {
    marginRight: 4,
  },
  sortPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: cfPalette.fog,
    backgroundColor: "transparent",
  },
  sortPillActive: {
    backgroundColor: cfPalette.pinkHot,
    borderColor: cfPalette.pinkSoft,
  },
});
