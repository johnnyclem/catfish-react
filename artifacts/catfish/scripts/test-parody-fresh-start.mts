/**
 * Regression coverage for the FRESH START confirm prompt added in
 * Task #49 (and locked in by Task #52 for SafeSpot/EgoTrip and
 * Task #53 for SugarCoat). Before #49, three parody mini-games'
 * "start over from a saved board" affordance wiped the same-day
 * saved snapshot inline on the very first tap — a single stray tap
 * threw away real progress with no undo. The fix routes each press
 * through a confirm overlay so wiping requires a deliberate second
 * confirmation.
 *
 * Task #56 extracted the duplicated state machine into a shared
 * hook (`useFreshStartConfirm`) + overlay component
 * (`FreshStartConfirmOverlay`) so a future fourth/fifth parody
 * mini-game can't copy-paste the pre-#49 inline-wipe shape. The
 * source-shape guards in this file have been refactored in step:
 * the inline-wipe regression is now caught by guarding the SHARED
 * HOOK in one place rather than re-stating the same shape across
 * three per-game blocks. Each game's source still gets a small
 * guard that pins it to the hook+overlay (so a fourth game added
 * via copy-paste would have to opt OUT of the shared shape, not
 * IN to the safe one).
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:parody-fresh-start
 *
 * This codebase has no React testing setup (no Jest, no
 * react-test-renderer), so per the existing convention (see
 * `test-parody-session.mts` test 7) we cover the behavior in two
 * layers:
 *
 *   1. STATE-MACHINE MIRROR — model the exact press handlers as
 *      plain functions and assert the right side effects fire for
 *      each button. If someone changes the contract here without
 *      updating the mirror, the mirror will drift and a follow-up
 *      reviewer will catch it. If they change the mirror to
 *      silently re-introduce the inline wipe, the assertions below
 *      will trip.
 *
 *   2. SOURCE-SHAPE GUARDS — read the actual `.ts(x)` files and
 *      assert that the shared hook contains the saveSession(null)
 *      wipe step + onAfterWipe follow-up + overlay close, AND that
 *      each per-game source uses the shared hook + overlay (rather
 *      than re-implementing its own state). This is what catches
 *      "someone simplifying the FRESH START handler back to its
 *      old wipe-immediately shape" — the specific regression the
 *      Task #49/#52/#53/#56 chain locks down.
 *
 * Asserts (in order):
 *   1. SafeSpot — same-day snapshot present: FRESH START opens
 *      confirm; KEEP SAVED RUN dismisses without clearing; START
 *      FRESH clears the snapshot and starts the run.
 *   2. SafeSpot — no snapshot: the button reads DEPLOY BOUNDARIES
 *      and bypasses the confirm overlay entirely.
 *   3. EgoTrip — same-day snapshot present: egotrip-fresh opens
 *      confirm; egotrip-fresh-cancel dismisses without clearing;
 *      egotrip-fresh-confirm clears the snapshot and starts the
 *      countdown.
 *   4. EgoTrip — no snapshot: the FRESH START button is not
 *      rendered at all (the READY card collapses to "TAP TO FLAP").
 *   5. SugarCoat — same-day snapshot restored: sugarcoat-fresh
 *      opens confirm; sugarcoat-fresh-cancel dismisses without
 *      clearing; sugarcoat-fresh-confirm wipes the snapshot, resets
 *      the board/score/moves, and drops the START OVER affordance
 *      out of the header (because the new run isn't a restored one).
 *   6. SHARED HOOK source guard — `useFreshStartConfirm.ts` calls
 *      `saveSession(null)` exactly once inside `confirmFreshStart`,
 *      runs the optional `onAfterWipe` follow-up, and closes the
 *      overlay. Pinning these three steps in one place is what
 *      makes the inline-wipe foot-gun mechanically un-reintroducible
 *      for any future parody mini-game.
 *   7. SHARED OVERLAY source guard — `FreshStartConfirmOverlay.tsx`
 *      renders the `${game}-fresh-confirm` / `${game}-fresh-cancel`
 *      testIDs the per-game tests above pin against, and the cancel
 *      button must NOT trigger any wipe path.
 *   8. PER-GAME wiring guards — each of SafeSpot.tsx / EgoTrip.tsx /
 *      SugarCoat.tsx imports the shared hook + overlay, invokes
 *      them, gates the FRESH START button correctly, and contains
 *      no inline `saveXSession(null)` near the FRESH START button.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    process.exit(1);
  }
}

const here = fileURLToPath(new URL(".", import.meta.url));
const SAFE_SPOT_SRC = readFileSync(
  new URL("../features/parody/games/SafeSpot.tsx", import.meta.url),
  "utf8",
);
const EGO_TRIP_SRC = readFileSync(
  new URL("../features/parody/games/EgoTrip.tsx", import.meta.url),
  "utf8",
);
const SUGAR_COAT_SRC = readFileSync(
  new URL("../features/parody/games/SugarCoat.tsx", import.meta.url),
  "utf8",
);
const FRESH_HOOK_SRC = readFileSync(
  new URL(
    "../features/parody/sessions/useFreshStartConfirm.ts",
    import.meta.url,
  ),
  "utf8",
);
const FRESH_OVERLAY_SRC = readFileSync(
  new URL(
    "../features/parody/sessions/FreshStartConfirmOverlay.tsx",
    import.meta.url,
  ),
  "utf8",
);
void here; // referenced for pathing context above; kept for clarity.

// =====================================================================
// Test 1 — SafeSpot READY card with a same-day snapshot present.
// =====================================================================
//
// State-machine mirror of the SafeSpot READY card's FRESH START /
// confirm overlay flow. The mirror is independent of the actual
// component implementation: it models the user-visible contract.
// A future refactor that re-introduces the inline-wipe foot-gun
// would have to update the mirror to keep it green, which a
// reviewer would catch.
//
//   safespot-start press:
//     if (resumeSnapshotRef.current) -> openFreshConfirm
//     else -> saveSafeSpotSession(null); reset(); setPhase("PLAYING")
//
//   safespot-fresh-confirm press (via shared hook):
//     saveSafeSpotSession(null)
//     onAfterWipe -> resumeSnapshotRef = null; reset(); setPhase("PLAYING")
//     closeFreshConfirm
//
//   safespot-fresh-cancel press (via shared hook):
//     closeFreshConfirm
//     (snapshot left alone, phase stays READY)
{
  type Snap = { dateKey: string; wave: number };
  const initialSnap: Snap = { dateKey: "20260427", wave: 4 };

  const calls = { saveSnap: [] as Array<Snap | null>, reset: 0 };
  const state = {
    phase: "READY" as "READY" | "PLAYING",
    showFreshStartConfirm: false,
    resumeSnapshot: initialSnap as Snap | null,
  };
  function saveSafeSpotSession(snap: Snap | null) {
    calls.saveSnap.push(snap);
  }
  function reset() {
    calls.reset += 1;
  }

  function pressSafespotStart() {
    if (state.resumeSnapshot) {
      state.showFreshStartConfirm = true;
      return;
    }
    saveSafeSpotSession(null);
    reset();
    state.phase = "PLAYING";
  }
  function pressSafespotFreshConfirm() {
    // Mirror of `useFreshStartConfirm.confirmFreshStart` wired with
    // SafeSpot's onAfterWipe: wipe -> after-wipe -> close.
    saveSafeSpotSession(null);
    state.resumeSnapshot = null;
    reset();
    state.phase = "PLAYING";
    state.showFreshStartConfirm = false;
  }
  function pressSafespotFreshCancel() {
    state.showFreshStartConfirm = false;
  }

  // Tap FRESH START — should open the confirm, NOT wipe.
  pressSafespotStart();
  assert(
    state.showFreshStartConfirm === true,
    "SafeSpot: FRESH START opens the confirm overlay when a snapshot is present",
  );
  assert(
    state.phase === "READY",
    `SafeSpot: phase stays READY while confirm is open, saw ${state.phase}`,
  );
  assert(
    state.resumeSnapshot != null,
    "SafeSpot: snapshot is NOT cleared by the FRESH START tap alone",
  );
  assert(
    calls.saveSnap.length === 0 && calls.reset === 0,
    `SafeSpot: no save/reset side effects from FRESH START tap, saw saves=${calls.saveSnap.length} resets=${calls.reset}`,
  );

  // Tap KEEP SAVED RUN — dismisses, snapshot intact.
  pressSafespotFreshCancel();
  assert(
    state.showFreshStartConfirm === false,
    "SafeSpot: KEEP SAVED RUN dismisses the confirm overlay",
  );
  assert(
    state.resumeSnapshot != null,
    "SafeSpot: KEEP SAVED RUN leaves the snapshot intact",
  );
  assert(
    calls.saveSnap.length === 0,
    `SafeSpot: KEEP SAVED RUN does not call saveSafeSpotSession, saw ${calls.saveSnap.length} calls`,
  );
  assert(
    state.phase === "READY",
    `SafeSpot: KEEP SAVED RUN keeps phase READY, saw ${state.phase}`,
  );

  // Re-open and confirm START FRESH — wipes and starts.
  pressSafespotStart();
  assert(
    state.showFreshStartConfirm === true,
    "SafeSpot: FRESH START re-opens confirm after a cancel",
  );
  pressSafespotFreshConfirm();
  assert(
    state.resumeSnapshot === null,
    "SafeSpot: START FRESH clears the in-memory snapshot ref",
  );
  assert(
    calls.saveSnap.length === 1 && calls.saveSnap[0] === null,
    `SafeSpot: START FRESH calls saveSafeSpotSession(null) exactly once, saw ${JSON.stringify(calls.saveSnap)}`,
  );
  assert(
    calls.reset === 1,
    `SafeSpot: START FRESH calls reset() exactly once, saw ${calls.reset}`,
  );
  assert(
    state.phase === "PLAYING",
    `SafeSpot: START FRESH transitions to PLAYING, saw ${state.phase}`,
  );
  assert(
    state.showFreshStartConfirm === false,
    "SafeSpot: START FRESH closes the confirm overlay",
  );
  console.log(
    "PASS  test 1: SafeSpot FRESH START routes through confirm; START FRESH wipes; KEEP SAVED RUN preserves",
  );
}

// =====================================================================
// Test 2 — SafeSpot with NO snapshot. The button reads "DEPLOY
// BOUNDARIES" and must bypass the confirm overlay entirely.
// =====================================================================
{
  const calls = { saveSnap: [] as Array<unknown>, reset: 0 };
  const state = {
    phase: "READY" as "READY" | "PLAYING",
    showFreshStartConfirm: false,
    resumeSnapshot: null as null | { dateKey: string; wave: number },
  };

  function pressSafespotStart() {
    if (state.resumeSnapshot) {
      state.showFreshStartConfirm = true;
      return;
    }
    calls.saveSnap.push(null);
    calls.reset += 1;
    state.phase = "PLAYING";
  }

  pressSafespotStart();
  assert(
    state.showFreshStartConfirm === false,
    "SafeSpot (no snapshot): DEPLOY BOUNDARIES does NOT open the confirm overlay",
  );
  assert(
    state.phase === "PLAYING",
    `SafeSpot (no snapshot): DEPLOY BOUNDARIES goes straight to PLAYING, saw ${state.phase}`,
  );
  assert(
    calls.saveSnap.length === 1 && calls.reset === 1,
    `SafeSpot (no snapshot): DEPLOY BOUNDARIES wipes-and-starts inline, saw saves=${calls.saveSnap.length} resets=${calls.reset}`,
  );
  console.log(
    "PASS  test 2: SafeSpot DEPLOY BOUNDARIES (no snapshot) bypasses the confirm overlay",
  );
}

// =====================================================================
// Test 3 — EgoTrip READY card with a same-day snapshot present.
// =====================================================================
//
// Mirror of EgoTrip's egotrip-fresh / egotrip-fresh-confirm /
// egotrip-fresh-cancel handlers. Note EgoTrip's confirm-START
// transitions to COUNTDOWN, not PLAYING (the countdown is a load-
// bearing precursor to PLAYING — see comments in EgoTrip.tsx).
{
  type Snap = { dateKey: string; score: number };
  const initialSnap: Snap = { dateKey: "20260427", score: 17 };

  const calls = { saveSnap: [] as Array<Snap | null>, reset: 0 };
  const state = {
    phase: "READY" as "READY" | "COUNTDOWN" | "PLAYING",
    showFreshStartConfirm: false,
    resume: initialSnap as Snap | null,
  };
  function saveEgoTripSession(snap: Snap | null) {
    calls.saveSnap.push(snap);
  }
  function reset() {
    calls.reset += 1;
  }

  function pressEgotripFresh() {
    // Mirrors the EgoTrip.tsx press handler — must NOT wipe inline.
    state.showFreshStartConfirm = true;
  }
  function pressEgotripFreshConfirm() {
    // Mirror of `useFreshStartConfirm.confirmFreshStart` wired with
    // EgoTrip's onAfterWipe: wipe -> after-wipe -> close.
    saveEgoTripSession(null);
    state.resume = null;
    reset();
    state.phase = "COUNTDOWN";
    state.showFreshStartConfirm = false;
  }
  function pressEgotripFreshCancel() {
    state.showFreshStartConfirm = false;
  }

  pressEgotripFresh();
  assert(
    state.showFreshStartConfirm === true,
    "EgoTrip: FRESH START opens the confirm overlay",
  );
  assert(
    state.phase === "READY",
    `EgoTrip: phase stays READY while confirm is open, saw ${state.phase}`,
  );
  assert(
    state.resume != null,
    "EgoTrip: snapshot is NOT cleared by the FRESH START tap alone",
  );
  assert(
    calls.saveSnap.length === 0 && calls.reset === 0,
    `EgoTrip: no save/reset side effects from FRESH START tap, saw saves=${calls.saveSnap.length} resets=${calls.reset}`,
  );

  pressEgotripFreshCancel();
  assert(
    state.showFreshStartConfirm === false,
    "EgoTrip: KEEP SAVED RUN dismisses the confirm overlay",
  );
  assert(
    state.resume != null,
    "EgoTrip: KEEP SAVED RUN leaves the snapshot intact",
  );
  assert(
    calls.saveSnap.length === 0,
    `EgoTrip: KEEP SAVED RUN does not call saveEgoTripSession, saw ${calls.saveSnap.length} calls`,
  );

  pressEgotripFresh();
  pressEgotripFreshConfirm();
  assert(
    state.resume === null,
    "EgoTrip: START FRESH clears the in-memory snapshot ref",
  );
  assert(
    calls.saveSnap.length === 1 && calls.saveSnap[0] === null,
    `EgoTrip: START FRESH calls saveEgoTripSession(null) exactly once, saw ${JSON.stringify(calls.saveSnap)}`,
  );
  assert(
    calls.reset === 1,
    `EgoTrip: START FRESH calls reset() exactly once, saw ${calls.reset}`,
  );
  assert(
    state.phase === "COUNTDOWN",
    `EgoTrip: START FRESH transitions to COUNTDOWN (not PLAYING — countdown is load-bearing), saw ${state.phase}`,
  );
  assert(
    state.showFreshStartConfirm === false,
    "EgoTrip: START FRESH closes the confirm overlay",
  );
  console.log(
    "PASS  test 3: EgoTrip FRESH START routes through confirm; START FRESH wipes; KEEP SAVED RUN preserves",
  );
}

// =====================================================================
// Test 4 — EgoTrip with NO snapshot. The FRESH START button is NOT
// rendered at all (the READY card collapses to "TAP TO FLAP" and the
// outer Pressable handles play). So there's no FRESH START handler
// to invoke; we just assert the `egotrip-fresh` testID is conditional
// on `resumeRef.current` in the source. The source guard is in test 8.
// =====================================================================
{
  // Sanity: with no snapshot, EgoTrip's source renders the resume
  // block (which contains both `egotrip-resume` and `egotrip-fresh`)
  // ONLY when `resumeRef.current` is truthy. We verify that in test 8.
  console.log(
    "PASS  test 4: EgoTrip (no snapshot) renders no FRESH START button — covered by source guard in test 8",
  );
}

// =====================================================================
// Test 5 — SugarCoat START OVER button with a same-day saved board
// restored on mount. Mirror of sugarcoat-fresh / -confirm / -cancel.
// =====================================================================
//
// Key differences vs SafeSpot/EgoTrip:
//
//   - SugarCoat has no READY phase. The game starts in PLAYING and the
//     header's START OVER pill is gated on `wasRestoredRef.current`
//     (only meaningful when this run was hydrated from a same-day
//     snapshot). After a successful confirm, the run is fresh, the
//     ref flips to false, and the pill drops out of the tree.
//   - SugarCoat's `onAfterWipe` is the entire `reset()` function
//     (board re-seed, score zero, moves reset, wasRestoredRef flip).
{
  type Snap = { dateKey: string; board: string[]; score: number; moves: number };
  const initialSnap: Snap = {
    dateKey: "20260427",
    board: new Array(49).fill("lie"),
    score: 240,
    moves: 11,
  };

  const calls = { saveSnap: [] as Array<Snap | null>, freshBoard: 0 };
  const state = {
    phase: "PLAYING" as "PLAYING" | "GAME_OVER",
    showFreshStartConfirm: false,
    wasRestored: true,
    board: initialSnap.board.slice(),
    score: initialSnap.score,
    moves: initialSnap.moves,
  };
  function saveSugarCoatSession(snap: Snap | null) {
    calls.saveSnap.push(snap);
  }
  function makeFreshBoard(): string[] {
    calls.freshBoard += 1;
    return new Array(49).fill("excuse");
  }

  function pressSugarcoatFresh() {
    // Mirrors the SugarCoat.tsx press handler — must NOT wipe inline.
    state.showFreshStartConfirm = true;
  }
  function pressSugarcoatFreshConfirm() {
    // Mirror of `useFreshStartConfirm.confirmFreshStart` wired with
    // SugarCoat's onAfterWipe = reset: wipe -> reset -> close.
    saveSugarCoatSession(null);
    // reset() body — pure state reset (no save).
    state.board = makeFreshBoard();
    state.score = 0;
    state.moves = 20;
    state.phase = "PLAYING";
    if (state.wasRestored) state.wasRestored = false;
    state.showFreshStartConfirm = false;
  }
  function pressSugarcoatFreshCancel() {
    state.showFreshStartConfirm = false;
  }

  // Tap START OVER — should open the confirm, NOT wipe.
  pressSugarcoatFresh();
  assert(
    state.showFreshStartConfirm === true,
    "SugarCoat: START OVER opens the confirm overlay when a saved board was restored",
  );
  assert(
    state.wasRestored === true,
    "SugarCoat: wasRestoredRef stays true while confirm is open (so the START OVER pill stays visible behind the overlay)",
  );
  assert(
    state.score === initialSnap.score && state.moves === initialSnap.moves,
    `SugarCoat: score/moves unchanged by the START OVER tap, saw score=${state.score} moves=${state.moves}`,
  );
  assert(
    calls.saveSnap.length === 0 && calls.freshBoard === 0,
    `SugarCoat: no save/board-reset side effects from START OVER tap, saw saves=${calls.saveSnap.length} freshBoards=${calls.freshBoard}`,
  );

  // Tap KEEP SAVED RUN — dismisses, snapshot intact.
  pressSugarcoatFreshCancel();
  assert(
    state.showFreshStartConfirm === false,
    "SugarCoat: KEEP SAVED RUN dismisses the confirm overlay",
  );
  assert(
    calls.saveSnap.length === 0,
    `SugarCoat: KEEP SAVED RUN does not call saveSugarCoatSession, saw ${calls.saveSnap.length} calls`,
  );
  assert(
    state.wasRestored === true,
    "SugarCoat: KEEP SAVED RUN keeps wasRestoredRef true so the pill remains",
  );
  assert(
    state.score === initialSnap.score && state.moves === initialSnap.moves,
    `SugarCoat: KEEP SAVED RUN leaves score/moves intact, saw score=${state.score} moves=${state.moves}`,
  );

  // Re-open and confirm START FRESH — wipes, resets, drops the pill.
  pressSugarcoatFresh();
  assert(
    state.showFreshStartConfirm === true,
    "SugarCoat: START OVER re-opens confirm after a cancel",
  );
  pressSugarcoatFreshConfirm();
  assert(
    calls.saveSnap.length === 1 && calls.saveSnap[0] === null,
    `SugarCoat: START FRESH calls saveSugarCoatSession(null) exactly once, saw ${JSON.stringify(calls.saveSnap)}`,
  );
  assert(
    calls.freshBoard === 1,
    `SugarCoat: START FRESH rebuilds the board exactly once, saw ${calls.freshBoard}`,
  );
  assert(
    state.score === 0 && state.moves === 20,
    `SugarCoat: START FRESH resets score to 0 and moves to STARTING_MOVES, saw score=${state.score} moves=${state.moves}`,
  );
  assert(
    state.wasRestored === false,
    "SugarCoat: START FRESH flips wasRestoredRef to false so the START OVER pill drops out of the header",
  );
  assert(
    state.showFreshStartConfirm === false,
    "SugarCoat: START FRESH closes the confirm overlay",
  );
  assert(
    state.phase === "PLAYING",
    `SugarCoat: phase remains PLAYING after the fresh-start (no READY transition), saw ${state.phase}`,
  );
  console.log(
    "PASS  test 5: SugarCoat START OVER routes through confirm; START FRESH wipes; KEEP SAVED RUN preserves",
  );
}

// =====================================================================
// Test 6 — SHARED HOOK source guard. Pins the wipe + after-wipe +
// overlay-close contract to one place (`useFreshStartConfirm.ts`)
// so a future fourth/fifth parody mini-game inherits the safe shape
// automatically. This is the test that catches "someone simplifying
// the FRESH START handler back to the inline-wipe shape" — by
// shifting the regression to the hook itself, we no longer need to
// re-state the same guards across three per-game blocks.
// =====================================================================
{
  // The hook must export `useFreshStartConfirm` so per-game callers
  // can route through it. Renaming the export would require a
  // coordinated update everywhere, surfacing the change in review.
  assert(
    /export\s+function\s+useFreshStartConfirm\b/.test(FRESH_HOOK_SRC),
    "useFreshStartConfirm.ts: must export `useFreshStartConfirm` function",
  );

  // Carve out the `confirmFreshStart` body — this is the one place
  // the wipe is allowed to fire. Match the useCallback init form.
  const confirmMatch = FRESH_HOOK_SRC.match(
    /const\s+confirmFreshStart\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\},\s*\[\s*\]\s*\)/,
  );
  assert(
    confirmMatch != null,
    "useFreshStartConfirm.ts: locate the `const confirmFreshStart = useCallback(() => { ... }, [])` body",
  );
  const confirmBody = confirmMatch[1] ?? "";

  // The wipe call: saveSession(null) must fire inside confirmFreshStart.
  // We allow either `saveSession(null)` (direct prop) or
  // `saveSessionRef.current(null)` (ref-mirrored, current impl) so an
  // internal-only refactor to drop the ref doesn't churn this test.
  assert(
    /save(?:Session|SessionRef\.current)\(\s*null\s*\)/.test(confirmBody),
    "useFreshStartConfirm.ts: confirmFreshStart must call saveSession(null) (or saveSessionRef.current(null)) — this is THE pinned wipe step",
  );

  // The after-wipe step must run AFTER the wipe (so per-game cleanup
  // sees an already-cleared snapshot) and BEFORE the overlay close
  // (so anything synchronous it does has a chance to reflect).
  const wipeIdx = confirmBody.search(
    /save(?:Session|SessionRef\.current)\(\s*null\s*\)/,
  );
  const afterWipeIdx = confirmBody.search(
    /onAfterWipe(?:Ref\.current)?\??\.\(\)|onAfterWipe(?:Ref\.current)?\?\.\(\)/,
  );
  // The above regex is finicky; simplify: assert we call onAfterWipe
  // (with optional `Ref.current` and optional chaining) somewhere in
  // the body, and ensure it's after the wipe.
  const afterWipeMatch = confirmBody.match(
    /onAfterWipe(?:Ref\.current)?\??\.\(\s*\)/,
  );
  assert(
    afterWipeMatch != null,
    "useFreshStartConfirm.ts: confirmFreshStart must call the optional `onAfterWipe` follow-up (allows `onAfterWipeRef.current?.()` form)",
  );
  const afterWipeAt = confirmBody.indexOf(afterWipeMatch[0]);
  assert(
    wipeIdx >= 0 && afterWipeAt > wipeIdx,
    "useFreshStartConfirm.ts: `onAfterWipe` must run AFTER the saveSession(null) wipe (so per-game cleanup observes a cleared snapshot)",
  );
  void afterWipeIdx;

  // The overlay must close at the end so the per-game caller doesn't
  // have to remember to do it. Allow either `setShowFreshStartConfirm
  // (false)` directly or via a wrapper.
  assert(
    /setShowFreshStartConfirm\(\s*false\s*\)/.test(confirmBody),
    "useFreshStartConfirm.ts: confirmFreshStart must close the overlay via setShowFreshStartConfirm(false)",
  );

  // The cancel handler must close the overlay only — no wipe path.
  const cancelMatch = FRESH_HOOK_SRC.match(
    /const\s+cancelFreshStart\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\},\s*\[\s*\]\s*\)/,
  );
  assert(
    cancelMatch != null,
    "useFreshStartConfirm.ts: locate the `const cancelFreshStart = useCallback(() => { ... }, [])` body",
  );
  const cancelBody = cancelMatch[1] ?? "";
  assert(
    /setShowFreshStartConfirm\(\s*false\s*\)/.test(cancelBody),
    "useFreshStartConfirm.ts: cancelFreshStart must close the overlay",
  );
  assert(
    !/save(?:Session|SessionRef\.current)\(\s*null\s*\)/.test(cancelBody),
    "useFreshStartConfirm.ts: cancelFreshStart must NOT call saveSession(null) — only confirmFreshStart wipes",
  );
  assert(
    !/onAfterWipe/.test(cancelBody),
    "useFreshStartConfirm.ts: cancelFreshStart must NOT run the after-wipe follow-up",
  );

  // The request handler must open the overlay only — no wipe path.
  const requestMatch = FRESH_HOOK_SRC.match(
    /const\s+requestFreshStart\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\},\s*\[\s*\]\s*\)/,
  );
  assert(
    requestMatch != null,
    "useFreshStartConfirm.ts: locate the `const requestFreshStart = useCallback(() => { ... }, [])` body",
  );
  const requestBody = requestMatch[1] ?? "";
  assert(
    /setShowFreshStartConfirm\(\s*true\s*\)/.test(requestBody),
    "useFreshStartConfirm.ts: requestFreshStart must open the overlay",
  );
  assert(
    !/save(?:Session|SessionRef\.current)\(\s*null\s*\)/.test(requestBody),
    "useFreshStartConfirm.ts: requestFreshStart must NOT call saveSession(null) — opening the prompt is not the wipe step",
  );
  console.log(
    "PASS  test 6: useFreshStartConfirm.ts source guard — wipe + after-wipe + overlay-close pinned in one place; inline-wipe foot-gun mechanically un-reintroducible",
  );
}

// =====================================================================
// Test 7 — SHARED OVERLAY source guard. Locks the testID convention
// and the cancel-button shape (no wipe path inside the overlay
// itself) so a per-game mirror test that asserts on `${game}-fresh-
// confirm` / `${game}-fresh-cancel` keeps working.
// =====================================================================
{
  // The overlay must accept a `game` prop typed as the FreshStartGameId
  // literal union and use it to drive both testIDs. The literal type
  // is the structural prompt to add a fourth entry whenever a fourth
  // parody mini-game shows up.
  assert(
    /export\s+type\s+FreshStartGameId\s*=\s*[^;]*"safespot"[\s\S]*?"egotrip"[\s\S]*?"sugarcoat"/.test(
      FRESH_OVERLAY_SRC,
    ),
    "FreshStartConfirmOverlay.tsx: FreshStartGameId literal union must include all three current parody mini-games",
  );
  assert(
    /testID=\{`\$\{game\}-fresh-confirm`\}/.test(FRESH_OVERLAY_SRC),
    "FreshStartConfirmOverlay.tsx: confirm Pressable must use testID=`${game}-fresh-confirm` so per-game tests can pin against it",
  );
  assert(
    /testID=\{`\$\{game\}-fresh-cancel`\}/.test(FRESH_OVERLAY_SRC),
    "FreshStartConfirmOverlay.tsx: cancel Pressable must use testID=`${game}-fresh-cancel` so per-game tests can pin against it",
  );

  // Carve out the cancel Pressable's onPress — it must call onCancel
  // (the dismiss-only handler) and must NOT call onConfirm.
  const cancelIdx = FRESH_OVERLAY_SRC.indexOf(
    "testID={`${game}-fresh-cancel`}",
  );
  assert(
    cancelIdx >= 0,
    "FreshStartConfirmOverlay.tsx: locate the cancel Pressable",
  );
  const cancelBlock = FRESH_OVERLAY_SRC.slice(cancelIdx, cancelIdx + 400);
  assert(
    /onCancel\(\s*\)/.test(cancelBlock),
    "FreshStartConfirmOverlay.tsx: cancel Pressable must invoke onCancel()",
  );
  assert(
    !/onConfirm\(\s*\)/.test(cancelBlock),
    "FreshStartConfirmOverlay.tsx: cancel Pressable must NOT invoke onConfirm — that's the wipe path",
  );
  console.log(
    "PASS  test 7: FreshStartConfirmOverlay.tsx source guard — game-prefixed testIDs + cancel never invokes onConfirm",
  );
}

// =====================================================================
// Test 8 — Per-game wiring guards. Each parody mini-game must
// import the shared hook + overlay, invoke the hook, render the
// overlay with the right `game` prop, gate the FRESH START button
// correctly, and contain no inline `saveXSession(null)` near the
// FRESH START button (the pre-#49 foot-gun).
// =====================================================================
{
  type GameSpec = {
    name: string;
    src: string;
    saveCallName: string;
    /** testID of the per-game FRESH START button. */
    freshBtnTestId: string;
    /** Minimum extra structural guards specific to this game. */
    extra: () => void;
  };
  const games: GameSpec[] = [
    {
      name: "SafeSpot.tsx",
      src: SAFE_SPOT_SRC,
      saveCallName: "saveSafeSpotSession",
      freshBtnTestId: "safespot-start",
      extra: () => {
        // The safespot-start onPress must guard on
        // `resumeSnapshotRef.current` and route the snapshot branch
        // through `fresh.requestFreshStart` (NOT a direct wipe).
        const startIdx = SAFE_SPOT_SRC.indexOf('testID="safespot-start"');
        const startBlock = SAFE_SPOT_SRC.slice(startIdx, startIdx + 1400);
        assert(
          /if\s*\(\s*resumeSnapshotRef\.current\s*\)/.test(startBlock),
          "SafeSpot.tsx: safespot-start handler must guard on `resumeSnapshotRef.current` before doing anything destructive",
        );
        const ifMatch = startBlock.match(
          /if\s*\(\s*resumeSnapshotRef\.current\s*\)\s*\{([\s\S]*?)\}/,
        );
        assert(
          ifMatch != null,
          "SafeSpot.tsx: safespot-start handler must contain an `if (resumeSnapshotRef.current) { ... }` block",
        );
        const ifBody = ifMatch[1] ?? "";
        assert(
          /fresh\.requestFreshStart\(\s*\)/.test(ifBody),
          "SafeSpot.tsx: safespot-start's snapshot branch must call fresh.requestFreshStart() to open the shared confirm overlay",
        );
        assert(
          !/saveSafeSpotSession\(\s*null\s*\)/.test(ifBody),
          "SafeSpot.tsx: safespot-start's snapshot branch must NOT call saveSafeSpotSession(null) inline — that's the pre-fix foot-gun",
        );
        assert(
          /return\s*;/.test(ifBody),
          "SafeSpot.tsx: safespot-start's snapshot branch must return after opening the confirm so the wipe path doesn't fall through",
        );
      },
    },
    {
      name: "EgoTrip.tsx",
      src: EGO_TRIP_SRC,
      saveCallName: "saveEgoTripSession",
      freshBtnTestId: "egotrip-fresh",
      extra: () => {
        // The egotrip-fresh button must only exist inside the resume
        // block (`{resumeRef.current ? ( ... ) : null}`) — without a
        // saved run there's nothing to FRESH-START away from.
        const resumeOpener = EGO_TRIP_SRC.indexOf("{resumeRef.current ? (");
        assert(
          resumeOpener >= 0,
          "EgoTrip.tsx: locate the `{resumeRef.current ? ( ... ) : null}` block that gates the resume affordance",
        );
        const freshIdx = EGO_TRIP_SRC.indexOf('testID="egotrip-fresh"');
        assert(
          freshIdx > resumeOpener,
          "EgoTrip.tsx: egotrip-fresh button must live inside the `resumeRef.current ?` gate (so it never renders without a saved run)",
        );

        const freshBlock = EGO_TRIP_SRC.slice(freshIdx, freshIdx + 800);
        assert(
          /fresh\.requestFreshStart\(\s*\)/.test(freshBlock),
          "EgoTrip.tsx: egotrip-fresh handler must call fresh.requestFreshStart() to open the shared confirm overlay",
        );
        assert(
          !/saveEgoTripSession\(\s*null\s*\)/.test(freshBlock),
          "EgoTrip.tsx: egotrip-fresh handler must NOT call saveEgoTripSession(null) inline — that's the pre-fix foot-gun",
        );
        assert(
          !/resumeRef\.current\s*=\s*null/.test(freshBlock),
          "EgoTrip.tsx: egotrip-fresh handler must NOT null resumeRef.current inline",
        );
        assert(
          !/setPhase\(\s*"COUNTDOWN"\s*\)/.test(freshBlock),
          "EgoTrip.tsx: egotrip-fresh handler must NOT advance phase inline — only the confirm should",
        );
      },
    },
    {
      name: "SugarCoat.tsx",
      src: SUGAR_COAT_SRC,
      saveCallName: "saveSugarCoatSession",
      freshBtnTestId: "sugarcoat-fresh",
      extra: () => {
        // The sugarcoat-fresh button must only render when the current
        // run was hydrated from a saved snapshot.
        const freshIdx = SUGAR_COAT_SRC.indexOf('testID="sugarcoat-fresh"');
        assert(
          freshIdx >= 0,
          "SugarCoat.tsx: locate the sugarcoat-fresh Pressable",
        );
        const beforeFresh = SUGAR_COAT_SRC.slice(0, freshIdx);
        assert(
          /wasRestoredRef\.current[^?]*\?[\s\S]*$/.test(beforeFresh),
          "SugarCoat.tsx: sugarcoat-fresh button must be gated on `wasRestoredRef.current` so it never renders without a restored saved run",
        );

        const freshBlock = SUGAR_COAT_SRC.slice(freshIdx, freshIdx + 600);
        assert(
          /onPress=\{fresh\.requestFreshStart\}/.test(freshBlock),
          "SugarCoat.tsx: sugarcoat-fresh must wire onPress to `fresh.requestFreshStart` (the shared hook's open handler)",
        );
        assert(
          !/saveSugarCoatSession\(\s*null\s*\)/.test(freshBlock),
          "SugarCoat.tsx: sugarcoat-fresh handler must NOT call saveSugarCoatSession(null) inline — that's the pre-fix foot-gun",
        );
        assert(
          !/setBoard\(/.test(freshBlock),
          "SugarCoat.tsx: sugarcoat-fresh handler must NOT rebuild the board inline — only the confirm flow (via reset) should",
        );

        // SugarCoat's `reset()` is now pure: it must NOT call
        // `saveSugarCoatSession(null)` itself (the shared hook owns
        // the wipe). This locks down the Task #56 refactor so a
        // future maintainer can't quietly merge the wipe back into
        // reset and double-fire the save.
        const resetMatch = SUGAR_COAT_SRC.match(
          /const\s+reset\s*=\s*useCallback\(\(\s*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\},\s*\[\s*\]\s*\)/,
        );
        assert(
          resetMatch != null,
          "SugarCoat.tsx: locate the `const reset = useCallback(() => { ... }, [])` body",
        );
        const resetBody = resetMatch[1] ?? "";
        assert(
          !/saveSugarCoatSession\(\s*null\s*\)/.test(resetBody),
          "SugarCoat.tsx: reset() must NOT call saveSugarCoatSession(null) — the shared hook owns the wipe",
        );
        assert(
          /setBoard\(\s*freshBoard\(\)\s*\)/.test(resetBody),
          "SugarCoat.tsx: reset() must seed a fresh board",
        );
        assert(
          /setScore\(\s*0\s*\)/.test(resetBody) &&
            /setMoves\(\s*STARTING_MOVES\s*\)/.test(resetBody),
          "SugarCoat.tsx: reset() must reset score to 0 and moves to STARTING_MOVES",
        );
        assert(
          /wasRestoredRef\.current\s*=\s*false/.test(resetBody),
          "SugarCoat.tsx: reset() must flip wasRestoredRef to false so the START OVER pill drops out of the header on the new run",
        );
      },
    },
  ];

  for (const g of games) {
    // Each game must import the shared hook + overlay so the type
    // checker keeps the wiring honest.
    assert(
      /import\s*\{\s*useFreshStartConfirm\s*\}\s*from\s*["']@\/features\/parody\/sessions\/useFreshStartConfirm["']/.test(
        g.src,
      ),
      `${g.name}: must import useFreshStartConfirm from @/features/parody/sessions/useFreshStartConfirm`,
    );
    assert(
      /import\s*\{\s*FreshStartConfirmOverlay\s*\}\s*from\s*["']@\/features\/parody\/sessions\/FreshStartConfirmOverlay["']/.test(
        g.src,
      ),
      `${g.name}: must import FreshStartConfirmOverlay from @/features/parody/sessions/FreshStartConfirmOverlay`,
    );

    // Each game must invoke the hook with the per-game saveSession.
    // Allow whitespace/newlines so the matcher isn't brittle to formatting.
    const hookCallRe = new RegExp(
      `useFreshStartConfirm[\\s\\S]{0,200}saveSession:\\s*${g.saveCallName}`,
    );
    assert(
      hookCallRe.test(g.src),
      `${g.name}: must call useFreshStartConfirm({ saveSession: ${g.saveCallName}, ... })`,
    );

    // The overlay must be rendered with this game's id so the testIDs
    // it renders match the per-game mirror tests above.
    const gameId = g.freshBtnTestId.split("-")[0];
    const overlayRe = new RegExp(
      `<FreshStartConfirmOverlay[\\s\\S]{0,400}game=["']${gameId}["']`,
    );
    assert(
      overlayRe.test(g.src),
      `${g.name}: must render <FreshStartConfirmOverlay game="${gameId}" ... />`,
    );

    // No game's source should still carry its own `useState` for the
    // confirm overlay — that's exactly the duplicated state Task #56
    // is consolidating away. The shared hook owns it now.
    assert(
      !/useState[^;]*showFreshStartConfirm/.test(g.src),
      `${g.name}: must not declare a local useState for showFreshStartConfirm — that state lives in useFreshStartConfirm now`,
    );

    // No `setShowFreshStartConfirm(true|false)` call should exist in
    // the per-game source — those are owned by the hook.
    assert(
      !/setShowFreshStartConfirm\(\s*(?:true|false)\s*\)/.test(g.src),
      `${g.name}: must not call setShowFreshStartConfirm directly — route through fresh.requestFreshStart / fresh.cancelFreshStart / fresh.confirmFreshStart instead`,
    );

    // Per-game extra structural guards.
    g.extra();
  }
  console.log(
    "PASS  test 8: per-game wiring guards — SafeSpot/EgoTrip/SugarCoat all import + use the shared hook + overlay; inline-wipe foot-gun cannot be re-introduced",
  );
}

console.log("\nAll fresh-start confirm regression tests passed.");
process.exit(0);
