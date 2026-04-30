/**
 * Journal screen body.
 *
 * Lifted from `app/(tabs)/journal.tsx` when Task #59 dropped the root
 * tab bar and made the parody phone home grid the main interface.
 * Same data-shaping (per-suspect grouping, sort + filter, captured-
 * fact undo banner, accusation entry point) — the only chrome change
 * is that we no longer pad the top inset ourselves; the parody phone
 * shell that hosts us already does.
 */

import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import {
  NeonButton,
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { Candidate, CandidateId, Fact } from "@/core/models";
import { AccusationSheet } from "@/features/accusation/AccusationSheet";
import { EmptyState } from "@/features/journal/EmptyState";
import {
  JournalControls,
  JournalSortMode,
} from "@/features/journal/JournalControls";
import { SuspectGroup } from "@/features/journal/SuspectGroup";
import { UndoDiscardBanner } from "@/features/journal/UndoDiscardBanner";

interface CandidateGroup {
  candidate: Candidate;
  facts: Fact[];
}

export function JournalScreen() {
  const run = useGameState((s) => s.run);
  const removeFact = useGameState((s) => s.removeFact);

  const [selectedSuspectId, setSelectedSuspectId] =
    useState<CandidateId | null>(null);
  const [sortMode, setSortMode] = useState<JournalSortMode>("newest");
  const [accuseOpen, setAccuseOpen] = useState(false);

  const committed = useMemo<Fact[]>(
    () =>
      (run?.facts ?? []).filter(
        (f) => f.committed && f.capturedFromCandidateId,
      ),
    [run?.facts],
  );

  const allGroups = useMemo<CandidateGroup[]>(() => {
    if (!run) return [];
    const byCandidate = new Map<CandidateId, Fact[]>();
    for (const fact of committed) {
      const cid = fact.capturedFromCandidateId;
      if (!cid) continue;
      const list = byCandidate.get(cid) ?? [];
      list.push(fact);
      byCandidate.set(cid, list);
    }

    const out: CandidateGroup[] = [];
    for (const [cid, facts] of byCandidate.entries()) {
      const candidate = run.deck.find((c) => c.id === cid);
      if (!candidate) continue;
      out.push({ candidate, facts });
    }
    return out;
  }, [run, committed]);

  const groups = useMemo<CandidateGroup[]>(() => {
    const filtered =
      selectedSuspectId == null
        ? allGroups
        : allGroups.filter((g) => g.candidate.id === selectedSuspectId);

    const sorted = filtered.map((g) => {
      const facts = [...g.facts];
      if (sortMode === "newest") {
        facts.sort((a, b) =>
          (b.capturedAt ?? "").localeCompare(a.capturedAt ?? ""),
        );
      } else {
        facts.sort((a, b) => {
          const da = a.capturedOnDay ?? 0;
          const db = b.capturedOnDay ?? 0;
          if (da !== db) return da - db;
          return (a.capturedAt ?? "").localeCompare(b.capturedAt ?? "");
        });
      }
      return { candidate: g.candidate, facts };
    });

    if (sortMode === "newest") {
      sorted.sort((a, b) => {
        const ta = a.facts[0]?.capturedAt ?? "";
        const tb = b.facts[0]?.capturedAt ?? "";
        return tb.localeCompare(ta);
      });
    } else {
      sorted.sort((a, b) => {
        const da = a.facts[0]?.capturedOnDay ?? 0;
        const db = b.facts[0]?.capturedOnDay ?? 0;
        if (da !== db) return da - db;
        return (a.facts[0]?.capturedAt ?? "").localeCompare(
          b.facts[0]?.capturedAt ?? "",
        );
      });
    }
    return sorted;
  }, [allGroups, selectedSuspectId, sortMode]);

  const hasFacts = committed.length > 0;
  const matches = run?.matches ?? [];
  const factsCount = committed.length;
  const suspectsCount = allGroups.length;
  const filterIsActive = selectedSuspectId !== null;
  const filterHidEverything = hasFacts && groups.length === 0;
  const clearFilters = () => {
    setSelectedSuspectId(null);
    setSortMode("newest");
  };

  return (
    <View style={styles.root}>
      <ScanlineOverlay />

      <PixelText
        size={14}
        color={cfPalette.purpleHot}
        uppercase
        glow
        style={styles.title}
      >
        the journal
      </PixelText>
      <PixelText size={7} color={cfPalette.ash} style={styles.subtitle}>
        Long-press a chat message to file it as a Fact.
      </PixelText>

      {hasFacts && (
        <PixelPanel variant="raised" style={styles.summary}>
          <SummaryStat label="facts" value={String(factsCount)} />
          <View style={styles.summaryDivider} />
          <SummaryStat label="suspects" value={String(suspectsCount)} />
        </PixelPanel>
      )}

      {hasFacts && (
        <JournalControls
          suspects={allGroups.map((g) => g.candidate)}
          selectedSuspectId={selectedSuspectId}
          onSelectSuspect={setSelectedSuspectId}
          sortMode={sortMode}
          onChangeSort={setSortMode}
        />
      )}

      {run && !run.closed && (
        <NeonButton
          label="Accuse A Suspect"
          variant="primary"
          size="md"
          fullWidth
          onPress={() => setAccuseOpen(true)}
          style={styles.accuseBtn}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {!hasFacts ? (
          <EmptyState hasMatches={matches.length > 0} />
        ) : filterHidEverything ? (
          <FilterEmptyState
            filterIsActive={filterIsActive}
            onClear={clearFilters}
          />
        ) : (
          groups.map((g) => (
            <SuspectGroup
              key={g.candidate.id}
              candidate={g.candidate}
              facts={g.facts}
              onDiscardFact={(id) => {
                void removeFact(id);
              }}
            />
          ))
        )}
      </ScrollView>

      {/*
        Phone shell already pads the system bottom inset, so the
        undo banner just sits a hair above the home indicator pill
        rather than re-applying the safe-area inset and getting
        pushed up twice.
      */}
      <UndoDiscardBanner bottomOffset={16} />

      <AccusationSheet
        visible={accuseOpen}
        onClose={() => setAccuseOpen(false)}
      />
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <PixelText size={14} color={cfPalette.pinkHot} glow>
        {value}
      </PixelText>
      <PixelText size={6} color={cfPalette.ash} uppercase style={styles.statLabel}>
        {label}
      </PixelText>
    </View>
  );
}

interface FilterEmptyStateProps {
  filterIsActive: boolean;
  onClear: () => void;
}

function FilterEmptyState({ filterIsActive, onClear }: FilterEmptyStateProps) {
  return (
    <PixelPanel variant="raised" style={styles.filterEmpty}>
      <PixelText size={9} color={cfPalette.cyan} uppercase glow align="center">
        no facts in view
      </PixelText>
      <PixelText
        size={7}
        color={cfPalette.bone}
        align="center"
        style={styles.filterEmptyBody}
      >
        {filterIsActive
          ? "The suspect chip at the top is filtering this view. Tap “All” — or tap the active chip again — to see every captured Fact."
          : "Adjust the filter chips above to bring captured Facts back into view."}
      </PixelText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clear journal filters"
        onPress={onClear}
        style={({ pressed }) => [
          styles.clearBtn,
          pressed && { opacity: 0.7 },
        ]}
      >
        <PixelText size={7} color={cfPalette.void} uppercase>
          clear filters
        </PixelText>
      </Pressable>
    </PixelPanel>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  title: { marginTop: 8 },
  subtitle: { marginTop: 6, marginBottom: 14 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  summaryDivider: {
    width: 2,
    alignSelf: "stretch",
    backgroundColor: cfPalette.purple,
    marginHorizontal: 14,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: { marginTop: 4 },
  accuseBtn: {
    marginBottom: 14,
  },
  list: {
    paddingBottom: Platform.OS === "web" ? 100 : 24,
  },
  filterEmpty: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: "center",
    marginTop: 12,
  },
  filterEmptyBody: {
    marginTop: 12,
    lineHeight: 13,
  },
  clearBtn: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: cfPalette.cyan,
    borderWidth: 2,
    borderColor: cfPalette.cyanHot,
  },
});
