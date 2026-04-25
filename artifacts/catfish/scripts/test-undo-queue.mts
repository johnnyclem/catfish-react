/**
 * Programmatic verification of the multi-discard undo queue in
 * `core/gameStore.ts`. Stubs AsyncStorage with an in-memory map so the
 * Zustand store can run under plain Node without React Native or Expo
 * shims.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:undo-queue
 *
 * Asserts (in order):
 *   1. Discarding two facts back-to-back queues both for undo
 *      (regression of the prior single-slot behaviour).
 *   2. Restoring the *first* discarded fact only restores that one
 *      and leaves the second discard's undo timer intact.
 *   3. Per-entry clear removes only the targeted entry, leaving any
 *      other queued entries (and their timers) alone.
 *   4. A single discard + undo still works end-to-end (regression of
 *      the original UX guarantee).
 *   5. Queue is capped at MAX_RECENT_DISCARDS (oldest evicted).
 *   6. Real wall-clock timer-expiry independence: with two queued
 *      discards, the older one's timer firing only drops that entry —
 *      the newer one survives until its own (later) deadline.
 */

import Module from "node:module";
import { fileURLToPath } from "node:url";

const Mod = Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: NodeJS.Module,
    ...rest: unknown[]
  ) => string;
};
const STUB_ID = fileURLToPath(
  new URL("./_async_storage_stub.cjs", import.meta.url),
);

const originalResolve = Mod._resolveFilename.bind(Module);
Mod._resolveFilename = (request, parent, ...rest) => {
  if (request === "@react-native-async-storage/async-storage") {
    return STUB_ID;
  }
  return originalResolve(request, parent, ...rest);
};

// Now load the store. The dynamic import goes through tsx's ESM loader.
const { useGameState, MAX_RECENT_DISCARDS } = await import(
  "../core/gameStore.ts"
);

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    process.exit(1);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const state = useGameState.getState;

// Bootstrap a run.
await state().startNewRun();
const run = state().run!;
assert(run, "run should exist after startNewRun");

// Capture three facts via the public API.
const candidate = run.deck[0]!;
const f1 = await state().commitFact({
  candidateId: candidate.id,
  quote: "alpha quote",
});
const f2 = await state().commitFact({
  candidateId: candidate.id,
  quote: "bravo quote",
});
const f3 = await state().commitFact({
  candidateId: candidate.id,
  quote: "charlie quote",
});
assert(f1 && f2 && f3, "three facts captured");
// Pass 4 — `run.facts` now also carries authored rows materialized
// at `startNewRun`. Filter to captured rows so this test still
// reasons about the player-driven discard queue in isolation.
const capturedCount = () =>
  state().run!.facts.filter((f) => f.kind === "captured").length;
assert(capturedCount() === 3, "run has 3 captured facts before discards");

// --- Test 1: queue two discards.
await state().removeFact(f1.id);
await state().removeFact(f2.id);
assert(
  state().recentlyDiscarded.length === 2,
  "queue has both pending undos after back-to-back discards",
);
assert(
  state().recentlyDiscarded[0]!.id === f1.id &&
    state().recentlyDiscarded[1]!.id === f2.id,
  "queue order is oldest -> newest",
);
assert(capturedCount() === 1, "captured-fact list has only the survivor");
console.log("PASS  test 1: two discards both queued");

// --- Test 2: restore the OLDER one only.
await state().restoreFact(f1.id);
assert(
  state().recentlyDiscarded.length === 1 &&
    state().recentlyDiscarded[0]!.id === f2.id,
  "restoring the older entry leaves the newer one queued",
);
assert(
  state().run!.facts.some((f) => f.id === f1.id),
  "older fact is back in the run",
);
assert(
  !state().run!.facts.some((f) => f.id === f2.id),
  "newer fact is still absent from the run",
);
console.log("PASS  test 2: restoring older entry leaves newer one intact");

