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
 */

import { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
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

  const committed = useMemo<Fact[]>(
    () =>
      (run?.facts ?? []).filter(
        (f) => f.committed && f.capturedFromCandidateId,
      ),
    [run?.facts],
  );

  const groups = useMemo<CandidateGroup[]>(() => {
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
      // Sort facts newest-first within a suspect block.
      const sorted = [...facts].sort((a, b) =>
        (b.capturedAt ?? "").localeCompare(a.capturedAt ?? ""),
      );
      out.push({ candidate, facts: sorted });
    }

    // Stable ordering: most recent capture activity first so the
    // suspect the player just filed against bubbles to the top.
    out.sort((a, b) => {
      const ta = a.facts[0]?.capturedAt ?? "";
      const tb = b.facts[0]?.capturedAt ?? "";
      return tb.localeCompare(ta);
    });
    return out;
  }, [run, committed]);

  const hasFacts = committed.length > 0;
  const matches = run?.matches ?? [];
  const factsCount = committed.length;
  const suspectsCount = groups.length;

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

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {hasFacts ? (
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
        ) : (
          <EmptyState hasMatches={matches.length > 0} />
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
});
