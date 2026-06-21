/**
 * EvidenceChainBuilder — Phase 10.2 modal for linking two facts
 * into an evidence chain.
 *
 * Two-phase UX:
 *   1. Select Fact A  →  2. Select Fact B  →  Link button activates
 *
 * On valid link (both facts form a pre-authored chain):
 *   - Visual "click" feedback + SFX + success toast
 *   - Chain saved to `run.evidenceChains`
 *   - Modal dismisses
 *
 * On invalid link (no chain definition matches):
 *   - Error toast "These facts don't connect"
 *   - Selection resets so the player can try again
 *
 * On cancel / backdrop: modal dismisses, no state change.
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
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { isFactRevealedYet } from "@/core/factBootstrap";
import { useGameState } from "@/core/gameStore";
import { Fact, FactId } from "@/core/models";
import { emitSfx } from "@/features/audio/audioEvents";

interface EvidenceChainBuilderProps {
  visible: boolean;
  onClose: () => void;
}

interface FactChip {
  fact: Fact;
  selectedSlot: "A" | "B" | null;
  onSelect: (factId: FactId) => void;
}

type SelectionPhase = "pickA" | "pickB";

export function EvidenceChainBuilder({
  visible,
  onClose,
}: EvidenceChainBuilderProps) {
  const run = useGameState((s) => s.run);
  const buildChain = useGameState((s) => s.buildChain);

  const [phase, setPhase] = useState<SelectionPhase>("pickA");
  const [factA, setFactA] = useState<Fact | null>(null);
  const [factB, setFactB] = useState<Fact | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  // Only facts the player has actually been shown — the same reveal
  // gate the Journal uses. Without it the builder lists day-5 portrait
  // tells on day 1 and spoils the whole case.
  const committedFacts = useMemo<Fact[]>(() => {
    if (!run) return [];
    return run.facts.filter((f) => f.committed && isFactRevealedYet(f, run));
  }, [run]);

  const existingChainPairs = useMemo(() => {
    if (!run) return new Set<string>();
    const pairs = new Set<string>();
    for (const c of run.evidenceChains ?? []) {
      pairs.add(`${c.factIdA}::${c.factIdB}`);
    }
    return pairs;
  }, [run]);

  function handleFactSelect(fact: Fact) {
    if (phase === "pickA") {
      setFactA(fact);
      setFactB(null);
      setPhase("pickB");
      setErrorToast(null);
    } else {
      if (fact.id === factA?.id) {
        setErrorToast("Pick a different fact for slot B");
        setTimeout(() => setErrorToast(null), 2000);
        return;
      }
      setFactB(fact);
    }
  }

  function resetForRetry() {
    setFactA(null);
    setFactB(null);
    setPhase("pickA");
    setErrorToast(null);
  }

  async function handleLink() {
    if (!factA || !factB) return;
    setLinking(true);
    try {
      const chain = await buildChain(factA.id, factB.id);
      if (chain) {
        emitSfx("evidence_link");
        setSuccessToast(`Chain connected: ${chain.label}`);
        setTimeout(() => {
          setSuccessToast(null);
          onClose();
          resetForRetry();
        }, 1800);
      } else {
        emitSfx("lose");
        setErrorToast("These facts don't connect");
        setTimeout(() => {
          setErrorToast(null);
          setFactB(null);
          setPhase("pickB");
        }, 1800);
      }
    } finally {
      setLinking(false);
    }
  }

  function handleClose() {
    setErrorToast(null);
    setSuccessToast(null);
    resetForRetry();
    onClose();
  }

  const canLink = !!factA && !!factB && !linking;

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
          accessibilityLabel="Close chain builder"
        />
        <View style={styles.wrap} pointerEvents="box-none">
          <PixelPanel variant="raised" style={styles.panel}>
            <ScanlineOverlay intensity={0.04} step={4} />
            <PixelText
              size={12}
              color={cfPalette.pinkHot}
              uppercase
              glow
              align="center"
            >
              link evidence
            </PixelText>
            <PixelText
              size={7}
              color={cfPalette.ash}
              align="center"
              style={styles.subhead}
            >
              {phase === "pickA"
                ? "Select the first fact"
                : "Select the second fact"}
            </PixelText>

            {/* Slot indicators */}
            <View style={styles.slotRow}>
              <SlotIndicator
                label="A"
                fact={factA}
                active={phase === "pickA"}
                done={!!factA && phase === "pickB"}
              />
              <PixelText size={14} color={cfPalette.purple}>
                →
              </PixelText>
              <SlotIndicator
                label="B"
                fact={factB}
                active={phase === "pickB"}
                done={!!factB}
              />
            </View>

            {/* Fact picker */}
            <ScrollView
              style={styles.picker}
              contentContainerStyle={styles.pickerContent}
              showsVerticalScrollIndicator={false}
            >
              {committedFacts.map((fact) => {
                const isSelectedA = factA?.id === fact.id;
                const isSelectedB = factB?.id === fact.id;
                const isAlreadyLinked =
                  existingChainPairs.has(`${fact.id}::${factA?.id}`) ||
                  existingChainPairs.has(`${factA?.id}::${fact.id}`);
                const dimmed = isAlreadyLinked;

                return (
                  <FactChipRow
                    key={fact.id}
                    fact={fact}
                    selectedSlot={isSelectedA ? "A" : isSelectedB ? "B" : null}
                    dimmed={!!dimmed}
                    onSelect={handleFactSelect}
                  />
                );
              })}
            </ScrollView>

            {/* Error / success toast */}
            {errorToast && (
              <View style={styles.toast}>
                <PixelText
                  size={8}
                  color={cfPalette.redHot}
                  align="center"
                  uppercase
                >
                  {errorToast}
                </PixelText>
              </View>
            )}
            {successToast && (
              <View style={[styles.toast, styles.successToast]}>
                <PixelText
                  size={8}
                  color={cfPalette.cyan}
                  align="center"
                  uppercase
                  glow
                >
                  {successToast}
                </PixelText>
              </View>
            )}

            <View style={styles.footer}>
              {phase === "pickB" && factA && (
                <NeonButton
                  label="Start Over"
                  variant="ghost"
                  size="sm"
                  disabled={linking}
                  onPress={resetForRetry}
                  style={styles.footerBtn}
                />
              )}
              <NeonButton
                label={linking ? "Linking…" : canLink ? "Link Facts" : "Pick Two Facts"}
                variant="primary"
                size="md"
                disabled={!canLink}
                onPress={() => {
                  void handleLink();
                }}
                style={[styles.footerBtn, canLink ? {} : { opacity: 0.5 }]}
              />
            </View>
          </PixelPanel>
        </View>
      </View>
    </Modal>
  );
}

