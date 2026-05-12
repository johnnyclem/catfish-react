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
  return (
    <View style={[styles.overlay, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
      <ScanlineOverlay />
      <View style={styles.stepIndicator}>
        <PixelText size={6} color={cfPalette.fog}>
          Step {step + 1} of 6
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
          You have matched with 5 people on Lots o' Fish.{"\n\n"}
          <PixelText size={8} color={cfPalette.pinkHot}>One of them is a killer.</PixelText>{"\n\n"}
          Your job: go on dates, gather evidence, and find the murderer before they strike again.
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
  }, [run, onAdvance]);

  return (
    <StepLayout step={ONBOARDING_STEPS.SWIPE_TUTORIAL} onAdvance={onAdvance}>
      <PixelText size={12} color={cfPalette.bone} uppercase glow align="center">
        Swipe to Investigate
      </PixelText>
      <Card>
        <PixelText size={8} color={cfPalette.pinkHot}>Swipe right</PixelText>
        <PixelText size={8} color={cfPalette.ash}> to match with a suspect</PixelText>
        {"\n"}
        <PixelText size={8} color={cfPalette.cyan}>Swipe left</PixelText>
        <PixelText size={8} color={cfPalette.ash}> to pass</PixelText>
        {"\n\n"}
        <PixelText size={8} color={cfPalette.ash}>Your matches are how you uncover the truth.</PixelText>
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
          Keep track of clues in your journal.{"\n\n"}
          Long-press a message to capture it as evidence.{"\n"}
          Link clues together to build your case.
        </PixelText>
      </Card>
    </StepLayout>
  );
}

function Step6AccusationWarning({ onAdvance }: { onAdvance: () => void }) {
  return (
    <StepLayout step={ONBOARDING_STEPS.ACCUSATION_WARNING} onAdvance={onAdvance}>
      <PixelText size={12} color={cfPalette.bone} uppercase glow align="center">
        Choose Wisely
      </PixelText>
      <Card>
        <PixelText size={8} color={cfPalette.ash} align="center" style={{ lineHeight: 16 }}>
          You have 7 days to find the killer.{"\n\n"}
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
    case ONBOARDING_STEPS.JOURNAL_INTRO:
      return <Step5JournalIntro onAdvance={handleAdvance} />;
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
