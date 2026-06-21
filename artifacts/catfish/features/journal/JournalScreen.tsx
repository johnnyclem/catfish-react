/**
 * Journal screen body.
 *
 * Lifted from `app/(tabs)/journal.tsx` when Task #59 dropped the root
 * tab bar and made the parody phone home grid the main interface.
 *
 * P2 schema change: Journal now surfaces TWO classes of committed facts:
 *   - Authored (static/variable/conditional): auto-logged world facts,
 *     rendered in a flat chronological section below the header.
 *   - Captured: player-extracted quotes from chat, grouped by suspect
 *     via the existing SuspectGroup path.
 *
 * Summary strip shows captured / authored / suspects counts. Authored
 * facts have no discard affordance (world-logged). Captured facts can
 * be discarded via the ✕ chip on each FactCard.
 */

import { useEffect, useMemo, useState } from "react";
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
import { isFactRevealedYet } from "@/core/factBootstrap";
import { getIdentityModule } from "@/core/identities";
import { CaseRun, Candidate, CandidateId, Fact } from "@/core/models";
import { AccusationWizard } from "@/features/accusation/AccusationWizard";
import { paletteForEnding } from "@/features/accusation/EndOfRunCard";
import { FactCard } from "@/features/journal/FactCard";
import { EmptyState } from "@/features/journal/EmptyState";
import { usePhoneShell } from "@/features/parody/phoneShellState";
import {
  JournalControls,
  JournalSortMode,
} from "@/features/journal/JournalControls";
import { SuspectGroup } from "@/features/journal/SuspectGroup";
import { FactDetailView } from "@/features/journal/FactDetailView";
import { UndoDiscardBanner } from "@/features/journal/UndoDiscardBanner";
import { EvidenceChainBuilder } from "@/features/journal/EvidenceChainBuilder";

interface CandidateGroup {
  candidate: Candidate;
  facts: Fact[];
}

