/**
 * SuspectBoardScreen — case-board view of all suspects for the current run.
 *
 * Renders the full authored cast (killer + decoys) as a scrollable 2-column
 * grid of suspect cards. Each card shows the candidate's portrait, display
 * name, and a risk level derived from the number of committed facts captured
 * FROM that candidate.
 *
 * Lives inside the Journal app as the "Suspects" section. Tapping a card
 * pre-filters the Journal's Notes section by that candidate and flips the
 * section pill back to Notes so the player drops straight into that
 * suspect's captured-fact list.
 *
 * Matched-but-dropped candidates show a "dropped" chip on their card.
 *
 * The board is accessible even when the case is closed — the player can
 * study the board after the run ends to review how close they got.
 */

import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AssetImage } from "@/components/AssetImage";
import {
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { isFactRevealedYet } from "@/core/factBootstrap";
import { Candidate, CandidateId } from "@/core/models";
import { usePhoneShell } from "@/features/parody/phoneShellState";

interface SuspectCardProps {
  candidate: Candidate;
  factCount: number;
  matchId: string | null;
  isDropped: boolean;
  hasThread: boolean;
  onTap: (candidateId: CandidateId, threadId: string | null) => void;
}

function SuspectCard({
  candidate,
  factCount,
  matchId,
  isDropped,
  hasThread,
  onTap,
}: SuspectCardProps) {
  const riskLevel = computeRisk(factCount);

  return (
    <Pressable
      onPress={() => onTap(candidate.id, matchId)}
      style={({ pressed }) => [
        styles.cardPress,
        pressed && { opacity: 0.75 },
        isDropped && { opacity: 0.55 },
      ]}
    >
      <PixelPanel variant="raised" style={styles.card}>
        <View style={styles.portraitWrap}>
          <AssetImage
            id={candidate.portraitAssetId ?? "A500_avatar_placeholder"}
            style={styles.portrait}
            containerStyle={styles.portrait}
            resizeMode="cover"
          />
        </View>
        <PixelText
          size={9}
          color={cfPalette.bone}
          uppercase
          align="center"
          style={styles.name}
          
        >
          {candidate.displayName}
        </PixelText>

        {isDropped && (
          <View style={styles.droppedChip}>
            <PixelText size={5} color={cfPalette.fog} uppercase>
              dropped
            </PixelText>
          </View>
        )}

        <RiskMeter level={riskLevel} />

        <PixelText size={5} color={cfPalette.ash} uppercase style={styles.tapHint}>
          tap to review ▸
        </PixelText>
      </PixelPanel>
    </Pressable>
  );
}

type RiskLevel = "unknown" | "low" | "elevated" | "high";

function computeRisk(factCount: number): RiskLevel {
  if (factCount === 0) return "unknown";
  if (factCount <= 2) return "low";
  if (factCount <= 5) return "elevated";
  return "high";
}

const RISK_COLORS: Record<RiskLevel, string> = {
  unknown: cfPalette.iron,
  low: cfPalette.cyan,
  elevated: cfPalette.cyanHot,
  high: cfPalette.redHot,
};

const RISK_LABELS: Record<RiskLevel, string> = {
  unknown: "???",
  low: "low",
  elevated: "elevated",
  high: "high",
};

function RiskMeter({ level }: { level: RiskLevel }) {
  const color = RISK_COLORS[level];
  return (
    <View style={styles.riskMeter}>
      <PixelText size={5} color={color} uppercase style={styles.riskLabel}>
        risk
      </PixelText>
      <View style={styles.riskBar}>
        {(["unknown", "low", "elevated", "high"] as RiskLevel[]).map((l, i) => (
          <View
            key={l}
            style={[
              styles.riskSegment,
              {
                backgroundColor:
                  i <= (["unknown", "low", "elevated", "high"] as RiskLevel[]).indexOf(level)
                    ? color
                    : cfPalette.iron,
              },
            ]}
          />
        ))}
      </View>
      <PixelText size={6} color={color} uppercase style={styles.riskLevel}>
        {RISK_LABELS[level]}
      </PixelText>
    </View>
  );
}

export function SuspectBoardScreen() {
  const run = useGameState((s) => s.run);
  const setJournalSection = usePhoneShell((s) => s.setJournalSection);
  const setJournalFilter = usePhoneShell((s) => s.setJournalFilter);

  const { candidates, matchInfo, factCounts } = useMemo<{
    candidates: Candidate[];
    matchInfo: Record<
      CandidateId,
      { matchId: string; threadId: string | null; isDropped: boolean }
    >;
    factCounts: Record<CandidateId, number>;
  }>(() => {
    if (!run) return { candidates: [], matchInfo: {}, factCounts: {} };
    const counts: Record<CandidateId, number> = {};
    for (const f of run.facts) {
      if (!f.committed || !f.capturedFromCandidateId) continue;
      // Mirror the Journal's reveal gate so the risk meter doesn't
      // leak a high-risk reading from facts the player can't actually
      // see yet.
      if (!isFactRevealedYet(f, run)) continue;
      counts[f.capturedFromCandidateId] = (counts[f.capturedFromCandidateId] ?? 0) + 1;
    }
    const info: Record<
      CandidateId,
      { matchId: string; threadId: string | null; isDropped: boolean }
    > = {};
    for (const m of run.matches) {
      const thread = run.threads.find((t) => t.id === m.threadId);
      info[m.candidateId] = {
        matchId: m.id,
        threadId: thread ? thread.id : null,
        isDropped: m.unmatched,
      };
    }
    return { candidates: run.deck, matchInfo: info, factCounts: counts };
  }, [run]);

  function handleCardTap(candidateId: CandidateId, _threadId: string | null) {
    setJournalFilter(candidateId);
    setJournalSection("notes");
  }

  if (!run) {
    return (
      <View style={styles.root}>
        <ScanlineOverlay />
        <View style={styles.empty}>
          <PixelText size={9} color={cfPalette.ash} align="center">
            No active case.
          </PixelText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <PixelText size={14} color={cfPalette.redHot} uppercase glow style={styles.title}>
        suspect board
      </PixelText>
      <PixelText size={7} color={cfPalette.ash} style={styles.subtitle}>
        {run.closed
          ? `Case sealed · day ${run.day}`
          : `Day ${run.day} · ${run.matches.length} match${run.matches.length === 1 ? "" : "es"}`}
      </PixelText>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {candidates.map((c) => {
          const info = matchInfo[c.id];
          return (
            <SuspectCard
              key={c.id}
              candidate={c}
              factCount={factCounts[c.id] ?? 0}
              matchId={info?.matchId ?? null}
              isDropped={info?.isDropped ?? false}
              hasThread={info?.threadId != null}
              onTap={handleCardTap}
            />
          );
        })}
      </ScrollView>
    </View>
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
  subtitle: { marginTop: 6, marginBottom: 16 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 24,
  },
  cardPress: {
    width: "47.5%",
  },
  card: {
    padding: 12,
    alignItems: "center",
  },
  portraitWrap: {
    width: 64,
    height: 64,
    marginBottom: 8,
  },
  portrait: {
    width: 64,
    height: 64,
  },
  name: { marginBottom: 6 },
  droppedChip: {
    marginBottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: cfPalette.fog,
  },
  riskMeter: {
    alignItems: "center",
    gap: 4,
    alignSelf: "stretch",
  },
  riskLabel: { letterSpacing: 1 },
  riskBar: {
    flexDirection: "row",
    gap: 3,
  },
  riskSegment: {
    width: 18,
    height: 4,
    borderRadius: 2,
  },
  riskLevel: {
    letterSpacing: 1,
  },
  tapHint: {
    marginTop: 8,
    letterSpacing: 0.5,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
});