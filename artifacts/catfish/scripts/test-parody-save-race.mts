/**
 * Programmatic verification of the serialized parody-score persist
 * in `core/gameStore.ts`. Stubs AsyncStorage with a controllable
 * blocking impl so we can hold the first write open, fire a second
 * one, and prove the second never overwrites the first with a stale
 * snapshot.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:parody-save-race
 *
 * Asserts (in order):
 *   1. Two `recordParodyScore` calls for *different* games never
 *      result in a write that's missing one of the updates — even if
 *      the first write's setItem is artificially slowed past the
 *      second call's start.
 *   2. The on-disk blob ends up equal to the in-memory state once
 *      every queued write has settled.
 *   3. The disk writes really were serialized: the second setItem
 *      call doesn't begin until the first has returned (i.e. only
 *      one write is in flight against AsyncStorage at a time).
 *   4. `recordParodyScore` updates the in-memory store synchronously
 *      so a subscriber reading immediately after the call (without
 *      awaiting it) sees the new high score — the disk write does
 *      not block the UI.
 */

import Module, { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const Mod = Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: NodeJS.Module,
    ...rest: unknown[]
  ) => string;
};
const STUB_ID = fileURLToPath(
  new URL("./_async_storage_blocking_stub.cjs", import.meta.url),
);

const originalResolve = Mod._resolveFilename.bind(Module);
Mod._resolveFilename = (request, parent, ...rest) => {
  if (request === "@react-native-async-storage/async-storage") {
    return STUB_ID;
  }
  return originalResolve(request, parent, ...rest);
};

const stubRequire = createRequire(import.meta.url);
const stub = stubRequire(STUB_ID) as {
  __installGate: (key: string) => void;
  __removeGate: (key: string) => void;
  __releaseOne: (key: string) => boolean;
  __writeLog: (key: string) => string[];
  __reset: () => void;
  __getStored: (key: string) => string | null;
};