// --- Test 3: independent timers — discard another fact, then verify
//     the older queued one (f2) expires before the newly added one.
await state().removeFact(f3.id);
assert(
  state().recentlyDiscarded.length === 2,
  "queue has 2 entries after a new discard",
);
// Spin the store with a tiny window so we don't actually wait 4500ms
// in CI. We can't change UNDO_WINDOW_MS at runtime, so instead just
// verify the queue *currently* holds independent entries with the
// correct order. Then directly clear the older one and confirm the
// newer survives.
await state().clearRecentlyDiscarded(f2.id);
assert(
  state().recentlyDiscarded.length === 1 &&
    state().recentlyDiscarded[0]!.id === f3.id,
  "clearing the older entry leaves the newer one queued",
);
console.log(
  "PASS  test 3: per-entry clear removes only the targeted entry",
);

// --- Test 4: single-discard restore round-trip (regression).
await state().restoreFact(f3.id);
assert(
  state().recentlyDiscarded.length === 0,
  "queue empties after the last undo",
);
assert(
  state().run!.facts.some((f) => f.id === f3.id),
  "single-undo regression: fact is back",
);
console.log("PASS  test 4: single-discard undo still works");

// --- Test 5: cap at MAX_RECENT_DISCARDS.
const overflow = MAX_RECENT_DISCARDS + 2;
const filled: string[] = [];
for (let i = 0; i < overflow; i++) {
  const fact = await state().commitFact({
    candidateId: candidate.id,
    quote: `cap quote ${i}`,
  });
  assert(fact, `cap fact ${i} created`);
  filled.push(fact!.id);
}
for (const id of filled) {
  await state().removeFact(id);
}
assert(
  state().recentlyDiscarded.length === MAX_RECENT_DISCARDS,
  `queue capped at ${MAX_RECENT_DISCARDS}`,
);
const queuedIds = state().recentlyDiscarded.map((f) => f.id);
assert(
  queuedIds[0] === filled[overflow - MAX_RECENT_DISCARDS],
  "oldest remaining entry is the (overflow - cap)-th discard",
);
assert(
  !queuedIds.includes(filled[0]!),
  "very first overflowed entry was evicted",
);
console.log(
  `PASS  test 5: queue capped at ${MAX_RECENT_DISCARDS}, oldest evicted`,
);

// Tidy up between tests: drain any pending timers so test 6 starts
// from a known-empty queue.
for (const fact of [...state().recentlyDiscarded]) {
  await state().clearRecentlyDiscarded(fact.id);
}

// --- Test 6: real wall-clock timer-expiry independence.
//
// Capture two fresh facts, discard them ~UNDO_WINDOW_MS / 2 apart,
// then wait until just after the OLDER one's deadline. The older
// entry's timer should have fired and removed it; the newer entry
// should still be queued because its deadline hasn't arrived yet.
const tA = await state().commitFact({
  candidateId: candidate.id,
  quote: "timer alpha",
});
const tB = await state().commitFact({
  candidateId: candidate.id,
  quote: "timer bravo",
});
assert(tA && tB, "two timer-test facts captured");

const HALF_WINDOW = Math.floor(4500 / 2); // matches UNDO_WINDOW_MS
const SAFETY_MS = 250;

await state().removeFact(tA.id);
await sleep(HALF_WINDOW);
await state().removeFact(tB.id);
assert(
  state().recentlyDiscarded.length === 2,
  "both timer-test entries are queued before any expire",
);

// Wait just past the OLDER entry's deadline. Total elapsed since tA
// was discarded ≈ HALF_WINDOW + (HALF_WINDOW + SAFETY_MS) = full
// UNDO_WINDOW_MS + SAFETY_MS, so tA's timer has fired. tB was
// discarded HALF_WINDOW later, so its deadline is still ~HALF_WINDOW
// in the future.
await sleep(HALF_WINDOW + SAFETY_MS);
const afterFirstExpiry = state().recentlyDiscarded;
assert(
  afterFirstExpiry.length === 1 && afterFirstExpiry[0]!.id === tB.id,
  "older entry's timer fires independently — newer entry survives",
);
console.log(
  "PASS  test 6: per-entry timers expire independently under real wall clock",
);

// Drain whatever's left so the process can exit cleanly.
for (const fact of [...state().recentlyDiscarded]) {
  await state().clearRecentlyDiscarded(fact.id);
}
await state().resetRun();

console.log("\nAll undo-queue tests passed.");
process.exit(0);
