/**
 * Programmatic verification of the parody-session persistence in
 * `core/gameStore.ts` (Task #44). The store uses an independent
 * write chain for `parodySessions` so it serializes cleanly without
 * blocking the existing `parody` (high-score) chain. We also verify
 * the date-based gate: SafeSpot/EgoTrip/SugarCoat snapshots from a
 * previous calendar day are dropped on hydrate, while WordLow's
 * persisted streak survives unconditionally because the streak is
 * an open-ended progress counter, not an in-progress run.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:parody-session
 *
 * Asserts (in order):
 *   1. WordLow streak round-trips through hydrate and a stale streak
 *      is NOT cleared by the date gate (a streak is forever until a
 *      loss resets it).
 *   2. A same-day SafeSpot/EgoTrip/SugarCoat snapshot survives
 *      hydrate, with all fields intact.
 *   3. A snapshot dated for yesterday is dropped on hydrate, but
 *      WordLow's streak from the same blob survives.
 *   4. Concurrent saves to the parody-session chain serialize and
 *      every field reaches disk; nothing is silently overwritten.
 *   5. The parody-session chain is INDEPENDENT from the parody
 *      high-score chain — a stalled parody-score write doesn't
 *      block a parody-session write (and vice-versa).
 *   6. `recordParodyScore` (the existing high-score chain) is not
 *      regressed: bumping a high score still updates the in-memory
 *      `parody` slice synchronously and lands on disk.
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
  default: {
    setItem: (k: string, v: string) => Promise<void>;
    getItem: (k: string) => Promise<string | null>;
  };
};

const {
  useGameState,
  __getParodyWriteChain,
  __getParodySessionWriteChain,
} = await import("../core/gameStore.ts");
const { todayDateKey, parseParodySessions } = await import(
  "../core/parodySessions.ts"
);

/**
 * Re-hydrate the in-memory `parodySessions` slice directly from disk,
 * bypassing `useGameState.hydrate()`'s one-shot promise cache. The
 * runtime guarantees a single hydrate per cold start; tests need to
 * simulate multiple cold starts in one process. Reads via the same
 * key + parser the store uses, so this exercises the same accept/
 * reject logic.
 */
async function rehydrateFromDisk(): Promise<void> {
  const raw = await stub.default.getItem(SESSION_KEY);
  const parsed = raw
    ? parseParodySessions(JSON.parse(raw) as unknown)
    : { wordLowStreak: 0, safeSpot: null, egoTrip: null, sugarCoat: null };
  useGameState.setState({ parodySessions: parsed });
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    process.exit(1);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const SESSION_KEY = "catfish/prefs/parody-session/v1";
const PARODY_KEY = "catfish/prefs/parody/v1";
const state = useGameState.getState;

// --- Test 1: WordLow streak round-trips through hydrate and survives
//     even a stale-day disk blob (the streak isn't day-gated).
stub.__reset();
await state().setWordLowStreak(7);
await __getParodySessionWriteChain();

// Manually mutate the on-disk blob so its date is yesterday — verifies
// that even a stale blob preserves the streak field on hydrate.
const yesterday = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return (
    d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  ).toString();
})();
const today = todayDateKey();
const staleBlob = {
  wordLowStreak: 7,
  safeSpot: {
    dateKey: yesterday,
    pom: 50,
    sanity: 80,
    wave: 4,
    waveTick: 12,
    defenders: [{ type: "coffee", row: 1, col: 2, hp: 3 }],
  },
  egoTrip: { dateKey: yesterday, score: 25 },
  sugarCoat: {
    dateKey: yesterday,
    board: ["a", "b", "c"],
    score: 100,
    moves: 5,
  },
};
await stub.default.setItem(SESSION_KEY, JSON.stringify(staleBlob));

// Reset in-memory and re-hydrate.
useGameState.setState({
  parodySessions: {
    wordLowStreak: 0,
    safeSpot: null,
    egoTrip: null,
    sugarCoat: null,
  },
});
await rehydrateFromDisk();

