/**
 * AsyncStorage-backed repository for Catfish.
 *
 * Replaces SwiftData from the original SwiftUI design doc. The model
 * boundaries are preserved — CaseRun is the aggregate root, complex
 * payloads are JSON-encoded — so the schema is portable across passes.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { CaseRun } from "./models";

const ACTIVE_RUN_KEY = "catfish/active_run/v1";

export async function loadActiveRun(): Promise<CaseRun | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_RUN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CaseRun;
  } catch {
    return null;
  }
}

export async function saveActiveRun(run: CaseRun | null): Promise<void> {
  if (run === null) {
    await AsyncStorage.removeItem(ACTIVE_RUN_KEY);
    return;
  }
  await AsyncStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(run));
}

export async function clearActiveRun(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_RUN_KEY);
}
