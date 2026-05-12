/**
 * AccusationStep3 — "Present Your Case"
 *
 * Step 3 of the guided accusation flow (PRD 10.5).
 * Player selects their top 3 evidence chains as "proof" before
 * filing the accusation. Shows the resolved outcome (full chain,
 * partial, weak) before the final submit.
 *
 * On submit: calls gameStore.accuse() with the accusedCandidateId
 * and dismisses the wizard.
 *
 * Navigation: Back → Step 2, Submit → accuse + close
 */

import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import {
  NeonButton,
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { CandidateId, EvidenceChain, Fact } from "@/core/models";
import { emitSfx } from "@/features/audio/audioEvents";
import { getIdentityModule } from "@/core/identities";

interface AccusationStep3Props {
  accusedCandidateId: CandidateId;
  onBack: () => void;
  onClose: () => void;
}

export function AccusationStep3({
  accusedCandidateId,
  onBack,
  onClose,
}: AccusationStep3Props) {
  const run = useGameState((s) => s.run);
  const accuse = useGameState((s) => s.accuse);
  const [selectedChainIds, setSelectedChainIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<"full" | "partial" | "weak" | null>(null);

  const accusedCandidate = useMemo(() => {
    if (!run) return null;
    return run.deck.find((c) => c.id === accusedCandidateId) ?? null;
  }, [run, accusedCandidateId]);

  const chains = useMemo<EvidenceChain[]>(() => run?.evidenceChains ?? [], [run]);
  const committedFacts = useMemo<Fact[]>(() => {
    if (!run) return [];
    return run.facts.filter((f) => f.committed);
  }, [run]);

  const candidateChains = useMemo(() => {
    return chains.filter((c) => {
      if (!c.aboutCandidate || !accusedCandidate) return false;
      return c.aboutCandidate === accusedCandidate.identity;
    });
  }, [chains, accusedCandidate]);

  const nonCandidateChains = useMemo(() => {
    return chains.filter((c) => {
      if (!c.aboutCandidate) return true;
      if (!accusedCandidate) return false;
      return c.aboutCandidate !== accusedCandidate.identity;
    });
  }, [chains, accusedCandidate]);

  const topChains = useMemo(() => {
    const all = [...candidateChains, ...nonCandidateChains].slice(0, 3);
    return all;
  }, [candidateChains, nonCandidateChains]);

  function toggleChain(chainId: string) {
    setSelectedChainIds((prev) => {
      const next = new Set(prev);
      if (next.has(chainId)) {
        next.delete(chainId);
      } else if (next.size < 3) {
        next.add(chainId);
      }
      return next;
    });
    setPreview(null);
  }

  function getPreviewOutcome(): "full" | "partial" | "weak" | null {
    if (!run || selectedChainIds.size === 0) return null;
    const truthIdentity = getIdentityModule(run.killer);
    const deduction = truthIdentity.solvingDeduction;
    if (!deduction) return "weak";

    const selectedFactIds = new Set<string>();
    for (const chain of chains) {
      if (selectedChainIds.has(chain.id)) {
        selectedFactIds.add(chain.factIdA);
        selectedFactIds.add(chain.factIdB);
      }
    }

    let matchCount = 0;
    for (const fid of deduction.requiredFactIDs) {
      if (selectedFactIds.has(fid)) matchCount++;
    }

    const ratio = matchCount / deduction.requiredFactIDs.length;
    if (ratio >= 0.8) return "full";
    if (ratio >= 0.3) return "partial";
    return "weak";
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    emitSfx("accuse");
    try {
      await accuse({ accusedCandidateId, outcome: "accuse" });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const previewOutcome = getPreviewOutcome();
  const canSubmit = selectedChainIds.size > 0 && !submitting;

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
        present your case
      </PixelText>
      <PixelText
        size={7}
        color={cfPalette.ash}
        align="center"
        style={styles.subhead}
      >
        Pick up to 3 evidence chains as proof
      </PixelText>

      {accusedCandidate && (
        <PixelPanel variant="raised" style={styles.targetPanel}>
          <PixelText size={6} color={cfPalette.ash} uppercase>
            accusing
          </PixelText>
          <PixelText size={12} color={cfPalette.bone} uppercase style={{ marginTop: 2 }}>
            {accusedCandidate.displayName}
          </PixelText>
        </PixelPanel>
      )}

      <ScrollView
        style={styles.chainList}
        contentContainerStyle={styles.chainListContent}
        showsVerticalScrollIndicator={false}
      >
        {chains.length === 0 ? (
          <PixelPanel variant="default" style={styles.emptyChains}>
            <PixelText size={8} color={cfPalette.ash} align="center">
              No chains on record. You can still file your accusation.
            </PixelText>
          </PixelPanel>
        ) : (
          chains.map((chain) => {
            const isSelected = selectedChainIds.has(chain.id);
            const isTopChain = topChains.some((c) => c.id === chain.id);
            const aboutName = chain.aboutCandidate
              ? getIdentityModule(chain.aboutCandidate).displayName
              : null;

            return (
              <Pressable
                key={chain.id}
                onPress={() => toggleChain(chain.id)}
                style={({ pressed }) => [
                  styles.chainRow,
                  pressed && { opacity: 0.7 },
                  isSelected && { borderColor: cfPalette.pinkHot, backgroundColor: cfPalette.panelHi },
                  isTopChain && !isSelected && { borderColor: cfPalette.cyan, borderStyle: "dashed" },
                ]}
              >
                <View style={[styles.chainCheck, isSelected && styles.chainCheckActive]}>
                  {isSelected && (
                    <PixelText size={8} color={cfPalette.void}>
                      ✓
                    </PixelText>
                  )}
                </View>
                <View style={styles.chainBody}>
                  <View style={styles.chainHeader}>
                    <PixelText size={7} color={cfPalette.bone}>
                      {chain.label}
                    </PixelText>
                    {aboutName && (
                      <View style={styles.suspectBadge}>
                        <PixelText size={5} color={cfPalette.void} uppercase>
                          {aboutName}
                        </PixelText>
                      </View>
                    )}
                  </View>
                  {isTopChain && (
                    <PixelText size={5} color={cfPalette.cyan} uppercase>
                      ⭐ key chain
                    </PixelText>
                  )}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {previewOutcome && (
        <PixelPanel variant="raised" style={styles.outcomePreview}>
          <PixelText size={6} color={cfPalette.ash} uppercase>
            case strength preview
          </PixelText>
          <PixelText
            size={9}
            color={
              previewOutcome === "full" ? cfPalette.cyan :
              previewOutcome === "partial" ? cfPalette.cyanHot :
              cfPalette.redHot
            }
            uppercase
            glow={previewOutcome !== "weak"}
            style={{ marginTop: 4 }}
          >
            {previewOutcome === "full" ? "full evidence — case verified" :
             previewOutcome === "partial" ? "partial evidence" :
             "weak case — proceed with caution"}
          </PixelText>
        </PixelPanel>
      )}

      <View style={styles.footer}>
        <NeonButton
          label="Back"
          variant="ghost"
          size="sm"
          disabled={submitting}
          onPress={onBack}
          style={styles.footerBtn}
        />
        <NeonButton
          label={submitting ? "Filing…" : "File Accusation"}
          variant="primary"
          size="md"
          disabled={!canSubmit}
          onPress={() => { void handleSubmit(); }}
          style={styles.footerBtn}
        />
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
    marginBottom: 12,
    lineHeight: 11,
  },
  targetPanel: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  chainList: {
    flex: 1,
  },
  chainListContent: {
    gap: 8,
    paddingBottom: 4,
  },
  emptyChains: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  chainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
    borderWidth: 2,
    borderColor: cfPalette.fog,
    gap: 10,
    backgroundColor: cfPalette.panel,
  },
  chainCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: cfPalette.fog,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  chainCheckActive: {
    backgroundColor: cfPalette.pinkHot,
    borderColor: cfPalette.pinkHot,
  },
  chainBody: {
    flex: 1,
    gap: 4,
  },
  chainHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  suspectBadge: {
    backgroundColor: cfPalette.cyan,
    paddingHorizontal: 5,
    paddingVertical: 1,
    flexShrink: 0,
  },
  outcomePreview: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
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