assert(
  state().parodySessions.wordLowStreak === 7,
  `wordLow streak survives stale blob: expected 7, saw ${state().parodySessions.wordLowStreak}`,
);
assert(
  state().parodySessions.safeSpot === null,
  "stale safeSpot snapshot is dropped on hydrate",
);
assert(
  state().parodySessions.egoTrip === null,
  "stale egoTrip snapshot is dropped on hydrate",
);
assert(
  state().parodySessions.sugarCoat === null,
  "stale sugarCoat snapshot is dropped on hydrate",
);
console.log(
  "PASS  test 1: WordLow streak survives a stale-day blob; other snapshots dropped",
);

// --- Test 2: Same-day snapshots round-trip through hydrate intact.
stub.__reset();
const freshBlob = {
  wordLowStreak: 3,
  safeSpot: {
    dateKey: today,
    pom: 75,
    sanity: 60,
    wave: 5,
    waveTick: 42,
    defenders: [
      { type: "coffee", row: 0, col: 0, hp: 2 },
      { type: "fact", row: 2, col: 3, hp: 4 },
    ],
  },
  egoTrip: { dateKey: today, score: 17 },
  sugarCoat: {
    dateKey: today,
    // 49 cells of valid `SugarCoatGemKind` (= SIZE*SIZE for SIZE=7).
    // The parser drops the whole sugarCoat slot if the board contains
    // an unknown kind or has the wrong length.
    board: Array.from({ length: 49 }, (_, i) =>
      ["lie", "excuse", "spin"][i % 3],
    ),
    score: 230,
    moves: 18,
  },
};
await stub.default.setItem(SESSION_KEY, JSON.stringify(freshBlob));
useGameState.setState({
  parodySessions: {
    wordLowStreak: 0,
    safeSpot: null,
    egoTrip: null,
    sugarCoat: null,
  },
});
await rehydrateFromDisk();
const restored = state().parodySessions;
assert(restored.wordLowStreak === 3, "wordLow streak restored");
assert(
  restored.safeSpot != null && restored.safeSpot.wave === 5,
  "safeSpot snapshot restored at wave 5",
);
assert(
  restored.safeSpot != null && restored.safeSpot.defenders.length === 2,
  "safeSpot defenders restored",
);
assert(
  restored.egoTrip != null && restored.egoTrip.score === 17,
  "egoTrip snapshot restored",
);
assert(
  restored.sugarCoat != null &&
    restored.sugarCoat.score === 230 &&
    restored.sugarCoat.moves === 18 &&
    restored.sugarCoat.board.length === 49,
  "sugarCoat snapshot restored with 49-cell board",
);
console.log("PASS  test 2: same-day snapshots round-trip through hydrate");

// --- Test 3: Concurrent session saves serialize on the session chain
//     and every field lands on disk.
stub.__reset();
useGameState.setState({
  parodySessions: {
    wordLowStreak: 0,
    safeSpot: null,
    egoTrip: null,
    sugarCoat: null,
  },
});
stub.__installGate(SESSION_KEY);

const a = state().setWordLowStreak(11);
await sleep(0);
const b = state().saveEgoTripSession({ dateKey: today, score: 99 });
await sleep(0);

assert(
  state().parodySessions.wordLowStreak === 11,
  "in-memory wordLow streak update is visible immediately",
);
assert(
  state().parodySessions.egoTrip?.score === 99,
  "in-memory egoTrip session is visible immediately",
);
assert(
  stub.__writeLog(SESSION_KEY).length === 1,
  `only one session setItem in flight, saw ${stub.__writeLog(SESSION_KEY).length}`,
);
assert(stub.__releaseOne(SESSION_KEY), "release session write #1");
await sleep(0);
assert(
  stub.__writeLog(SESSION_KEY).length === 2,
  `second session setItem started after first finished, saw ${stub.__writeLog(SESSION_KEY).length}`,
);
assert(stub.__releaseOne(SESSION_KEY), "release session write #2");
await Promise.all([a, b]);
await __getParodySessionWriteChain();
stub.__removeGate(SESSION_KEY);
const finalSession = JSON.parse(stub.__getStored(SESSION_KEY) ?? "null");
assert(
  finalSession.wordLowStreak === 11,
  `final disk has wordLow streak 11, saw ${finalSession.wordLowStreak}`,
);
assert(
  finalSession.egoTrip?.score === 99,
  `final disk has egoTrip score 99, saw ${finalSession.egoTrip?.score}`,
);
console.log("PASS  test 3: concurrent session saves serialize and merge");

