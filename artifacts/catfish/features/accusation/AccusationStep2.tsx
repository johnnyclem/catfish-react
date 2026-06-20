/**
 * AccusationStep2 — "Name the Killer"
 *
 * Step 2 of the guided accusation flow (PRD 10.5 + 10.4).
 * Shows the character picker with evidence strength per candidate.
 * Includes the evidence strength indicator bar (0-100%) with a
 * warning when evidence is below 30%.
 *
 * Navigation: Next (with selected) → Step 3, Back → Step 1
 */

import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AssetImage } from "@/components/AssetImage";
import {
  NeonButton,
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { Candidate, CandidateId, FactId } from "@/core/models";

interface AccusationStep2Props {
  onNext: (selectedId: CandidateId) => void;
  onBack: () => void;
}

interface AccuseRow {
  candidate: Candidate;
  matched: boolean;
  dropped: boolean;
  factCount: number;
  chainCount: number;
  evidenceStrength: number;
  strongFacts: number;
  contradictionFacts: number;
  unexplainedFacts: number;
}

const STRENGTH_THRESHOLD = 30;

export function AccusationStep2({ onNext, onBack }: AccusationStep2Props) {
  const run = useGameState((s) => s.run);
  const [selected, setSelected] = useState<CandidateId | null>(null);
  const [acknowledgedWeak, setAcknowledgedWeak] = useState(false);

  const rows = useMemo<AccuseRow[]>(() => {
    if (!run) return [];
    const seen = run.deck.slice(0, run.deckCursor);
    const matchedIds = new Set(
      run.matches.filter((m) => !m.unmatched).map((m) => m.candidateId),
    );
    const droppedIds = new Set(
      run.matches.filter((m) => m.unmatched).map((m) => m.candidateId),
    );

    // Map candidate id → killer identity for chain matching
    const identityByCandidate = new Map<CandidateId, string>();
    for (const cd of run.deck) {
      if (cd.isKillerCandidate && cd.identity) {
        identityByCandidate.set(cd.id, cd.identity);
      }
    }

    // Build a set of all fact ids that appear in any chain
    const chainedFactIds = new Set<FactId>();
    // Map fact id → the aboutCandidate of its chain
    const chainAboutByFactId = new Map<FactId, string | undefined>();
    for (const c of run.evidenceChains ?? []) {
      chainedFactIds.add(c.factIdA);
      chainedFactIds.add(c.factIdB);
      chainAboutByFactId.set(c.factIdA, c.aboutCandidate);
      chainAboutByFactId.set(c.factIdB, c.aboutCandidate);
    }

    // Per-candidate fact lists
    const factsByCandidate = new Map<CandidateId, FactId[]>();
    for (const f of run.facts) {
      if (!f.committed) continue;
      if (f.kind !== "captured") continue;
      const cid = f.capturedFromCandidateId;
      if (!cid) continue;
      const list = factsByCandidate.get(cid) ?? [];
      list.push(f.id);
      factsByCandidate.set(cid, list);
    }

    const chainsByCandidate = new Map<CandidateId, number>();
    for (const c of run.evidenceChains ?? []) {
      if (!c.aboutCandidate) continue;
      const cid = run.deck.find(
        (cd) => cd.isKillerCandidate && cd.identity === c.aboutCandidate,
      )?.id;
      if (cid) {
        chainsByCandidate.set(cid, (chainsByCandidate.get(cid) ?? 0) + 1);
      }
    }

    const out: AccuseRow[] = seen.map((c) => {
      const fCount = factsByCandidate.get(c.id)?.length ?? 0;
      const chCount = chainsByCandidate.get(c.id) ?? 0;
      const totalEvidence = fCount + chCount * 2;
      const strength = Math.min(100, totalEvidence * 12);

      // Breakdown: strong / contradiction / unexplained
      const candidateFacts = factsByCandidate.get(c.id) ?? [];
      const myIdentity = identityByCandidate.get(c.id);
      let strong = 0;
      let contradiction = 0;
      let unexplained = 0;
      for (const fid of candidateFacts) {
        if (!chainedFactIds.has(fid)) {
          unexplained++;
        } else {
          const chainAbout = chainAboutByFactId.get(fid);
          if (chainAbout && chainAbout === myIdentity) {
            strong++;
          } else {
            contradiction++;
          }
        }
      }

      return {
        candidate: c,
        matched: matchedIds.has(c.id),
        dropped: droppedIds.has(c.id) && !matchedIds.has(c.id),
        factCount: fCount,
        chainCount: chCount,
        evidenceStrength: strength,
        strongFacts: strong,
        contradictionFacts: contradiction,
        unexplainedFacts: unexplained,
      };
    });

    out.sort((a, b) => {
      const tier = (r: AccuseRow) => (r.matched ? 0 : r.dropped ? 1 : 2);
      const dt = tier(a) - tier(b);
      if (dt !== 0) return dt;
      return b.evidenceStrength - a.evidenceStrength;
    });

    return out;
  }, [run]);

  const selectedRow = rows.find((r) => r.candidate.id === selected);
  const isWeak = selectedRow ? selectedRow.evidenceStrength < STRENGTH_THRESHOLD : false;

  function handleNext() {
    if (!selected) return;
    if (isWeak && !acknowledgedWeak) {
      setAcknowledgedWeak(true);
      return;
    }
    onNext(selected);
  }

  return (
    <View style={styles.root}>
      <ScanlineOverlay intensity={0.04} step={4} />
      <PixelText
        size={14}
        color={cfPalette.pinkHot}
        uppercase
        glow
        align="center"
      >
        name the killer
      </PixelText>
      <PixelText
        size={7}
        color={cfPalette.ash}
        align="center"
        style={styles.subhead}
      >
        Tap a suspect to select them. There's no take-backs.
      </PixelText>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((r) => {
          const isSel = selected === r.candidate.id;
          return (
            <Pressable
              key={r.candidate.id}
              testID={`accuse-row-${r.candidate.id}`}
              onPress={() => {
                setSelected(r.candidate.id);
                setAcknowledgedWeak(false);
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  opacity: pressed ? 0.7 : 1,
                  borderColor: isSel ? cfPalette.pinkHot : cfPalette.purple,
                  backgroundColor: isSel ? cfPalette.panelHi : cfPalette.panel,
                },
              ]}
            >
              <AssetImage
                id={r.candidate.portraitAssetId ?? "A500_avatar_placeholder"}
                style={styles.avatar}
                containerStyle={styles.avatar}
                resizeMode="cover"
              />
              <View style={styles.rowBody}>
                <PixelText size={10} color={cfPalette.bone} uppercase>
                  {r.candidate.displayName}
                </PixelText>
                <PixelText
                  size={6}
                  color={cfPalette.ash}
                  style={styles.rowMeta}
                  uppercase
                >
                  {r.matched ? "match" : r.dropped ? "dropped" : "passed"}
                  {r.factCount > 0 ? `  ·  ${r.factCount} fact${r.factCount === 1 ? "" : "s"}` : "  ·  no facts"}
                  {r.chainCount > 0 ? `  ·  ${r.chainCount} chain${r.chainCount === 1 ? "" : "s"}` : ""}
                </PixelText>
                {r.factCount > 0 && (
                  <EvidenceBreakdownBar
                    strong={r.strongFacts}
                    contradiction={r.contradictionFacts}
                    unexplained={r.unexplainedFacts}
                    compact
                  />
                )}
              </View>
              {isSel && (
                <PixelText size={9} color={cfPalette.pinkHot} glow>
                  ✓
                </PixelText>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {selected && isWeak && (
        <View style={styles.warningBanner}>
          <PixelText size={7} color={cfPalette.redHot} align="center" uppercase>
            ⚠ low evidence — you don't have much to go on. Are you sure?
          </PixelText>
        </View>
      )}

      <View style={styles.footer}>
        <NeonButton
          label="Back"
          variant="ghost"
          size="sm"
          onPress={onBack}
          style={styles.footerBtn}
        />
        <NeonButton
          label={
            selected
              ? isWeak && !acknowledgedWeak
                ? "Proceed Anyway"
                : "Continue"
              : "Pick A Suspect"
          }
          variant="primary"
          size="md"
          disabled={!selected}
          onPress={handleNext}
          style={styles.footerBtn}
          testID="accuse-step2-continue"
        />
      </View>
    </View>
  );
}

interface EvidenceBreakdownBarProps {
  strong: number;
  contradiction: number;
  unexplained: number;
  compact?: boolean;
}

function EvidenceBreakdownBar({
  strong,
  contradiction,
  unexplained,
  compact,
}: EvidenceBreakdownBarProps) {
  const total = strong + contradiction + unexplained;
  if (total === 0) return null;

  return (
    <View style={[styles.evidenceBar, compact && styles.evidenceBarCompact]}>
      <View style={styles.breakdownTrack}>
        {strong > 0 && (
          <View
            style={[
              styles.breakdownSegment,
              {
                flex: strong,
                backgroundColor: cfPalette.cyan,
              },
            ]}
          />
        )}
        {contradiction > 0 && (
          <View
            style={[
              styles.breakdownSegment,
              {
                flex: contradiction,
                backgroundColor: cfPalette.redHot,
              },
            ]}
          />
        )}
        {unexplained > 0 && (
          <View
            style={[
              styles.breakdownSegment,
              {
                flex: unexplained,
                backgroundColor: cfPalette.iron,
              },
            ]}
          />
        )}
      </View>
      <View style={styles.breakdownLegend}>
        {strong > 0 && (
          <PixelText size={4} color={cfPalette.cyan} uppercase>
            {strong}s
          </PixelText>
        )}
        {contradiction > 0 && (
          <PixelText size={4} color={cfPalette.redHot} uppercase>
            {contradiction}c
          </PixelText>
        )}
        {unexplained > 0 && (
          <PixelText size={4} color={cfPalette.iron} uppercase>
            {unexplained}u
          </PixelText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
  },
  subhead: {
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 11,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 8,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderWidth: 2,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowMeta: {
    letterSpacing: 0.6,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  footerBtn: {
    flex: 1,
  },
  warningBanner: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: cfPalette.panelHi,
    borderWidth: 1,
    borderColor: cfPalette.redHot,
  },
  evidenceBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  evidenceBarCompact: {
    marginTop: 2,
  },
  breakdownTrack: {
    flex: 1,
    height: 4,
    flexDirection: "row",
    borderRadius: 2,
    overflow: "hidden",
    gap: 1,
  },
  breakdownSegment: {
    height: "100%",
    borderRadius: 1,
  },
  breakdownLegend: {
    flexDirection: "row",
    gap: 4,
  },
});