const { useGameState, __getParodyWriteChain } = await import(
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

const PARODY_KEY = "catfish/prefs/parody/v1";
const state = useGameState.getState;

stub.__reset();

// --- Test 1+2: concurrent saves merge, neither field is silently
//     overwritten, and disk ends up matching memory.
stub.__installGate(PARODY_KEY);

// Fire the first save — the gate holds its setItem open.
const p1 = state().recordParodyScore("wordLow", 5);
// Yield once so the first call reaches its `await` and the second
// call genuinely overlaps it (instead of running entirely after).
await sleep(0);
const p2 = state().recordParodyScore("safeSpot", 7);
// Yield again so the second call also reaches its queued link.
await sleep(0);

assert(
  state().parody.wordLowBestStreak === 5,
  "in-memory wordLow update is visible immediately",
);
assert(
  state().parody.safeSpotBestWave === 7,
  "in-memory safeSpot update is visible immediately while writes pend",
);

// Only the first write should have hit AsyncStorage so far — the
// second is sitting on the chain waiting for the first to settle.
assert(
  stub.__writeLog(PARODY_KEY).length === 1,
  `only one setItem should be in-flight, saw ${stub.__writeLog(PARODY_KEY).length}`,
);

// Release the first, then the second.
assert(stub.__releaseOne(PARODY_KEY), "first write released");
// Let microtasks flush so the chain's next link starts and calls setItem.
await sleep(0);
assert(
  stub.__writeLog(PARODY_KEY).length === 2,
  `second setItem should start only after the first finished, saw ${stub.__writeLog(PARODY_KEY).length}`,
);
assert(stub.__releaseOne(PARODY_KEY), "second write released");

const [r1, r2] = await Promise.all([p1, p2]);
assert(r1 === true && r2 === true, "both recordings reported a new high");

// Drain the write chain so the on-disk view is settled before we
// inspect it.
await __getParodyWriteChain();
stub.__removeGate(PARODY_KEY);

const stored = JSON.parse(stub.__getStored(PARODY_KEY) ?? "null") as {
  wordLowBestStreak: number;
  safeSpotBestWave: number;
  egoTripHighScore: number;
  sugarCoatHighClout: number;
};
assert(stored, "parody blob persisted");
assert(
  stored.wordLowBestStreak === 5,
  `wordLow survived: expected 5, saw ${stored.wordLowBestStreak}`,
);
assert(
  stored.safeSpotBestWave === 7,
  `safeSpot survived: expected 7, saw ${stored.safeSpotBestWave}`,
);
console.log(
  "PASS  test 1+2: concurrent saves serialize, merge, and reach disk",
);

// --- Test 3: each setItem really did land in call order (the
//     blocking-stub already enforced this, but assert the log too
//     so a regression that drops the chain would trip the test).
const log = stub.__writeLog(PARODY_KEY).map((raw) => JSON.parse(raw));
assert(log.length === 2, `exactly two writes occurred, saw ${log.length}`);
assert(
  log[0].wordLowBestStreak === 5 && log[0].safeSpotBestWave === 0,
  "first write captured wordLow's update",
);
assert(
  log[1].wordLowBestStreak === 5 && log[1].safeSpotBestWave === 7,
  "second write captured the merged state, not a stale snapshot",
);
console.log("PASS  test 3: writes are serialized in call order");

// --- Test 4: instant in-memory update — read parody immediately
//     after `recordParodyScore` resolves its sync portion (i.e.
//     without awaiting the returned promise).
stub.__reset();
stub.__installGate(PARODY_KEY);
const pending = state().recordParodyScore("egoTrip", 42);
// `pending` is unresolved (gate holds the write), but the in-memory
// state must already reflect the new high.
assert(
  state().parody.egoTripHighScore === 42,
  "egoTrip high reflected in store before the write resolves",
);
// Let the chain's `.then` callback run so its setItem actually
// reaches the gate before we try to release it.
while (stub.__writeLog(PARODY_KEY).length === 0) {
  await sleep(0);
}
assert(stub.__releaseOne(PARODY_KEY), "release the held egoTrip write");
const ok = await pending;
assert(ok === true, "egoTrip recording reported a new high");
await __getParodyWriteChain();
stub.__removeGate(PARODY_KEY);
console.log("PASS  test 4: UI sees new high before the disk write settles");

// --- Test 5: stale-snapshot regression — even when many calls pile
//     up behind a slow write, every recorded high lands on disk and
//     the final blob equals the final in-memory state.
stub.__reset();
stub.__installGate(PARODY_KEY);
// reset the in-memory parody to a known starting baseline.
useGameState.setState({
  parody: {
    wordLowBestStreak: 0,
    safeSpotBestWave: 0,
    egoTripHighScore: 0,
    sugarCoatHighClout: 0,
  },
});

const burst = [
  state().recordParodyScore("wordLow", 1),
  // yields between calls so each one reaches its `await`.
];
for (const tick of [
  () => state().recordParodyScore("safeSpot", 2),
  () => state().recordParodyScore("egoTrip", 3),
  () => state().recordParodyScore("sugarCoat", 4),
  () => state().recordParodyScore("wordLow", 9),
]) {
  await sleep(0);
  burst.push(tick());
}

// Drain the gate one release at a time so each queued link gets its
// turn. The number of pending writes equals the number of bumps.
await sleep(0);
for (let i = 0; i < burst.length; i++) {
  // setItem may not yet be visible for later writes (they're still
  // chained behind earlier ones). Spin until the next call has
  // actually started, then release it.
  while (stub.__writeLog(PARODY_KEY).length <= i) {
    await sleep(0);
  }
  assert(stub.__releaseOne(PARODY_KEY), `release write #${i + 1}`);
}

await Promise.all(burst);
await __getParodyWriteChain();
stub.__removeGate(PARODY_KEY);

const finalDisk = JSON.parse(stub.__getStored(PARODY_KEY) ?? "null") as {
  wordLowBestStreak: number;
  safeSpotBestWave: number;
  egoTripHighScore: number;
  sugarCoatHighClout: number;
};
const finalMem = state().parody;
assert(
  finalDisk.wordLowBestStreak === 9 &&
    finalDisk.safeSpotBestWave === 2 &&
    finalDisk.egoTripHighScore === 3 &&
    finalDisk.sugarCoatHighClout === 4,
  `final disk blob preserved every bump: ${JSON.stringify(finalDisk)}`,
);
assert(
  finalDisk.wordLowBestStreak === finalMem.wordLowBestStreak &&
    finalDisk.safeSpotBestWave === finalMem.safeSpotBestWave &&
    finalDisk.egoTripHighScore === finalMem.egoTripHighScore &&
    finalDisk.sugarCoatHighClout === finalMem.sugarCoatHighClout,
  "final on-disk blob matches in-memory state",
);
console.log(
  "PASS  test 5: every bump in a 5-call burst lands on disk, no field lost",
);

console.log("\nAll parody save-race tests passed.");
process.exit(0);
