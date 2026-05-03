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
import { router } from "expo-router";

import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { getIdentityModule } from "@/core/identities";
import { CaseRun, Candidate, CandidateId, Fact } from "@/core/models";
import { AccusationSheet } from "@/features/accusation/AccusationSheet";
import { paletteForEnding } from "@/features/accusation/EndOfRunCard";
import { EmptyState } from "@/features/journal/EmptyState";
import { usePhoneShell } from "@/features/parody/phoneShellState";
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
  const reopenEnding = useGameState((s) => s.reopenEnding);
  const startNewRun = useGameState((s) => s.startNewRun);

  const [selectedSuspectId, setSelectedSuspectId] =
    useState<CandidateId | null>(null);
  const [sortMode, setSortMode] = useState<JournalSortMode>("newest");
  const [accuseOpen, setAccuseOpen] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

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

      {run && run.closed && (
        <ClosedRunPanel
          run={run}
          busy={recoveryBusy}
          onViewRecap={async () => {
            if (recoveryBusy) return;
            setRecoveryBusy(true);
            try {
              await reopenEnding();
            } finally {
              setRecoveryBusy(false);
            }
          }}
          onStartNewCase={async () => {
            if (recoveryBusy) return;
            setRecoveryBusy(true);
            try {
              await startNewRun();
              // Mirror EndOfRunCard.handleNewCase exactly so the two
              // entry points stay in lockstep: reset the shell to the
              // home grid, seed the dating-app's inner view back to
              // splash, then route to /home. The home indicator pill
              // will then read as enabled again, and tapping the
              // Lots 'o Fish tile lands the player on the splash.
              const shell = usePhoneShell.getState();
              shell.goHome();
              shell.setLotsOfFishView("splash");
              router.replace("/home" as never);
            } finally {
              setRecoveryBusy(false);
            }
          }}
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

interface ClosedRunPanelProps {
  run: CaseRun;
  busy: boolean;
  onViewRecap: () => void | Promise<void>;
  onStartNewCase: () => void | Promise<void>;
}

/**
 * Task #68 — recovery panel rendered in place of the "Accuse A
 * Suspect" button when the case has already closed (player accused
 * already, or the Day 7 face-to-face fired). Without this the player
 * could land on the Journal post-accusation with zero in-screen exits
 * — the Accuse button hid itself, the EndOfRunCard had been dismissed,
 * and the only escape was the bone home-indicator pill at the bottom.
 *
 * The panel always offers two unambiguous routes out:
 *   - View Case Recap → re-mounts the EndOfRunCard via reopenEnding
 *     (only when an `ending` payload is still on the run; legacy
 *     pre-#68 dismissals nulled `ending`, so we hide the button in
 *     that case rather than crash the overlay).
 *   - Start New Case → wipes the run and lands on Lots 'o Fish.
 */
function ClosedRunPanel({
  run,
  busy,
  onViewRecap,
  onStartNewCase,
}: ClosedRunPanelProps) {
  const truthName = getIdentityModule(run.killer).displayName;
  const palette = run.ending
    ? paletteForEnding(run.ending.ending, truthName)
    : null;
  const canViewRecap = !!run.ending;

  return (
    <View testID="journal-closed-run-panel">
    <PixelPanel
      variant="raised"
      borderColor={palette?.accent ?? cfPalette.fog}
      style={styles.closedPanel}
    >
      <PixelText
        size={7}
        color={cfPalette.ash}
        uppercase
        align="center"
        style={styles.closedKicker}
      >
        case sealed · day {run.day}
      </PixelText>
      <PixelText
        size={14}
        color={palette?.accent ?? cfPalette.fog}
        uppercase
        glow
        align="center"
        style={styles.closedTitle}
      >
        {palette?.title ?? "case closed"}
      </PixelText>
      {palette ? (
        <PixelText
          size={7}
          color={cfPalette.bone}
          align="center"
          style={styles.closedSubhead}
        >
          {palette.subhead}
        </PixelText>
      ) : (
        <PixelText
          size={7}
          color={cfPalette.bone}
          align="center"
          style={styles.closedSubhead}
        >
          This case is over. Start a new one to play again.
        </PixelText>
      )}

      <View style={styles.closedActions}>
        {canViewRecap ? (
          <NeonButton
            label="View Case Recap"
            variant="primary"
            size="md"
            fullWidth
            disabled={busy}
            onPress={() => {
              void onViewRecap();
            }}
          />
        ) : null}
        <NeonButton
          label="Start New Case"
          variant={canViewRecap ? "ghost" : "primary"}
          size="md"
          fullWidth
          disabled={busy}
          onPress={() => {
            void onStartNewCase();
          }}
        />
      </View>
    </PixelPanel>
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
  closedPanel: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  closedKicker: {
    letterSpacing: 1.5,
  },
  closedTitle: {
    marginTop: 6,
    letterSpacing: 1.5,
  },
  closedSubhead: {
    marginTop: 8,
    lineHeight: 12,
  },
  closedActions: {
    marginTop: 14,
    gap: 10,
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
