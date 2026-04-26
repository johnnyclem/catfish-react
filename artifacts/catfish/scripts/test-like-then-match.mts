/**
 * Programmatic verification of the like-then-match flow introduced
 * by Task #29: right-swipes are now LIKES that resolve into matches
 * on the next `advanceDay()` (Sleep). Stubs AsyncStorage with the
 * same in-memory map as the other test harnesses so the Zustand
 * store can run under plain Node without any React Native shims.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:like-then-match
 *
 * Asserts (in order):
 *   1. A right-swipe records a pending LikeRecord and a SwipeRecord
 *      but does NOT mint a MatchRelationship or ChatThread (no
 *      "It's a Match!" pop on the swipe itself).
 *   2. `advanceDay()` walks `pendingLikes`, mints a Match + Thread
 *      for every pending like whose candidate is in the run's deck,
 *      stamps `matchedOnDay = day-after-the-tick`, flips the like's
 *      status to "matched", and queues the new match id onto
 *      `pendingMatchAnnouncements`.
 *   3. `acknowledgeMatchAnnouncement(id)` dequeues that one
 *      announcement (idempotent: a second call is a no-op).
 *   4. Like → sleep → match queue survives a cold-start round-trip
 *      via the AsyncStorage repository so a process bounce
 *      mid-celebration still surfaces the overlay.
 *   5. Killer reciprocation: liking the run's killer always produces
 *      a match on the next sleep (no randomness — the deterministic
 *      guarantee called out in the task spec).
 *   6. A left-swipe records the SwipeRecord but does NOT append to
 *      `pendingLikes`.
 *   7. Swipe on a closed run returns `false` and mutates nothing.
 *   8. Day 7 closing tick still resolves overnight likes before the
 *      End-of-Run card fires (so the run record tells the truth
 *      about who matched on the final night).
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

// ─── Test 1: right-swipe = LIKE, no synchronous match ─────────────────
{
  await state().resetRun();
  await state().startNewRun("miles");
  const open = state().run!;
  const firstCard = open.deck[open.deckCursor]!;
  assert(firstCard, "deck has cards to swipe");

  const accepted = await state().swipe(firstCard.id, "right");
  assert(accepted === true, "swipe on open run is accepted");

  const after = state().run!;
  assert(after.swipes.length === 1, "right-swipe records a SwipeRecord");
  assert(
    after.swipes[0]!.direction === "right",
    "swipe direction recorded as right",
  );
  assert(
    (after.pendingLikes ?? []).length === 1,
    "right-swipe appends one LikeRecord",
  );
  const like = after.pendingLikes![0]!;
  assert(
    like.candidateId === firstCard.id &&
      like.status === "pending" &&
      like.day === open.day,
    "LikeRecord captures candidate, day, and pending status",
  );
  assert(
    after.matches.length === 0,
    "right-swipe does NOT mint a MatchRelationship",
  );
  assert(
    after.threads.length === 0,
    "right-swipe does NOT mint a ChatThread",
  );
  assert(
    (after.pendingMatchAnnouncements ?? []).length === 0,
    "right-swipe does NOT queue a celebration",
  );
  assert(
    after.deckCursor === open.deckCursor + 1,
    "right-swipe still advances the deck cursor",
  );

  console.log("PASS  test 1: right-swipe is a LIKE, no synchronous match");
}

// ─── Test 2: advanceDay() resolves pending likes into matches ─────────
{
  // Same run as test 1 — one pending like already queued.
  const before = state().run!;
  const beforeDay = before.day;
  const likedCandidateId = before.pendingLikes![0]!.candidateId;

  await state().advanceDay();
  const after = state().run!;
  assert(after.day === beforeDay + 1, "day clock advances");
  assert(
    after.matches.length === 1,
    "advanceDay materializes one MatchRelationship per pending like",
  );
  const match = after.matches[0]!;
  assert(
    match.candidateId === likedCandidateId,
    "match points back at the originally liked candidate",
  );
  assert(
    match.matchedOnDay === beforeDay + 1,
    "matchedOnDay reflects the morning the match formed",
  );
  assert(match.unmatched === false, "fresh match starts not unmatched");
  assert(
    after.threads.length === 1 && after.threads[0]!.id === match.threadId,
    "advanceDay also mints the corresponding ChatThread",
  );
  assert(
    after.threads[0]!.messages.length === 0 &&
      after.threads[0]!.turnIndex === 0,
    "fresh thread is empty — openThread() handles the opening salvo",
  );
  assert(
    (after.pendingMatchAnnouncements ?? []).length === 1 &&
      after.pendingMatchAnnouncements![0] === match.id,
    "new match id is queued for celebration",
  );
  assert(
    after.pendingLikes![0]!.status === "matched",
    "pending like flips to matched",
  );

  console.log("PASS  test 2: advanceDay resolves pending likes into matches");
}

// ─── Test 3: acknowledgeMatchAnnouncement dequeues and is idempotent ──
{
  const before = state().run!;
  const matchId = before.pendingMatchAnnouncements![0]!;

  await state().acknowledgeMatchAnnouncement(matchId);
  const after = state().run!;
  assert(
    (after.pendingMatchAnnouncements ?? []).length === 0,
    "acknowledge removes the entry from the queue",
  );
  assert(
    after.matches.length === 1,
    "acknowledge does NOT remove the underlying match",
  );

  // Idempotent — calling again is a no-op.
  await state().acknowledgeMatchAnnouncement(matchId);
  const after2 = state().run!;
  assert(
    (after2.pendingMatchAnnouncements ?? []).length === 0,
    "second acknowledge is a no-op",
  );

  console.log("PASS  test 3: acknowledgeMatchAnnouncement dequeues + idempotent");
}

// ─── Test 4: queue survives a cold-start round-trip ───────────────────
{
  await state().resetRun();
  await state().startNewRun("tessa");
  const open = state().run!;
  const card = open.deck[open.deckCursor]!;
  await state().swipe(card.id, "right");
  await state().advanceDay();
  const matchId = state().run!.pendingMatchAnnouncements![0]!;

  const persisted = await loadActiveRun();
  assert(persisted, "run round-trips via the repository");
  assert(
    Array.isArray(persisted!.pendingMatchAnnouncements) &&
      persisted!.pendingMatchAnnouncements!.includes(matchId),
    "pendingMatchAnnouncements survives cold start",
  );
  assert(
    Array.isArray(persisted!.pendingLikes) &&
      persisted!.pendingLikes!.length === 1 &&
      persisted!.pendingLikes![0]!.status === "matched",
    "pendingLikes survives cold start with status preserved",
  );

  console.log("PASS  test 4: queue survives cold-start round-trip");
}

// ─── Test 5: liking the killer always reciprocates (deterministic) ────
{
  // Run through every authored killer to prove the guarantee holds for
  // every identity module, not just whichever one happens to ship the
  // killer at deck[0].
  const killers = ["miles", "tessa", "ren", "kai", "delphine", "jules", "river", "sam"] as const;
  for (const killer of killers) {
    await state().resetRun();
    await state().startNewRun(killer);
    const run = state().run!;
    const killerCard = run.deck.find((c) => c.identity === killer);
    assert(killerCard, `killer ${killer} appears in their own deck`);

    // Walk the deck until we reach the killer card so we can swipe
    // them legitimately (the integrity guard rejects out-of-order
    // swipes, and we want to test the matched path with the killer
    // exactly).
    while (state().run!.deck[state().run!.deckCursor]?.id !== killerCard!.id) {
      const cur = state().run!.deck[state().run!.deckCursor]!;
      // Pass on everyone we don't care about so we don't litter
      // pendingLikes with decoys for this assertion.
      const ok = await state().swipe(cur.id, "left");
      assert(ok, `pre-walk swipe should be accepted for ${killer}`);
    }
    const ok = await state().swipe(killerCard!.id, "right");
    assert(ok, `right-swipe on killer ${killer} accepted`);
    await state().advanceDay();
    const matched = state().run!.matches.find(
      (m) => m.candidateId === killerCard!.id,
    );
    assert(
      matched && !matched.unmatched,
      `killer ${killer} reciprocates after sleep (deterministic)`,
    );
  }

  console.log("PASS  test 5: every killer reciprocates after sleep");
}

// ─── Test 6: left-swipe does NOT append to pendingLikes ───────────────
{
  await state().resetRun();
  await state().startNewRun("ren");
  const open = state().run!;
  const card = open.deck[open.deckCursor]!;
  const ok = await state().swipe(card.id, "left");
  assert(ok === true, "left-swipe accepted");
  const after = state().run!;
  assert(
    after.swipes.length === 1 && after.swipes[0]!.direction === "left",
    "left-swipe records a SwipeRecord",
  );
  assert(
    (after.pendingLikes ?? []).length === 0,
    "left-swipe does NOT touch pendingLikes",
  );
  assert(
    after.matches.length === 0,
    "left-swipe does NOT mint a match",
  );

  // Sleeping with no pending likes leaves matches alone too.
  await state().advanceDay();
  const slept = state().run!;
  assert(
    slept.matches.length === 0 &&
      (slept.pendingMatchAnnouncements ?? []).length === 0,
    "advanceDay with no pending likes mints nothing",
  );

  console.log("PASS  test 6: left-swipe never produces a like or match");
}

// ─── Test 7: closed-run swipe returns false, mutates nothing ──────────
{
  await state().resetRun();
  await state().startNewRun("kai");
  const open = state().run!;
  const card = open.deck[open.deckCursor]!;

  // Force-close the run.
  await state().accuse({ accused: "miles" });
  assert(state().run!.closed === true, "precondition: run is closed");
  await state().dismissAccusation();

  const baselineSwipes = state().run!.swipes.length;
  const baselineLikes = (state().run!.pendingLikes ?? []).length;
  const result = await state().swipe(card.id, "right");
  assert(result === false, "swipe on closed run returns false");
  const after = state().run!;
  assert(
    after.swipes.length === baselineSwipes,
    "closed-run swipe does not append a SwipeRecord",
  );
  assert(
    (after.pendingLikes ?? []).length === baselineLikes,
    "closed-run swipe does not append a LikeRecord",
  );

  console.log("PASS  test 7: swipe on closed run is a no-op");
}

// ─── Test 8: Day 7 closing tick still resolves overnight likes ────────
{
  await state().resetRun();
  await state().startNewRun("delphine");
  // Tick to Day 6 without swiping.
  for (let d = 1; d < 6; d++) {
    await state().advanceDay();
  }
  assert(state().run!.day === 6, "precondition: at day 6");
  assert(state().run!.closed === false, "precondition: still open");

  // Swipe a card right on the final day.
  const card = state().run!.deck[state().run!.deckCursor]!;
  const ok = await state().swipe(card.id, "right");
  assert(ok, "right-swipe accepted on day 6");
  assert(
    state().run!.matches.length === 0,
    "no match yet — still pending overnight",
  );

  // Sleep — Day 7 should close the run AND materialize the overnight
  // match before the End-of-Run card fires.
  await state().advanceDay();
  const closed = state().run!;
  assert(closed.day === 7, "advanceDay pushed to day 7");
  assert(closed.closed === true, "Day 7 closes the run");
  assert(
    closed.matches.length === 1 &&
      closed.matches[0]!.candidateId === card.id,
    "overnight like still resolved before close",
  );
  assert(
    (closed.pendingMatchAnnouncements ?? []).length === 1,
    "celebration is queued even on the closing tick",
  );
  assert(
    closed.pendingLikes!.find((l) => l.candidateId === card.id)!.status ===
      "matched",
    "pending like flipped to matched on the closing tick",
  );

  console.log("PASS  test 8: Day 7 closing tick still resolves overnight likes");
}

await state().resetRun();
console.log("\nAll like-then-match tests passed.");
process.exit(0);
