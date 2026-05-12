import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const ONBOARDING_KEY = "catfish/onboarding/v1";

export const ONBOARDING_STEPS = {
  WELCOME: 0,
  PHONE_TOUR: 1,
  SWIPE_TUTORIAL: 2,
  CHAT_TUTORIAL: 3,
  JOURNAL_INTRO: 4,
  ACCUSATION_WARNING: 5,
} as const;

export const ONBOARDING_TOTAL_STEPS = Object.keys(ONBOARDING_STEPS).length;

interface OnboardingData {
  completed: boolean;
  step: number;
}

interface OnboardingState {
  loaded: boolean;
  completed: boolean;
  step: number;
  load: () => Promise<void>;
  advanceStep: () => Promise<void>;
  complete: () => Promise<void>;
  reset: () => Promise<void>;
}

export const useOnboarding = create<OnboardingState>((set, get) => ({
  loaded: false,
  completed: false,
  step: 0,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (raw) {
        const data = JSON.parse(raw) as OnboardingData;
        set({ loaded: true, completed: data.completed, step: data.step });
      } else {
        set({ loaded: true, completed: false, step: 0 });
      }
    } catch {
      set({ loaded: true, completed: false, step: 0 });
    }
  },

  advanceStep: async () => {
    const next = get().step + 1;
    if (next >= ONBOARDING_TOTAL_STEPS) {
      await get().complete();
      return;
    }
    set({ step: next });
    await AsyncStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({ completed: false, step: next }),
    );
  },

  complete: async () => {
    set({ completed: true, step: 0 });
    await AsyncStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({ completed: true, step: 0 }),
    );
  },

  reset: async () => {
    set({ completed: false, step: 0 });
    await AsyncStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({ completed: false, step: 0 }),
    );
  },
}));