export function JournalScreen() {
  const run = useGameState((s) => s.run);
  const removeFact = useGameState((s) => s.removeFact);
  const reopenEnding = useGameState((s) => s.reopenEnding);
  const startNewRun = useGameState((s) => s.startNewRun);

  const [selectedSuspectId, setSelectedSuspectId_] =
    useState<CandidateId | null>(null);
  const [sortMode, setSortMode] = useState<JournalSortMode>("newest");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [chainBuilderOpen, setChainBuilderOpen] = useState(false);
  const [selectedFact, setSelectedFact] = useState<Fact | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  function setSelectedSuspectId(id: CandidateId | null) {
    setSelectedSuspectId_(id);
  }

  const journalFilterId = usePhoneShell((s) => s.journalFilterCandidateId);
  const setJournalFilter = usePhoneShell((s) => s.setJournalFilter);
  useEffect(() => {
    if (journalFilterId) {
      setSelectedSuspectId_(journalFilterId);
      setJournalFilter(undefined);
    }
  }, [journalFilterId, setJournalFilter]);

  const committed = useMemo<Fact[]>(
    () => (run?.facts ?? []).filter((f) => f.committed),
    [run?.facts],
  );

  const capturedFacts = useMemo<Fact[]>(
    () => committed.filter((f) => f.kind === "captured"),
    [committed],
  );

  // Authored facts go through the reveal gate so the Journal doesn't
  // dump the entire mystery at Day 1. The day floor plus source-based
  // reachability (bio/IG/portrait need deck/match progress) means clues
  // trickle in as the case unfolds.
  const authoredFacts = useMemo<Fact[]>(() => {
    if (!run) return [];
    const capturedIds = new Set(capturedFacts.map((f) => f.id));
    return committed.filter(
      (f) =>
        f.kind !== "captured" &&
        !capturedIds.has(f.id) &&
        isFactRevealedYet(f, run),
    );
  }, [run, committed, capturedFacts]);

  const capturedGroups = useMemo<CandidateGroup[]>(() => {
    if (!run) return [];
    const byCandidate = new Map<CandidateId, Fact[]>();
    for (const fact of capturedFacts) {
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
  }, [run, capturedFacts]);

  const filteredGroups = useMemo<CandidateGroup[]>(() => {
    const filtered =
      selectedSuspectId == null
        ? capturedGroups
        : capturedGroups.filter((g) => g.candidate.id === selectedSuspectId);

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
  }, [capturedGroups, selectedSuspectId, sortMode]);

  const sortedAuthored = useMemo<Fact[]>(() => {
    const sorted = [...authoredFacts];
    if (sortMode === "newest") {
      sorted.sort((a, b) => (b.day - a.day) || ((b.capturedAt ?? "")?.localeCompare(a.capturedAt ?? "") ?? 0));
    } else {
      sorted.sort((a, b) => a.day - b.day || ((a.capturedAt ?? "")?.localeCompare(b.capturedAt ?? "") ?? 0));
    }
    return sorted;
  }, [authoredFacts, sortMode]);

  const hasFacts = committed.length > 0;
  const hasCaptured = capturedFacts.length > 0;
  const hasAuthored = authoredFacts.length > 0;
  const matches = run?.matches ?? [];
  const capturedCount = capturedFacts.length;
  const authoredCount = authoredFacts.length;
  const suspectsCount = capturedGroups.length;
  const filterIsActive = selectedSuspectId !== null;
  const filterHidEverything = hasCaptured && filteredGroups.length === 0;
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
        Long-press a chat message to capture a Fact. Authored facts are
        auto-logged.
      </PixelText>

      {hasFacts && (
        <PixelPanel variant="raised" style={styles.summary}>
          <SummaryStat label="captured" value={String(capturedCount)} />
          <View style={styles.summaryDivider} />
          <SummaryStat label="authored" value={String(authoredCount)} />
          <View style={styles.summaryDivider} />
          <SummaryStat label="suspects" value={String(suspectsCount)} />
        </PixelPanel>
      )}

      {hasAuthored && (
        <View style={styles.authoredSection}>
          <View style={styles.authoredHeader}>
            <PixelText size={7} color={cfPalette.purpleHot} uppercase>
              authored facts
            </PixelText>
            <PixelText size={6} color={cfPalette.ash}>
              world-logged · not discardable
            </PixelText>
          </View>
          <View style={styles.authoredCards}>
            {sortedAuthored.map((f) => (
              <FactCard key={f.id} fact={f} onPress={setSelectedFact} />
            ))}
          </View>
        </View>
      )}

      {hasCaptured && (
        <JournalControls
          suspects={capturedGroups.map((g) => g.candidate)}
          selectedSuspectId={selectedSuspectId}
          onSelectSuspect={setSelectedSuspectId}
          sortMode={sortMode}
          onChangeSort={setSortMode}
        />
      )}

      {run && !run.closed && (
        <>
          <NeonButton
            label="Link Evidence"
            variant="secondary"
            size="sm"
            fullWidth
            onPress={() => setChainBuilderOpen(true)}
            style={styles.chainBtn}
          />
          <NeonButton
            label="Accuse A Suspect"
            variant="primary"
            size="md"
            fullWidth
            onPress={() => setWizardOpen(true)}
            style={styles.accuseBtn}
          />
        </>
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
          filteredGroups.map((g) => (
            <SuspectGroup
              key={g.candidate.id}
              candidate={g.candidate}
              facts={g.facts}
              onDiscardFact={(id) => {
                void removeFact(id);
              }}
              onPressFact={setSelectedFact}
            />
          ))
        )}
      </ScrollView>

      <UndoDiscardBanner bottomOffset={16} />

      <AccusationWizard
        visible={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />

      <EvidenceChainBuilder
        visible={chainBuilderOpen}
        onClose={() => setChainBuilderOpen(false)}
      />

      {selectedFact && (
        <FactDetailView
          fact={selectedFact}
          onClose={() => setSelectedFact(null)}
        />
      )}
    </View>
  );
}

interface ClosedRunPanelProps {
  run: CaseRun;
  busy: boolean;
  onViewRecap: () => void | Promise<void>;
  onStartNewCase: () => void | Promise<void>;
}

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
          ? "The suspect chip at the top is filtering this view. Tap \"All\" — or tap the active chip again — to see every captured Fact."
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
  subtitle: {
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 11,
  },
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
  authoredSection: {
    marginBottom: 14,
  },
  authoredHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingRight: 4,
  },
  authoredCards: {
    gap: 8,
  },
  chainBtn: {
    marginBottom: 8,
  },
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