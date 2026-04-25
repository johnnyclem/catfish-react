/**
 * Tab 3 — Journal.
 *
 * Pass 3 surface: shows the case file the player has built up by
 * long-pressing chat messages to extract Facts. Facts are grouped
 * under the suspect they came from. Empty state explains the gesture
 * so it's discoverable before Pass 2's chat UI ships.
 *
 * Capture itself lives in `features/journal/MessageFactGesture.tsx`,
 * which Pass 2's chat UI wraps around each message bubble. The gesture
 * calls into `useGameState().commitFact`, which persists Facts to
 * AsyncStorage so the case file survives a cold start.
 *
 * Once a player has captured a lot of Facts the raw stack becomes
 * hard to scan, so the tab also exposes a per-suspect chip filter and
 * a sort toggle (newest first vs by day captured). These are purely
 * view-side — no schema changes.
 */

import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { Candidate, CandidateId, Fact } from "@/core/models";
import { EmptyState } from "@/features/journal/EmptyState";
import {
  JournalControls,
  JournalSortMode,
} from "@/features/journal/JournalControls";
import { SuspectGroup } from "@/features/journal/SuspectGroup";

interface CandidateGroup {
  candidate: Candidate;
  facts: Fact[];
}

export default function JournalTab() {
  const insets = useSafeAreaInsets();
  const run = useGameState((s) => s.run);
  const removeFact = useGameState((s) => s.removeFact);
  const topPad = Math.max(insets.top, Platform.OS === "web" ? 24 : 12);

  const [selectedSuspectId, setSelectedSuspectId] =
    useState<CandidateId | null>(null);
  const [sortMode, setSortMode] = useState<JournalSortMode>("newest");

  const committed = useMemo<Fact[]>(
    () =>
      (run?.facts ?? []).filter(
        (f) => f.committed && f.capturedFromCandidateId,
      ),
    [run?.facts],
  );

  // All groups *before* the suspect filter is applied — used both to
  // power the chip row and to detect when filtering hid everything.
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
      if (!candidate) continue; // Stale capture — skip silently.
      out.push({ candidate, facts });
    }
    return out;
  }, [run, committed]);

  // Apply the active sort + suspect filter on top of the raw groups.
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
        // "By day captured" — chronological: earliest day first, and
        // within a single day fall back to capturedAt ascending so the
        // order inside a day stays stable.
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
      // Suspect with the most recent capture floats to the top.
      sorted.sort((a, b) => {
        const ta = a.facts[0]?.capturedAt ?? "";
        const tb = b.facts[0]?.capturedAt ?? "";
        return tb.localeCompare(ta);
      });
    } else {
      // Suspect whose earliest captured fact lands first chronologically.
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
    <View style={[styles.root, { paddingTop: topPad }]}>
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
