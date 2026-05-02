/**
 * Programmatic verification of the daily deck-refill behavior.
 *
 * BEFORE this fix: `buildRun` materialized a 5-card deck (killer + 4
 * decoys) once at run start, and `advanceDay()` never touched the deck.
 * The player burned through the deck on Day 1 and then stared at
 * "DECK IS DRY / Sleep on it." while tapping Sleep six more times
 * until the Day 7 face-to-face auto-closed the run.
 *
 * AFTER this fix: every `advanceDay()` (except the closing Day 7
 * tick) appends a fresh slate of 4 decoys via `freshDecoysForDay`,
 * so `remaining = deck.slice(deckCursor)` comes back alive every
 * morning. Determinism: the refill seed is `(runId, nextDay)`, so
 * cold-starting between sleeps cannot reroll the slate.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:deck-refill
 *
 * Asserts (in order):
 *   1. Burning the entire Day 1 deck and pressing Sleep replenishes
 *      `deck` with 4 fresh candidates whose names do NOT collide with
 *      the Day 1 deck (the variety preference). Cursor is unchanged
 *      so `remaining` exposes exactly the new candidates.
 *   2. Refilled candidates carry `isStoryCandidate: false` so they
 *      route through the probabilistic match-back path on the NEXT
 *      Sleep (the deterministic-killer-reciprocates rule still only
 *      fires for the original killer card).
 *   3. The refill is deterministic: the same (runId, day) pair yields
 *      the same set of `displayName`s when `freshDecoysForDay` is
 *      invoked directly, AND a cold-start round-trip via the
 *      repository preserves the appended deck so a process bounce
 *      between sleeps cannot reroll the morning's slate.
 *   4. The Day 7 closing tick does NOT refill the deck — there is no
 *      Day 7 swiping, the player goes straight to the face-to-face,
 *      and any extra appended candidates would be confusing dead
 *      weight in the persisted run record.
 *   5. Sleeping over a partly-burned deck still appends a refill —
 *      we don't gate refills on "deck must be dry first", because
 *      the player should always wake up to fresh strangers, not to
 *      whatever they didn't get to yesterday plus nothing.
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
const { freshDecoysForDay } = await import("../core/decoyPool.ts");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    process.exit(1);
  }
}

const state = useGameState.getState;

// ─── Test 1: Sleep refills the deck with fresh non-colliding names ────
{
  await state().resetRun();
  await state().startNewRun("miles");
  const day1 = state().run!;
  const day1Names = new Set(day1.deck.map((c) => c.displayName));
  const day1DeckLen = day1.deck.length;

  // Burn the Day 1 deck — left-swipe everything so we don't pollute
  // pendingLikes (we'll exercise the like path in test 2).
  for (let i = 0; i < day1DeckLen; i++) {
    const cur = state().run!.deck[state().run!.deckCursor]!;
    const ok = await state().swipe(cur.id, "left");
    assert(ok, `Day 1 left-swipe ${i} accepted`);
  }
  // Precondition: deck is now dry.
  assert(
    state().run!.deckCursor === day1DeckLen,
    "precondition: cursor at end of Day 1 deck",
  );
  assert(
    state().run!.deck.slice(state().run!.deckCursor).length === 0,
    "precondition: 0 left in deck",
  );

  // Sleep — should append a fresh slate.
  await state().advanceDay();
  const day2 = state().run!;
  assert(day2.day === 2, "advanceDay bumps day to 2");
  assert(
    day2.deck.length === day1DeckLen + 4,
    `Day 2 deck grew by 4 (was ${day1DeckLen}, now ${day2.deck.length})`,
  );
  assert(
    day2.deckCursor === day1DeckLen,
    "deckCursor stays put — refill is appended at end",
  );
  const remaining = day2.deck.slice(day2.deckCursor);
  assert(
    remaining.length === 4,
    `4 fresh candidates visible after sleep (got ${remaining.length})`,
  );

  // Variety preference: refill names should not collide with Day 1.
  // (The pool has 10 templates and Day 1 used 5, so 4 fresh names
  // is achievable without falling back to repeats.)
  for (const c of remaining) {
    assert(
      !day1Names.has(c.displayName),
      `refill candidate ${c.displayName} is a fresh face, not a Day 1 repeat`,
    );
  }
  console.log(
    "PASS  test 1: Sleep refills the dry deck with 4 fresh, non-colliding faces",
  );
}

// ─── Test 2: refilled candidates are isStoryCandidate: false ──────────
{
  // Same run as test 1 — sitting on Day 2 with 4 fresh decoys queued.
  const day2 = state().run!;
  const refill = day2.deck.slice(day2.deckCursor);
  for (const c of refill) {
    assert(
      c.isStoryCandidate === false,
      `refill candidate ${c.displayName} is flagged isStoryCandidate: false`,
    );
    assert(
      c.isKillerCandidate === false,
      `refill candidate ${c.displayName} is not flagged as the killer`,
    );
  }
  console.log(
    "PASS  test 2: refilled candidates are pure decoys (probabilistic match-back path)",
  );
}

// ─── Test 3: refill is deterministic + cold-start safe ────────────────
{
  // 3a — `freshDecoysForDay` is pure: same inputs → same names.
  const a = freshDecoysForDay("run_test_refill", 3, []);
  const b = freshDecoysForDay("run_test_refill", 3, []);
  const namesA = a.map((c) => c.displayName).join(",");
  const namesB = b.map((c) => c.displayName).join(",");
  assert(
    namesA === namesB,
    `freshDecoysForDay is deterministic per (runId, day): ${namesA} vs ${namesB}`,
  );

  // Different days produce different slates (sanity check that we
  // are not just always returning the same shuffle).
  const day4 = freshDecoysForDay("run_test_refill", 4, []);
  const namesD4 = day4.map((c) => c.displayName).join(",");
  assert(
    namesA !== namesD4,
    `different (runId, day) yields a different slate (${namesA} vs ${namesD4})`,
  );

  // 3b — cold-start round-trip preserves the appended deck.
  await state().resetRun();
  await state().startNewRun("tessa");
  const startRun = state().run!;
  const startDeckLen = startRun.deck.length;
  await state().advanceDay();
  const sleptRun = state().run!;
  assert(
    sleptRun.deck.length === startDeckLen + 4,
    "deck grew by 4 after first sleep",
  );
  const refilledNames = sleptRun.deck
    .slice(startDeckLen)
    .map((c) => c.displayName)
    .join(",");

  const persisted = await loadActiveRun();
  assert(persisted, "run round-trips via the repository");
  assert(
    persisted!.deck.length === startDeckLen + 4,
    "appended deck survives cold-start round-trip",
  );
  const persistedNames = persisted!.deck
    .slice(startDeckLen)
    .map((c) => c.displayName)
    .join(",");
  assert(
    persistedNames === refilledNames,
    `cold-started deck shows the same morning slate (${persistedNames} vs ${refilledNames})`,
  );
  console.log(
    "PASS  test 3: refill is deterministic + survives cold-start round-trip",
  );
}

// ─── Test 4: Day 7 closing tick does NOT refill ───────────────────────
{
  await state().resetRun();
  await state().startNewRun("kai");
  // Walk to Day 6 without swiping.
  for (let d = 1; d < 6; d++) {
    await state().advanceDay();
  }
  assert(state().run!.day === 6, "precondition: at Day 6");
  assert(state().run!.closed === false, "precondition: still open");
  const beforeCloseDeckLen = state().run!.deck.length;

  // Sleep into Day 7 — the run closes, no refill should be appended.
  await state().advanceDay();
  const closed = state().run!;
  assert(closed.day === 7, "advanceDay pushed to Day 7");
  assert(closed.closed === true, "Day 7 closes the run");
  assert(
    closed.deck.length === beforeCloseDeckLen,
    `deck length unchanged on the closing tick (was ${beforeCloseDeckLen}, is ${closed.deck.length})`,
  );
  console.log("PASS  test 4: Day 7 closing tick does NOT refill the deck");
}

// ─── Test 5: refill happens even with leftover candidates ─────────────
{
  await state().resetRun();
  await state().startNewRun("ren");
  const day1 = state().run!;
  const day1DeckLen = day1.deck.length;

  // Don't swipe anything. Sleep immediately — we should still get a
  // fresh slate appended (the player wakes up to new strangers, not
  // just whatever they didn't get to yesterday).
  await state().advanceDay();
  const day2 = state().run!;
  assert(day2.day === 2, "advanceDay bumps day");
  assert(
    day2.deck.length === day1DeckLen + 4,
    `deck appended with 4 even when prior day's deck wasn't burned (was ${day1DeckLen}, now ${day2.deck.length})`,
  );
  assert(
    day2.deckCursor === 0,
    "cursor stayed at 0 — yesterday's leftover is still the next card",
  );
  console.log(
    "PASS  test 5: refill fires even with leftover candidates from prior day",
  );
}

console.log("\nALL DECK-REFILL TESTS PASSED");
