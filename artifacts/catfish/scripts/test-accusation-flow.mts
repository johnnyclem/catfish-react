/**
 * Programmatic verification of the run-end accusation flow that
 * Pass 6 wires up around the pure resolver in `core/accusation.ts`.
 *
 * Stubs AsyncStorage with the same in-memory map as the other
 * test harnesses so the Zustand store can run under plain Node
 * without any React Native shims.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:accusation-flow
 *
 * Asserts (in order):
 *   1. `accuse({accused, outcome: "accuse"})` against the run's
 *      killer with the full required-fact chain captured in the
 *      Journal returns `{ ending: "caughtThem", matchedDeduction }`,
 *      stamps `closed = true`, and writes the result to `run.ending`
 *      (so a cold start can re-render the End-of-Run card).
 *   2. A wrong accusation returns `wrongfulAccusation`, still
 *      closes the run, and surfaces the resolver's stock fallback
 *      narrative beat.
 *   3. `accuse({outcome: "escaped"})` returns `escapedStub` and
 *      always reads as `correct: false`, regardless of the
 *      `accused` argument.
 *   4. `accuse` is a no-op on an already-closed run (returns null,
 *      leaves the prior `ending` intact — no clobber).
 *   5. `advanceDay` from Day 6 → 7 trips the face-to-face beat
 *      automatically: closes the run, writes a `metKillerStub`
 *      result with `correct: true` (it really was the killer
 *      who showed up), and leaves the swipe deck untouched so
 *      the Journal can still cite captured facts.
 *   6. `dismissAccusation` clears `run.ending` but keeps
 *      `closed = true`, so the overlay disappears and the run
 *      still reads as over.
 *   7. `startNewRun` resets `closed`/`ending` to a clean slate
 *      and rebuilds the deck for the next case.
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

const { useGameState } = await import("../core/gameStore.ts");
const { loadActiveRun } = await import("../core/repository.ts");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    process.exit(1);
  }
}

const state = useGameState.getState;

// ─── Test 1: correct accusation with the full chain ────────────────────
{
  await state().resetRun();
  await state().startNewRun("miles");
  const run = state().run!;
  assert(run.killer === "miles", "run.killer should be miles");
  assert(run.closed === false, "fresh run should not be closed");
  assert(!run.ending, "fresh run should have no ending");

  // Miles's solving deduction requires:
  //   miles_bio_downtown_view, miles_ig_window_reflection,
  //   miles_portrait_uneasy_day5, dev_text_day4_miles_sus
  // All of these are authored facts that materialize for a Miles
  // run. They should already be present + committed in the run's
  // facts list, which means the discovered set the store builds
  // off `f.committed` will satisfy the chain.
  const required = [
    "miles_bio_downtown_view",
    "miles_ig_window_reflection",
    "miles_portrait_uneasy_day5",
    "dev_text_day4_miles_sus",
  ];
  for (const k of required) {
    assert(
      run.facts.some((f) => f.authoringKey === k && f.committed),
      `expected required fact ${k} to be present + committed`,
    );
  }

  const result = await state().accuse({ accused: "miles" });
  assert(result, "accuse should return an AccusationResult");
  assert(
    result!.ending === "caughtThem" && result!.correct === true,
    "Miles + full chain should resolve to caughtThem (correct)",
  );
  assert(
    result!.matchedDeduction !== null &&
      result!.matchedDeduction!.id === "miles_solve_canal_warehouse",
    "matchedDeduction should be Miles's solving deduction",
  );
  assert(
    result!.narrativeBeat.includes("window"),
    "matched-deduction narrative beat surfaces in result.narrativeBeat",
  );

  const after = state().run!;
  assert(after.closed === true, "run should be marked closed after accuse");
  assert(
    after.ending !== null && after.ending !== undefined,
    "run.ending should be persisted onto the run",
  );
  assert(
    after.ending!.ending === "caughtThem",
    "run.ending mirrors the resolver result",
  );

  // Cold-start round-trip: the persisted blob should carry the
  // ending so the End-of-Run card lights up after a process bounce.
  const persisted = await loadActiveRun();
  assert(
    persisted &&
      persisted.closed === true &&
      persisted.ending &&
      persisted.ending.ending === "caughtThem",
    "persisted run should carry closed + ending across cold start",
  );

  console.log("PASS  test 1: correct accusation with full chain");
}

// ─── Test 2: wrong accusation closes the run with the stock beat ───────
{
  await state().resetRun();
  await state().startNewRun("miles");

  const result = await state().accuse({ accused: "tessa" });
  assert(result, "accuse should return a result for the wrong path too");
  assert(
    result!.ending === "wrongfulAccusation" && result!.correct === false,
    "wrong target should resolve to wrongfulAccusation (incorrect)",
  );
  assert(
    result!.matchedDeduction === null,
    "wrong accusation never carries a matched deduction",
  );
  assert(
    result!.narrativeBeat.length > 0,
    "wrong accusation falls back to a stock narrative beat",
  );

  const after = state().run!;
  assert(after.closed === true, "wrong accusation still closes the run");
  assert(
    after.ending && after.ending.ending === "wrongfulAccusation",
    "run.ending mirrors the wrongful resolver result",
  );

  console.log("PASS  test 2: wrong accusation closes with stock beat");
}

// ─── Test 3: escaped outcome is always wrong + always escapedStub ──────
{
  await state().resetRun();
  await state().startNewRun("jules");

  // Even if we hand the resolver the run's actual killer, the
  // escaped outcome should override and read as escapedStub +
  // correct: false. The accused argument is effectively ignored.
  const result = await state().accuse({
    accused: "jules",
    outcome: "escaped",
  });
  assert(result, "escaped accuse should return a result");
  assert(
    result!.ending === "escapedStub" && result!.correct === false,
    "escaped should resolve to escapedStub (always incorrect)",
  );
  assert(
    result!.matchedDeduction === null,
    "escaped never carries a matched deduction",
  );

  const after = state().run!;
  assert(after.closed === true, "escaped closes the run");
  assert(
    after.ending && after.ending.ending === "escapedStub",
    "run.ending mirrors the escaped resolver result",
  );

  console.log("PASS  test 3: escaped outcome is always escapedStub");
}

// ─── Test 4: accuse on a closed run is a no-op (no clobber) ────────────
{
  // Carry over the closed Jules run from test 3.
  const before = state().run!;
  assert(before.closed === true, "precondition: run from test 3 is closed");
  const beforeEnding = before.ending!;

  const second = await state().accuse({ accused: "miles" });
  assert(
    second === null,
    "accuse on a closed run should return null",
  );
  const after = state().run!;
  assert(
    after.ending === beforeEnding,
    "the prior ending should not be overwritten by a stale accuse call",
  );

  console.log("PASS  test 4: accuse no-ops on a closed run");
}

// ─── Test 5: Day 7 face-to-face fires metKillerStub via advanceDay ─────
{
  await state().resetRun();
  await state().startNewRun("kai");
  const run = state().run!;
  assert(run.day === 1, "fresh run starts on day 1");

  // Tick the clock from 1 → 6. None of these should close the run.
  for (let d = 1; d < 6; d++) {
    await state().advanceDay();
    const mid = state().run!;
    assert(mid.closed === false, `day ${d + 1} should NOT close the run`);
    assert(!mid.ending, `day ${d + 1} should have no ending yet`);
  }
  assert(state().run!.day === 6, "should be on day 6 after five ticks");

  // Day 6 → Day 7: face-to-face. The killer reveals themselves.
  await state().advanceDay();
  const closed = state().run!;
  assert(closed.day === 7, "advanceDay does push the day clock to 7");
  assert(closed.closed === true, "Day 7 closes the run automatically");
  assert(
    closed.ending && closed.ending.ending === "metKillerStub",
    "Day 7 fires metKillerStub via the same resolver",
  );
  assert(
    closed.ending!.correct === true,
    "metKiller is correct: true (it really was the killer at the door)",
  );
  assert(
    closed.ending!.matchedDeduction === null,
    "metKiller never carries a matched deduction",
  );

  // Idempotency: a second advanceDay tap (e.g. a stale Sleep button
  // press queued before the close) should not push the day past 7
  // or rewrite the ending.
  await state().advanceDay();
  const stillClosed = state().run!;
  assert(stillClosed.day === 7, "advanceDay no-ops once the run is closed");
  assert(
    stillClosed.ending === closed.ending,
    "ending pointer doesn't change on a no-op advanceDay",
  );

  console.log("PASS  test 5: Day 7 face-to-face fires metKillerStub");
}

// ─── Test 6: dismissAccusation clears overlay, keeps closed ────────────
{
  // Carry over the closed metKiller run from test 5.
  const before = state().run!;
  assert(before.closed === true && before.ending, "precondition: closed + ending set");

  await state().dismissAccusation();
  const after = state().run!;
  assert(
    after.ending === null,
    "dismissAccusation clears run.ending",
  );
  assert(
    after.closed === true,
    "dismissAccusation does NOT reopen the run",
  );

  // Persistence sanity — the cleared ending survives a cold start.
  const persisted = await loadActiveRun();
  assert(
    persisted && persisted.closed === true && !persisted.ending,
    "persisted blob mirrors the dismissed state",
  );

  console.log("PASS  test 6: dismissAccusation clears overlay only");
}

// ─── Test 7: startNewRun resets closed + ending for a fresh case ───────
{
  // Still on the dismissed-but-closed Kai run from test 6.
  await state().startNewRun("delphine");
  const fresh = state().run!;
  assert(fresh.killer === "delphine", "new run is forced to delphine");
  assert(fresh.closed === false, "fresh run starts open");
  assert(!fresh.ending, "fresh run has no ending");
  assert(fresh.day === 1, "fresh run starts on day 1");
  assert(fresh.deck.length > 0, "fresh run rebuilds the deck");
  assert(fresh.deckCursor === 0, "fresh deck cursor starts at 0");

  console.log("PASS  test 7: startNewRun resets closed + ending");
}

// ─── Test 8: gameplay actions are locked on a closed run ───────────────
{
  await state().resetRun();
  await state().startNewRun("miles");

  // Capture a baseline of the open run, do one swipe + sleep so we
  // have a matched candidate to work with later. Task #29: matches
  // are now resolved by `advanceDay`, not by the swipe itself.
  const open = state().run!;
  const firstCard = open.deck[open.deckCursor];
  assert(firstCard, "deck has cards to swipe");
  const swipeAccepted = await state().swipe(firstCard.id, "right");
  assert(swipeAccepted === true, "right-swipe on open run is accepted");
  // Sleep once to materialize the overnight match.
  await state().advanceDay();

  const beforeClose = state().run!;
  const baselineDeckCursor = beforeClose.deckCursor;
  const baselineSwipeCount = beforeClose.swipes.length;
  const baselineFactCount = beforeClose.facts.length;
  const baselineMatch = beforeClose.matches[0];
  assert(baselineMatch, "right-swipe + sleep produced a matched thread");
  const baselineThreadId = baselineMatch.threadId;
  const baselineThread = beforeClose.threads.find(
    (t) => t.id === baselineThreadId,
  )!;
  const baselineThreadMsgCount = baselineThread.messages.length;
  const baselineThreadTurnIndex = baselineThread.turnIndex;
  const baselineFactId = beforeClose.facts.find((f) => f.committed)?.id;
  assert(baselineFactId, "an authored fact is committed for removal test");

  // Close the run via a wrong accusation (we don't care which ending
  // here, just that closed = true).
  await state().accuse({ accused: "tessa" });
  assert(state().run!.closed === true, "precondition: run is now closed");

  // Dismiss the overlay so we're in the post-card "still on a closed
  // run" state. This is exactly the state the code review flagged.
  await state().dismissAccusation();
  assert(
    state().run!.closed === true && !state().run!.ending,
    "precondition: dismissed overlay, run still closed",
  );

  // Try every gameplay mutation — they should all no-op.
  const nextCard =
    state().run!.deck[state().run!.deckCursor] ??
    state().run!.deck[state().run!.deckCursor - 1];
  assert(nextCard, "deck has a card to attempt a swipe against");
  const swipeResult = await state().swipe(nextCard.id, "left");
  assert(swipeResult === false, "swipe on closed run returns false");

  const factResult = await state().commitFact({
    candidateId: nextCard.id,
    threadId: null,
    messageId: null,
    quote: "should not stick",
  });
  assert(factResult === null, "commitFact on closed run returns null");

  const replyResult = await state().sendReply(baselineThreadId, "hello?");
  assert(replyResult === null, "sendReply on closed run returns null");

  await state().openThread(baselineThreadId);
  await state().removeFact(baselineFactId);
  await state().advanceDay();

  // Verify nothing actually mutated.
  const after = state().run!;
  assert(
    after.deckCursor === baselineDeckCursor,
    "deckCursor unchanged on closed run",
  );
  assert(
    after.swipes.length === baselineSwipeCount,
    "swipes log unchanged on closed run",
  );
  assert(
    after.facts.length === baselineFactCount,
    "facts list unchanged on closed run (commit + remove both no-op'd)",
  );
  assert(
    after.facts.some((f) => f.id === baselineFactId),
    "the targeted fact was NOT removed",
  );
  const afterThread = after.threads.find((t) => t.id === baselineThreadId)!;
  assert(
    afterThread.messages.length === baselineThreadMsgCount &&
      afterThread.turnIndex === baselineThreadTurnIndex,
    "thread messages + turnIndex unchanged on closed run",
  );

  // startNewRun is the only way out — and it should work.
  await state().startNewRun();
  const fresh = state().run!;
  assert(
    fresh.closed === false && !fresh.ending,
    "startNewRun is the only escape from a closed run",
  );

  console.log("PASS  test 8: gameplay actions are locked on a closed run");
}

await state().resetRun();
console.log("\nAll accusation-flow tests passed.");
process.exit(0);
