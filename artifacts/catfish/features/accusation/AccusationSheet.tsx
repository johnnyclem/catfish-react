/**
 * AccusationSheet — overlay launched from the Journal's "Accuse"
 * button.
 *
 * Lists every candidate the player has met (every swiped-on entry
 * from the run's deck, with matched suspects floated to the top so
 * the player's actual leads are easiest to thumb-pick). Selecting one
 * arms the "File Accusation" CTA, which calls
 * `useGameState().accuse({ accused, outcome: "accuse" })`.
 *
 * The sheet also carries a "Skip Town" affordance — the same overlay
 * routes both run-end paths the player can hand-trigger (the Day 7
 * face-to-face is fired automatically by `advanceDay`). Skip Town
 * fires the resolver with `outcome: "escaped"`, which always reads
 * as `escapedStub` regardless of who's hovered.
 *
 * The sheet itself never renders the run-end card — it just calls
 * `accuse()` and dismisses. The card is mounted at the root layout
 * and lights up whenever `run.ending` is non-null.
 */

import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AssetImage } from "@/components/AssetImage";
import {
  NeonButton,
  PixelPanel,
  PixelText,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { Candidate, CandidateId } from "@/core/models";
import { emitSfx } from "@/features/audio/audioEvents";

interface AccusationSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface AccuseRow {
  candidate: Candidate;
  matched: boolean;
  dropped: boolean;
  factCount: number;
}

export function AccusationSheet({ visible, onClose }: AccusationSheetProps) {
  const run = useGameState((s) => s.run);
  const accuse = useGameState((s) => s.accuse);
  // Selection keys off the candidate id — NOT the legacy
  // `KillerIdentity` slot. Decoys don't carry an identity, and even
  // when they did (pre-audit), every decoy shared the killer's slot,
  // so selecting "Riley" would highlight every row at once and
  // auto-win the accusation. Keying on the candidate id makes each
  // row independently selectable and lets the gameStore decide
  // killer-vs-decoy from the candidate itself.
  const [selected, setSelected] = useState<CandidateId | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Build accusation rows from candidates the player has actually
  // swiped on (every deck entry up to `deckCursor`). Matches and
  // dropped matches both stay eligible — the case file you built up
  // doesn't disappear when you unmatch.
  const rows = useMemo<AccuseRow[]>(() => {
    if (!run) return [];
    // Every candidate the player has surfaced via the deck so far.
    const seen = run.deck.slice(0, run.deckCursor);
    const matchedIds = new Set(
      run.matches.filter((m) => !m.unmatched).map((m) => m.candidateId),
    );
    const droppedIds = new Set(
      run.matches.filter((m) => m.unmatched).map((m) => m.candidateId),
    );

    // Per-candidate captured-fact tally so the row can hint at how
    // much evidence the player actually filed against them. Keys off
    // `capturedFromCandidateId` (always unique per candidate) — the
    // older `aboutCharacter`-keyed map collapsed all decoys onto the
    // killer's slot because every decoy was stamped with that
    // identity, which made the badge useless.
    const factsByCandidate = new Map<CandidateId, number>();
    for (const f of run.facts) {
      if (!f.committed) continue;
      if (f.kind !== "captured") continue;
      const cid = f.capturedFromCandidateId;
      if (!cid) continue;
      factsByCandidate.set(cid, (factsByCandidate.get(cid) ?? 0) + 1);
    }

    const out: AccuseRow[] = seen.map((c) => ({
      candidate: c,
      matched: matchedIds.has(c.id),
      dropped: droppedIds.has(c.id) && !matchedIds.has(c.id),
      factCount: factsByCandidate.get(c.id) ?? 0,
    }));

    // Sort: live matches first, then dropped matches, then everyone
    // else. Within a tier, the candidate with the most filed facts
    // bubbles up — those are the leads the player has been working.
    out.sort((a, b) => {
      const tier = (r: AccuseRow) => (r.matched ? 0 : r.dropped ? 1 : 2);
      const dt = tier(a) - tier(b);
      if (dt !== 0) return dt;
      return b.factCount - a.factCount;
    });

    return out;
  }, [run]);

  const handleClose = () => {
    if (submitting) return;
    setSelected(null);
    onClose();
  };

  const submit = async (outcome: "accuse" | "escaped") => {
    if (submitting) return;
    if (outcome === "accuse" && !selected) return;
    setSubmitting(true);
    // Tense rising sting on commit — fires immediately so the player
    // hears the gravity of the choice before the EndOfRunCard
    // resolves and overlays its own win/lose sting on top.
    emitSfx("accuse");
    try {
      // The store's `accuse` action accepts a candidate id directly
      // and decides whether the candidate is the killer or a decoy.
      // For "escaped" we don't need an accusedCandidateId at all —
      // the resolver always returns `escapedStub`.
      if (outcome === "accuse" && selected) {
        await accuse({ accusedCandidateId: selected, outcome });
      } else {
        await accuse({ outcome });
      }
      // Card mounts at the root layout — just close ourselves and
      // let the overlay light up.
      setSelected(null);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!run) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityLabel="Close accusation sheet"
        />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <PixelPanel variant="raised" style={styles.sheet}>
            <PixelText
              size={12}
              color={cfPalette.pinkHot}
              uppercase
              glow
              align="center"
            >
              file an accusation
            </PixelText>
            <PixelText
              size={7}
              color={cfPalette.ash}
              align="center"
              style={styles.subhead}
            >
              Pick the suspect. There's no take-backs.
            </PixelText>

            {rows.length === 0 ? (
              <PixelText
                size={8}
                color={cfPalette.fog}
                align="center"
                style={{ marginTop: 16, lineHeight: 13 }}
              >
                You haven't met anyone yet.{"\n"}Swipe a few profiles before you
                accuse.
              </PixelText>
            ) : (
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
                      onPress={() => setSelected(r.candidate.id)}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          opacity: pressed ? 0.7 : 1,
                          borderColor: isSel
                            ? cfPalette.pinkHot
                            : cfPalette.purple,
                          backgroundColor: isSel
                            ? cfPalette.panelHi
                            : cfPalette.panel,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSel }}
                      accessibilityLabel={`Accuse ${r.candidate.displayName}`}
                      testID={`accuse-row-${r.candidate.id}`}
                    >
                      <AssetImage
                        id={
                          r.candidate.portraitAssetId ?? "A500_avatar_placeholder"
                        }
                        style={styles.avatar}
                        containerStyle={styles.avatar}
                        resizeMode="cover"
                      />
                      <View style={styles.rowBody}>
                        <PixelText
                          size={10}
                          color={cfPalette.bone}
                          uppercase
                        >
                          {r.candidate.displayName}
                        </PixelText>
                        <PixelText
                          size={6}
                          color={cfPalette.ash}
                          style={styles.rowMeta}
                          uppercase
                        >
                          {r.matched
                            ? "match"
                            : r.dropped
                              ? "dropped"
                              : "passed"}
                          {r.factCount > 0
                            ? `  ·  ${r.factCount} fact${r.factCount === 1 ? "" : "s"} filed`
                            : "  ·  no facts filed"}
                        </PixelText>
                      </View>
                      {isSel && (
                        <PixelText
                          size={9}
                          color={cfPalette.pinkHot}
                          glow
                        >
                          ✓
                        </PixelText>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.footer}>
              <NeonButton
                label={
                  submitting
                    ? "Filing…"
                    : selected
                      ? "File Accusation"
                      : "Pick A Suspect"
                }
                variant="primary"
                size="md"
                fullWidth
                disabled={!selected || submitting || rows.length === 0}
                onPress={() => {
                  void submit("accuse");
                }}
              />
              <View style={styles.footerRow}>
                <NeonButton
                  label="Skip Town"
                  variant="danger"
                  size="sm"
                  disabled={submitting}
                  onPress={() => {
                    void submit("escaped");
                  }}
                  style={styles.footerBtn}
                />
                <NeonButton
                  label="Cancel"
                  variant="ghost"
                  size="sm"
                  disabled={submitting}
                  onPress={handleClose}
                  style={styles.footerBtn}
                />
              </View>
            </View>
          </PixelPanel>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3,1,10,0.85)",
    justifyContent: "center",
    alignItems: "stretch",
    padding: Platform.OS === "web" ? 24 : 16,
  },
  sheetWrap: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  sheet: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    maxHeight: "100%",
  },
  subhead: {
    marginTop: 8,
    lineHeight: 11,
  },
  list: {
    marginTop: 14,
    maxHeight: 320,
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
  },
  rowMeta: {
    marginTop: 4,
    letterSpacing: 0.6,
  },
  footer: {
    marginTop: 18,
    gap: 10,
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
  },
  footerBtn: {
    flex: 1,
  },
});
