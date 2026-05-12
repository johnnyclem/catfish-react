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
  const load = useOnboarding((s) => s.load);
  const run = useGameState((s) => s.run);
  const archive = useGameState((s) => s.runArchive);
  const hydrated = useGameState((s) => s.hydrated);

  useEffect(() => {
    void load();
  }, [load]);

  // Onboarding shows when:
  //  - state is loaded and hydrated
  //  - onboarding is not completed
  //  - no active run exists (fresh install — player who has played
  //    before but hasn't completed onboarding still skips)
  //  - no archived runs exist
  const showOnboarding =
    loaded &&
    hydrated &&
    !completed &&
    !run &&
    archive.length === 0;

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
