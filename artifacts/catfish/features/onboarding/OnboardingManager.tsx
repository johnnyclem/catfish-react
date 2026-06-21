import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  NeonButton,
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { usePhoneShell } from "@/features/parody/phoneShellState";

import { ONBOARDING_STEPS, useOnboarding } from "./onboardingStore";

interface StepProps {
  step: number;
  onAdvance: () => void;
  children: React.ReactNode;
}

function StepLayout({ children, step, onAdvance }: StepProps) {
  const insets = useSafeAreaInsets();
  const totalSteps = Object.keys(ONBOARDING_STEPS).length;
  return (
    <View style={[styles.overlay, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
      <ScanlineOverlay />
      <View style={styles.stepIndicator}>
        <PixelText size={6} color={cfPalette.fog}>
          Step {step + 1} of {totalSteps}
        </PixelText>
      </View>
      <View style={styles.content}>
        {children}
      </View>
      <View style={styles.advanceRow}>
        <NeonButton
          label={step >= ONBOARDING_STEPS.ACCUSATION_WARNING ? "Let's Go!" : "Continue"}
          variant="primary"
          size="lg"
          fullWidth
          onPress={onAdvance}
        />
      </View>
    </View>
  );
}

function BulletLine({ color, label, description }: { color: string; label: string; description: string }) {
  return (
    <PixelText size={7} color={cfPalette.ash} style={{ lineHeight: 16 }}>
      <PixelText size={7} color={color}>{label}</PixelText>{description}
    </PixelText>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <PixelPanel variant="raised" style={styles.card}>
      {children}
    </PixelPanel>
  );
}

function Step1Welcome({ onAdvance }: { onAdvance: () => void }) {
  return (
    <StepLayout step={ONBOARDING_STEPS.WELCOME} onAdvance={onAdvance}>
      <PixelText size={16} color={cfPalette.bone} uppercase glow align="center">
        Welcome to Catfish
      </PixelText>
      <Card>
        <PixelText size={8} color={cfPalette.ash} align="center" style={{ lineHeight: 16 }}>
          You're solving a murder case.{"\n\n"}
          <PixelText size={8} color={cfPalette.pinkHot}>One of your 5 matches on Lots o' Fish is the killer.</PixelText>{"\n\n"}
          You have <PixelText size={8} color={cfPalette.cyan}>7 days</PixelText> to figure out who. Swipe, chat,{" "}
          go on dates, capture clues, and accuse the right person before time runs out.
        </PixelText>
      </Card>
    </StepLayout>
  );
}

function Step2PhoneTour({ onAdvance }: { onAdvance: () => void }) {
  return (
    <StepLayout step={ONBOARDING_STEPS.PHONE_TOUR} onAdvance={onAdvance}>
      <PixelText size={12} color={cfPalette.bone} uppercase glow align="center">
        Your Phone
      </PixelText>
      <Card>
        <PixelText size={8} color={cfPalette.ash} align="center" style={{ lineHeight: 16 }}>
          This is your phone. Everything happens here.{"\n\n"}
        </PixelText>
        <BulletLine color={cfPalette.cyan} label="Lots o' Fish " description="- swipe through suspects" />
        <BulletLine color={cfPalette.cyan} label="Journal " description="- track your clues" />
        <BulletLine color={cfPalette.cyan} label="Photos " description="- examine evidence" />
        <BulletLine color={cfPalette.cyan} label="Phone " description="- call friends for tips" />
      </Card>
    </StepLayout>
  );
}

function Step3WaitForSwipe({ onAdvance }: { onAdvance: () => void }) {
  const run = useGameState((s) => s.run);
  const openApp = usePhoneShell((s) => s.openApp);
  const navigated = useRef(false);

  useEffect(() => {
    if (navigated.current) return;
    openApp("lotsOfFish", "swipe");
    navigated.current = true;
  }, [openApp]);

  const prevSwipes = useRef(run?.swipes.length ?? 0);
  useEffect(() => {
    if (!run) return;
    if (run.swipes.length > prevSwipes.current) {
      onAdvance();
    }
    prevSwipes.current = run.swipes.length;
  }, [run, onAdvance]);

  return (
    <StepLayout step={ONBOARDING_STEPS.SWIPE_TUTORIAL} onAdvance={onAdvance}>
      <PixelText size={12} color={cfPalette.bone} uppercase glow align="center">
        Swipe to Investigate
      </PixelText>
      <Card>
        <PixelText size={8} color={cfPalette.ash} style={{ lineHeight: 16 }}>
          <PixelText size={8} color={cfPalette.pinkHot}>Swipe right</PixelText>
          <PixelText size={8} color={cfPalette.ash}> to match with a suspect</PixelText>
          {"\n"}
          <PixelText size={8} color={cfPalette.cyan}>Swipe left</PixelText>
          <PixelText size={8} color={cfPalette.ash}> to pass</PixelText>
          {"\n\n"}
          Your matches are how you uncover the truth.
        </PixelText>
      </Card>
    </StepLayout>
  );
}

function Step4WaitForChat({ onAdvance }: { onAdvance: () => void }) {
  const run = useGameState((s) => s.run);
  const openApp = usePhoneShell((s) => s.openApp);
  const navigated = useRef(false);

  useEffect(() => {
    if (navigated.current) return;
    openApp("lotsOfFish", "matches");
    navigated.current = true;
  }, [openApp]);

  const prevHasPlayerMsg = useRef(false);
  useEffect(() => {
    if (!run) return;
    const hasPlayerMsg = run.threads.some((t) =>
      t.messages.some((m) => m.sender === "player"),
    );
    if (hasPlayerMsg && !prevHasPlayerMsg.current) {
      onAdvance();
    }
    prevHasPlayerMsg.current = hasPlayerMsg;
  }, [run, onAdvance]);

  return (
    <StepLayout step={ONBOARDING_STEPS.CHAT_TUTORIAL} onAdvance={onAdvance}>
      <PixelText size={12} color={cfPalette.bone} uppercase glow align="center">
        Start Talking
      </PixelText>
      <Card>
        <PixelText size={8} color={cfPalette.ash} align="center" style={{ lineHeight: 16 }}>
          Send a message to start a conversation.{"\n\n"}
          Every chat is a chance to gather evidence.
        </PixelText>
      </Card>
    </StepLayout>
  );
}

function StepFactCapture({ onAdvance }: { onAdvance: () => void }) {
  const run = useGameState((s) => s.run);
  const openApp = usePhoneShell((s) => s.openApp);
  const navigated = useRef(false);

  useEffect(() => {
    if (navigated.current) return;
    openApp("lotsOfFish", "matches");
    navigated.current = true;
  }, [openApp]);

  // Auto-advance once the player captures their first fact via the
  // chat long-press gesture. Any non-zero captured-count is enough —
  // we don't gate on a specific suspect.
  const prevCaptured = useRef(0);
  useEffect(() => {
    if (!run) return;
    const captured = run.facts.filter((f) => f.kind === "captured").length;
    if (captured > prevCaptured.current && prevCaptured.current === 0) {
      onAdvance();
    }
    prevCaptured.current = captured;
  }, [run, onAdvance]);

  return (
    <StepLayout step={ONBOARDING_STEPS.FACT_CAPTURE_TUTORIAL} onAdvance={onAdvance}>
      <PixelText size={12} color={cfPalette.bone} uppercase glow align="center">
        Capture A Clue
      </PixelText>
      <Card>
        <PixelText size={8} color={cfPalette.ash} align="center" style={{ lineHeight: 16 }}>
          Open a chat, then{" "}
          <PixelText size={8} color={cfPalette.pinkHot}>long-press</PixelText>{" "}
          a message from your match to capture it as evidence.{"\n\n"}
          Captured clues go to your Journal. The killer's lies hide there.
        </PixelText>
      </Card>
    </StepLayout>
  );
}

function Step5JournalIntro({ onAdvance }: { onAdvance: () => void }) {
  const openApp = usePhoneShell((s) => s.openApp);
  const navigated = useRef(false);

  useEffect(() => {
    if (navigated.current) return;
    openApp("journal");
    navigated.current = true;
  }, [openApp]);

  return (
    <StepLayout step={ONBOARDING_STEPS.JOURNAL_INTRO} onAdvance={onAdvance}>
      <PixelText size={12} color={cfPalette.bone} uppercase glow align="center">
        Your Journal
      </PixelText>
      <Card>
        <PixelText size={8} color={cfPalette.ash} align="center" style={{ lineHeight: 16 }}>
          This is your case file. Clues unlock as the days pass and as you{" "}
          investigate each match.{"\n\n"}
          Link evidence together to build a case — and when you're ready,{" "}
          tap <PixelText size={8} color={cfPalette.pinkHot}>Accuse A Suspect</PixelText> at the bottom.
        </PixelText>
      </Card>
    </StepLayout>
  );
}

function StepDateTutorial({ onAdvance }: { onAdvance: () => void }) {
  const openApp = usePhoneShell((s) => s.openApp);
  const navigated = useRef(false);

  useEffect(() => {
    if (navigated.current) return;
    openApp("lotsOfFish", "matches");
    navigated.current = true;
  }, [openApp]);

  return (
    <StepLayout step={ONBOARDING_STEPS.DATE_TUTORIAL} onAdvance={onAdvance}>
      <PixelText size={12} color={cfPalette.bone} uppercase glow align="center">
        Plan A Date
      </PixelText>
      <Card>
        <PixelText size={8} color={cfPalette.ash} align="center" style={{ lineHeight: 16 }}>
          Open any match and tap{" "}
          <PixelText size={8} color={cfPalette.pinkHot}>DATE</PixelText>{" "}
          in the header.{"\n\n"}
          Dates pull tells out of your suspects that texting never will.{" "}
          If they're the killer, the mask slips.
        </PixelText>
      </Card>
    </StepLayout>
  );
}

function Step6AccusationWarning({ onAdvance }: { onAdvance: () => void }) {
  const openApp = usePhoneShell((s) => s.openApp);
  const navigated = useRef(false);

  useEffect(() => {
    if (navigated.current) return;
    openApp("journal");
    navigated.current = true;
  }, [openApp]);

  return (
    <StepLayout step={ONBOARDING_STEPS.ACCUSATION_WARNING} onAdvance={onAdvance}>
      <PixelText size={12} color={cfPalette.bone} uppercase glow align="center">
        Choose Wisely
      </PixelText>
      <Card>
        <PixelText size={8} color={cfPalette.ash} align="center" style={{ lineHeight: 16 }}>
          When you're ready, tap{" "}
          <PixelText size={8} color={cfPalette.pinkHot}>Accuse A Suspect</PixelText>{" "}
          in the Journal.{"\n\n"}
          <PixelText size={8} color={cfPalette.err}>Accuse the wrong person and they walk free.</PixelText>{"\n\n"}
          <PixelText size={8} color={cfPalette.cyan}>Take your time. Trust your gut.</PixelText>
        </PixelText>
      </Card>
    </StepLayout>
  );
}

export function OnboardingManager() {
  const step = useOnboarding((s) => s.step);
  const loaded = useOnboarding((s) => s.loaded);
  const advanceStep = useOnboarding((s) => s.advanceStep);
  const complete = useOnboarding((s) => s.complete);
  const startNewRun = useGameState((s) => s.startNewRun);
  const run = useGameState((s) => s.run);

  const startedRunForOnboarding = useRef(false);
  useEffect(() => {
    if (step >= ONBOARDING_STEPS.SWIPE_TUTORIAL && !run && !startedRunForOnboarding.current) {
      startedRunForOnboarding.current = true;
      void startNewRun();
    }
  }, [step, run, startNewRun]);

  if (!loaded) return null;

  const handleAdvance = async () => {
    if (step >= ONBOARDING_STEPS.ACCUSATION_WARNING) {
      await complete();
    } else {
      await advanceStep();
    }
  };

  switch (step) {
    case ONBOARDING_STEPS.WELCOME:
      return <Step1Welcome onAdvance={handleAdvance} />;
    case ONBOARDING_STEPS.PHONE_TOUR:
      return <Step2PhoneTour onAdvance={handleAdvance} />;
    case ONBOARDING_STEPS.SWIPE_TUTORIAL:
      return <Step3WaitForSwipe onAdvance={handleAdvance} />;
    case ONBOARDING_STEPS.CHAT_TUTORIAL:
      return <Step4WaitForChat onAdvance={handleAdvance} />;
    case ONBOARDING_STEPS.FACT_CAPTURE_TUTORIAL:
      return <StepFactCapture onAdvance={handleAdvance} />;
    case ONBOARDING_STEPS.JOURNAL_INTRO:
      return <Step5JournalIntro onAdvance={handleAdvance} />;
    case ONBOARDING_STEPS.DATE_TUTORIAL:
      return <StepDateTutorial onAdvance={handleAdvance} />;
    case ONBOARDING_STEPS.ACCUSATION_WARNING:
      return <Step6AccusationWarning onAdvance={handleAdvance} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: cfPalette.navyDeep,
    zIndex: 9999,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  stepIndicator: {
    alignItems: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: 24,
  },
  card: {
    padding: 20,
    marginTop: 16,
  },
  advanceRow: {
    marginTop: 24,
  },
});
