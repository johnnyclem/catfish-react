import {
  PressStart2P_400Regular,
} from "@expo-google-fonts/press-start-2p";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useGameHydration } from "@/core/gameStore";
import { EndOfRunCard } from "@/features/accusation/EndOfRunCard";
import { AudioProvider } from "@/features/audio/AudioProvider";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  // Kick off AsyncStorage hydration once the navigator mounts. The store
  // exposes `hydrated`; consumers gate their UI on that flag.
  useGameHydration();
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0a0420" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="home" />
        <Stack.Screen
          name="chat/[threadId]"
          options={{ animation: "slide_from_right" }}
        />
      </Stack>
      {/* Mounted at the root so a closed run surfaces its End-of-Run
          overlay no matter which screen is visible — Day 7 face-to-
          face can fire from the swipe deck just as easily as a
          player accusation can fire from the journal. The card
          renders nothing while `run.ending` is null. */}
      <EndOfRunCard />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PressStart2P_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0a0420" }}>
          <StatusBar style="light" />
          {/* AudioProvider mounts the looping music + SFX pool. Lives
              inside the gesture root because we use the first user
              gesture to satisfy browser autoplay policy. */}
          <AudioProvider>
            <RootLayoutNav />
          </AudioProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
