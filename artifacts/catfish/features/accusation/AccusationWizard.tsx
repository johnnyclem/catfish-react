/**
 * AccusationWizard — 3-step guided accusation flow (PRD 10.5).
 *
 * Entry point: `visible` prop, launched from JournalScreen's "Accuse" button.
 * Replaces the raw AccusationSheet with a deliberate step-by-step flow:
 *   Step 1: Review Evidence — summary of all chains + facts
 *   Step 2: Name the Killer — character picker with strength bars
 *   Step 3: Present Your Case — select top 3 chains + file
 *
 * Each step component receives `onNext` / `onBack` callbacks to advance
 * or退回. The wizard itself handles the step state machine and dismisses
 * on successful accuse or player-initiated close.
 */

import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { PixelPanel, ScanlineOverlay } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { CandidateId } from "@/core/models";
import { emitSfx } from "@/features/audio/audioEvents";
import { AccusationStep1 } from "./AccusationStep1";
import { AccusationStep2 } from "./AccusationStep2";
import { AccusationStep3 } from "./AccusationStep3";

type WizardStep = 1 | 2 | 3;

interface AccusationWizardProps {
  visible: boolean;
  onClose: () => void;
}

export function AccusationWizard({ visible, onClose }: AccusationWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [accusedId, setAccusedId] = useState<CandidateId | null>(null);

  function handleStep1Next() {
    setStep(2);
  }

  function handleStep2Next(selectedId: CandidateId) {
    setAccusedId(selectedId);
    setStep(3);
  }

  function handleStep3Close() {
    setStep(1);
    setAccusedId(null);
    onClose();
  }

  function handleBack() {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  }

  function handleClose() {
    setStep(1);
    setAccusedId(null);
    onClose();
  }

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
          accessibilityLabel="Close accusation"
        />
        <View style={styles.wrap} pointerEvents="box-none">
          <PixelPanel variant="raised" style={styles.panel}>
            <ScanlineOverlay intensity={0.04} step={4} />

            {/* Step progress indicator */}
            <View style={styles.stepDots}>
              {[1, 2, 3].map((s) => (
                <View
                  key={s}
                  style={[
                    styles.dot,
                    s === step
                      ? { backgroundColor: cfPalette.pinkHot }
                      : s < step
                        ? { backgroundColor: cfPalette.cyan }
                        : { backgroundColor: cfPalette.iron },
                  ]}
                />
              ))}
            </View>

            {step === 1 && (
              <AccusationStep1
                onNext={handleStep1Next}
                onBack={handleClose}
              />
            )}
            {step === 2 && (
              <AccusationStep2
                onNext={handleStep2Next}
                onBack={handleBack}
              />
            )}
            {step === 3 && accusedId && (
              <AccusationStep3
                accusedCandidateId={accusedId}
                onBack={handleBack}
                onClose={handleStep3Close}
              />
            )}
          </PixelPanel>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3,1,10,0.88)",
    justifyContent: "center",
    alignItems: "stretch",
    padding: Platform.OS === "web" ? 24 : 16,
  },
  wrap: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  panel: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    maxHeight: "92%",
  },
  stepDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});