interface SlotIndicatorProps {
  label: string;
  fact: Fact | null;
  active: boolean;
  done: boolean;
}

function SlotIndicator({ label, fact, active, done }: SlotIndicatorProps) {
  const color = done
    ? cfPalette.cyan
    : active
      ? cfPalette.pinkHot
      : cfPalette.iron;
  return (
    <View style={styles.slot}>
      <PixelText size={6} color={cfPalette.ash} uppercase>
        slot {label}
      </PixelText>
      <PixelPanel
        variant={done ? "raised" : "default"}
        borderColor={active ? cfPalette.pinkHot : undefined}
        style={[
          styles.slotPanel,
          { borderColor: active ? cfPalette.pinkHot : cfPalette.iron },
        ]}
      >
        {fact ? (
          <PixelText size={7} color={cfPalette.bone}>
            {fact.kind === "captured"
              ? fact.capturedQuote ?? "(fact)"
              : fact.payload.text ?? "(fact)"}
          </PixelText>
        ) : (
          <PixelText size={7} color={cfPalette.iron}>
            {active ? "tap below" : "—"}
          </PixelText>
        )}
      </PixelPanel>
    </View>
  );
}

interface FactChipRowProps {
  fact: Fact;
  selectedSlot: "A" | "B" | null;
  dimmed: boolean;
  onSelect: (fact: Fact) => void;
}

function FactChipRow({ fact, selectedSlot, dimmed, onSelect }: FactChipRowProps) {
  const isCaptured = fact.kind === "captured";
  const quote = isCaptured
    ? fact.capturedQuote
    : fact.payload.text;

  return (
    <Pressable
      onPress={() => onSelect(fact)}
      style={({ pressed }) => [
        styles.chipRow,
        pressed && { opacity: 0.7 },
        dimmed && { opacity: 0.4 },
        selectedSlot === "A" && { borderColor: cfPalette.cyan },
        selectedSlot === "B" && { borderColor: cfPalette.pinkHot },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Select fact: ${quote}`}
    >
      {selectedSlot && (
        <View
          style={[
            styles.slotBadge,
            {
              backgroundColor:
                selectedSlot === "A" ? cfPalette.cyan : cfPalette.pinkHot,
            },
          ]}
        >
          <PixelText size={5} color={cfPalette.void} uppercase>
            {selectedSlot}
          </PixelText>
        </View>
      )}
      <View style={styles.chipBody}>
        <PixelText size={7} color={cfPalette.ash} uppercase>
          day {isCaptured ? fact.capturedOnDay ?? 0 : fact.day} · {isCaptured ? "captured" : fact.kind}
        </PixelText>
        <PixelText
          size={9}
          color={cfPalette.bone}
          style={styles.chipQuote}
        >
          "{quote}"
        </PixelText>
      </View>
      {selectedSlot && (
        <PixelText size={9} color={cfPalette.pinkHot} glow>
          ✓
        </PixelText>
      )}
    </Pressable>
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
  wrap: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
  },
  panel: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    maxHeight: "90%",
  },
  subhead: {
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 11,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginBottom: 14,
  },
  slot: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  slotPanel: {
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  picker: {
    maxHeight: 300,
  },
  pickerContent: {
    gap: 8,
    paddingBottom: 4,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderWidth: 2,
    borderColor: cfPalette.fog,
    gap: 10,
    backgroundColor: cfPalette.panel,
  },
  slotBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  chipBody: {
    flex: 1,
    gap: 3,
  },
  chipQuote: {
    marginTop: 2,
    lineHeight: 13,
  },
  toast: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: cfPalette.panelHi,
    borderWidth: 1,
    borderColor: cfPalette.redHot,
  },
  successToast: {
    borderColor: cfPalette.cyan,
  },
  footer: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  footerBtn: {
    flex: 1,
  },
});