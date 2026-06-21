import { useEffect } from "react";
import { View } from "react-native";

import { useGameState } from "@/core/gameStore";

import { OnboardingManager } from "./OnboardingManager";
import { useOnboarding } from "./onboardingStore";

interface Props {
  children: React.ReactNode;
}

/**
 * Renders the onboarding flow for fresh installs. Shows the 6-step
 * onboarding if the player has never completed it AND has no active
 * or archived run (fresh install). Players returning to an existing
 * run or who have completed onboarding skip the flow entirely.
 */
export function OnboardingGate({ children }: Props) {
  const loaded = useOnboarding((s) => s.loaded);
  const completed = useOnboarding((s) => s.completed);
  const step = useOnboarding((s) => s.step);
  const load = useOnboarding((s) => s.load);
  const run = useGameState((s) => s.run);
  const archive = useGameState((s) => s.runArchive);
  const hydrated = useGameState((s) => s.hydrated);

  useEffect(() => {
    void load();
  }, [load]);

  // Onboarding shows when state is loaded + hydrated, the player hasn't
  // completed it, and EITHER:
  //   - it's already in progress (step > 0), OR
  //   - this is a genuinely fresh install (no active run, no archive).
  //
  // The `step > 0` latch matters because OnboardingManager auto-starts a
  // run at the swipe step so the interactive tutorial has something to
  // act on. Without the latch, that run would trip the `!run` fresh-
  // install guard and tear the overlay down mid-tutorial — stranding the
  // player on the title screen with 6 of 8 steps never shown. A returning
  // player who never finished onboarding but already has a run/archive
  // still skips, because for them `step === 0` and the fresh-install
  // branch is false.
  const showOnboarding =
    loaded &&
    hydrated &&
    !completed &&
    (step > 0 || (!run && archive.length === 0));

  if (showOnboarding) {
    return (
      <View style={{ flex: 1 }}>
        {children}
        <OnboardingManager />
      </View>
    );
  }

  return <>{children}</>;
}