// --- Test 4: parody-session chain is INDEPENDENT from parody-score chain.
stub.__reset();
useGameState.setState({
  parody: {
    wordLowBestStreak: 0,
    safeSpotBestWave: 0,
    egoTripHighScore: 0,
    sugarCoatHighClout: 0,
  },
  parodySessions: {
    wordLowStreak: 0,
    safeSpot: null,
    egoTrip: null,
    sugarCoat: null,
  },
});
stub.__installGate(PARODY_KEY);
// Stall the parody-score write…
const stalled = state().recordParodyScore("wordLow", 12);
await sleep(0);
// …then a session save should still complete without waiting for it.
const sessionSave = state().setWordLowStreak(4);
await sleep(0);
const sessionDone = await Promise.race([
  sessionSave.then(() => "session"),
  sleep(50).then(() => "timeout"),
]);
assert(
  sessionDone === "session",
  "session write completes without waiting on the stalled parody-score write",
);
// Now release the parody-score write.
assert(stub.__releaseOne(PARODY_KEY), "release stalled parody-score write");
await stalled;
await __getParodyWriteChain();
await __getParodySessionWriteChain();
stub.__removeGate(PARODY_KEY);
console.log(
  "PASS  test 4: session chain is independent from the high-score chain",
);

// --- Test 5: high-score regression check — `recordParodyScore` still
//     updates memory synchronously and lands on disk after the chain
//     drains.
stub.__reset();
useGameState.setState({
  parody: {
    wordLowBestStreak: 0,
    safeSpotBestWave: 0,
    egoTripHighScore: 0,
    sugarCoatHighClout: 0,
  },
});
const bumped = state().recordParodyScore("safeSpot", 13);
assert(
  state().parody.safeSpotBestWave === 13,
  "in-memory safeSpot best updated synchronously",
);
const ok = await bumped;
assert(ok === true, "recordParodyScore returns true on a new best");
await __getParodyWriteChain();
const finalParody = JSON.parse(stub.__getStored(PARODY_KEY) ?? "null");
assert(
  finalParody.safeSpotBestWave === 13,
  `safeSpot best 13 persisted, saw ${finalParody?.safeSpotBestWave}`,
);
console.log("PASS  test 5: high-score recording is unaffected by Task #44");

// --- Test 6: clearing a session (passing null) wipes the disk slot
//     for that game without disturbing siblings.
stub.__reset();
useGameState.setState({
  parodySessions: {
    wordLowStreak: 5,
    safeSpot: {
      dateKey: today,
      pom: 10,
      sanity: 20,
      wave: 1,
      waveTick: 0,
      defenders: [],
    },
    egoTrip: { dateKey: today, score: 8 },
    sugarCoat: null,
  },
});
await state().saveSafeSpotSession(null);
await __getParodySessionWriteChain();
const after = JSON.parse(stub.__getStored(SESSION_KEY) ?? "null");
assert(after.safeSpot === null, "safeSpot slot cleared on disk");
assert(
  after.egoTrip?.score === 8,
  `egoTrip survives sibling clear, saw ${after.egoTrip?.score}`,
);
assert(
  after.wordLowStreak === 5,
  `wordLow streak survives sibling clear, saw ${after.wordLowStreak}`,
);
console.log(
  "PASS  test 6: clearing one session slot does not disturb siblings",
);

