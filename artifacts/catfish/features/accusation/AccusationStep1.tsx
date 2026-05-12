/**
 * AccusationStep1 — "Review Evidence"
 *
 * Step 1 of the guided accusation flow (PRD 10.5).
 * Shows a summary of all evidence chains the player has built,
 * plus an overall fact count.
 *
 * Navigation: Next → Step 2, Back → close wizard
 */

import { useMemo } from "react";
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
import { EvidenceChain, Fact } from "@/core/models";
import { getIdentityModule } from "@/core/identities";

interface AccusationStep1Props {
  onNext: () => void;
  onBack: () => void;
}

export function AccusationStep1({ onNext, onBack }: AccusationStep1Props) {
  const run = useGameState((s) => s.run);

  const { chains, facts, capturedCount, authoredCount } = useMemo(() => {
    if (!run) return { chains: [], facts: [], capturedCount: 0, authoredCount: 0 };
    const committed = run.facts.filter((f) => f.committed);
    return {
      chains: run.evidenceChains ?? [],
      facts: committed,
      capturedCount: committed.filter((f) => f.kind === "captured").length,
      authoredCount: committed.filter((f) => f.kind !== "captured").length,
    };
  }, [run]);

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
        review evidence
      </PixelText>
      <PixelText
        size={7}
        color={cfPalette.ash}
        align="center"
        style={styles.subhead}
      >
        Your case so far — chains and facts on record
      </PixelText>

      {/* Summary strip */}
      <PixelPanel variant="raised" style={styles.summary}>
        <SummaryStat label="chains" value={String(chains.length)} />
        <View style={styles.summaryDivider} />
        <SummaryStat label="captured" value={String(capturedCount)} />
        <View style={styles.summaryDivider} />
        <SummaryStat label="authored" value={String(authoredCount)} />
      </PixelPanel>

      {/* Chain list */}
      <ScrollView
        style={styles.chainList}
        contentContainerStyle={styles.chainListContent}
        showsVerticalScrollIndicator={false}
      >
        <PixelText
          size={7}
          color={cfPalette.purpleHot}
          uppercase
          style={styles.sectionLabel}
        >
          evidence chains
        </PixelText>

        {chains.length === 0 ? (
          <PixelPanel variant="default" style={styles.emptyChains}>
            <PixelText size={8} color={cfPalette.ash} align="center">
              No chains built yet.
            </PixelText>
            <PixelText
              size={7}
              color={cfPalette.fog}
              align="center"
              style={{ marginTop: 4 }}
            >
              Use "Link Evidence" in the Journal to connect facts.
            </PixelText>
          </PixelPanel>
        ) : (
          chains.map((chain) => (
            <ChainCard key={chain.id} chain={chain} facts={facts} />
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <NeonButton
          label="Back"
          variant="ghost"
          size="sm"
          onPress={onBack}
          style={styles.footerBtn}
        />
        <NeonButton
          label="Continue"
          variant="primary"
          size="md"
          onPress={onNext}
          style={styles.footerBtn}
        />
      </View>
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <PixelText size={14} color={cfPalette.pinkHot} glow>
        {value}
      </PixelText>
      <PixelText size={6} color={cfPalette.ash} uppercase style={{ marginTop: 4 }}>
        {label}
      </PixelText>
    </View>
  );
}

interface ChainCardProps {
  chain: EvidenceChain;
  facts: Fact[];
}

function ChainCard({ chain, facts }: ChainCardProps) {
  const factA = facts.find((f) => f.id === chain.factIdA);
  const factB = facts.find((f) => f.id === chain.factIdB);
  const suspectName = chain.aboutCandidate
    ? getIdentityModule(chain.aboutCandidate).displayName
    : null;

  return (
    <PixelPanel variant="default" style={styles.chainCard}>
      <View style={styles.chainHeader}>
        <PixelText size={6} color={cfPalette.cyan} uppercase>
          chain
        </PixelText>
        {suspectName && (
          <View style={styles.suspectChip}>
            <PixelText size={5} color={cfPalette.void} uppercase>
              → {suspectName}
            </PixelText>
          </View>
        )}
      </View>
      <PixelText size={8} color={cfPalette.bone} style={styles.chainLabel}>
        {chain.label}
      </PixelText>
      <View style={styles.factRefs}>
        {factA && (
          <PixelText size={6} color={cfPalette.ash}>
            {factA.kind === "captured"
              ? `"${factA.capturedQuote ?? ""}"`
              : `"${factA.payload.text ?? ""}"`}
          </PixelText>
        )}
        <PixelText size={8} color={cfPalette.purple}>
          →
        </PixelText>
        {factB && (
          <PixelText size={6} color={cfPalette.ash}>
            {factB.kind === "captured"
              ? `"${factB.capturedQuote ?? ""}"`
              : `"${factB.payload.text ?? ""}"`}
          </PixelText>
        )}
      </View>
    </PixelPanel>
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
  chainList: {
    flex: 1,
  },
  chainListContent: {
    gap: 10,
    paddingBottom: 8,
  },
  sectionLabel: {
    marginBottom: 4,
  },
  emptyChains: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  chainCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  chainHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  suspectChip: {
    backgroundColor: cfPalette.cyan,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chainLabel: {
    marginBottom: 8,
    lineHeight: 12,
  },
  factRefs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  footerBtn: {
    flex: 1,
  },
});