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

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  // Kick off AsyncStorage hydration once the navigator mounts. The store
  // exposes `hydrated`; consumers gate their UI on that flag.
  useGameHydration();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0a0420" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="thread/[id]" />
      <Stack.Screen
        name="chat/[threadId]"
        options={{ animation: "slide_from_right" }}
      />
    </Stack>
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
          <RootLayoutNav />
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