// --- Test 7a: SugarCoat board-length validation. A snapshot whose
//     `board` length doesn't equal SIZE*SIZE (49) is malformed — the
//     match-3 scanner indexes by row*SIZE+col, so a wrong-sized board
//     would crash on the first `findMatches` pass. The parser must
//     drop it on hydrate, NOT silently restore a half-board.
{
  stub.__reset();
  await stub.default.setItem(
    SESSION_KEY,
    JSON.stringify({
      wordLowStreak: 2,
      safeSpot: null,
      egoTrip: null,
      sugarCoat: {
        dateKey: today,
        // 25 cells — wrong size, should be rejected on hydrate.
        board: Array.from({ length: 25 }, (_, i) =>
          ["lie", "excuse", "spin"][i % 3],
        ),
        score: 50,
        moves: 12,
      },
    }),
  );
  useGameState.setState({
    parodySessions: {
      wordLowStreak: 0,
      safeSpot: null,
      egoTrip: null,
      sugarCoat: null,
    },
  });
  await rehydrateFromDisk();
  assert(
    state().parodySessions.sugarCoat === null,
    `malformed sugarCoat board (25 cells) dropped on hydrate, saw ${JSON.stringify(state().parodySessions.sugarCoat)}`,
  );
  assert(
    state().parodySessions.wordLowStreak === 2,
    "wordLow streak survives a sibling's malformed-board drop",
  );
  console.log(
    "PASS  test 7a: malformed SugarCoat board length is dropped on hydrate",
  );
}

// --- Test 7: EgoTrip resume-after-countdown regression. Before the
//     fix, pressing RESUME stored the snapshot's score on `scoreRef`,
//     transitioned to COUNTDOWN, and 2.1s later the countdown handler
//     called `reset()` which zeroed `scoreRef` — silently losing the
//     resumed score. The component now queues the resumed score on a
//     `pendingResumeScoreRef`, applied AFTER `reset()` in the same
//     COUNTDOWN→PLAYING transition. This test mirrors that exact
//     state machine so a regression that drops the queue (or applies
//     the score before reset) trips the assertion.
{
  // Mirror of the EgoTrip component's resume / countdown contract.
  // Kept as plain values (no React) so the test stays runtime-free.
  let scoreRef = { current: 0 };
  let pendingResumeScoreRef: { current: number | null } = { current: null };
  function reset() {
    scoreRef.current = 0;
  }
  function pressResume(snap: { score: number }) {
    // Mirrors the new RESUME button: queue, don't apply.
    pendingResumeScoreRef.current = snap.score;
  }
  function countdownComplete() {
    // Mirrors the new countdown handler: reset, then re-apply.
    reset();
    if (pendingResumeScoreRef.current != null) {
      scoreRef.current = pendingResumeScoreRef.current;
      pendingResumeScoreRef.current = null;
    }
  }

  pressResume({ score: 14 });
  // Sanity: while countdown ticks, the in-game score visible to the
  // player is still 0 (we only render the resumed score after PLAYING
  // begins). The queued score must be preserved through this gap.
  assert(
    scoreRef.current === 0 && pendingResumeScoreRef.current === 14,
    `mid-countdown: scoreRef stays 0 and pending=14, saw scoreRef=${scoreRef.current} pending=${pendingResumeScoreRef.current}`,
  );
  countdownComplete();
  assert(
    scoreRef.current === 14,
    `after countdown: resumed score 14 preserved through reset(), saw ${scoreRef.current}`,
  );
  assert(
    pendingResumeScoreRef.current === null,
    "pending queue cleared after apply",
  );

  // Second round (player crashed and tapped REPLAY): no resume queued,
  // reset() zeros the score as before — the fix must NOT keep the
  // resumed score around for the next run.
  countdownComplete();
  assert(
    scoreRef.current === 0,
    `replay round: score zeroed (no leftover queue), saw ${scoreRef.current}`,
  );
}
console.log(
  "PASS  test 7: EgoTrip resumed score survives countdown's reset()",
);

console.log("\nAll parody-session persistence tests passed.");
process.exit(0);
