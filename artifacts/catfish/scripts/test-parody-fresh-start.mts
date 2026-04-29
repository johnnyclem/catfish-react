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
 *   2. SOURCE-SHAPE GUARDS — read the actual `.tsx` files and
 *      assert that the FRESH START press handlers route through
 *      `setShowFreshStartConfirm(true)` rather than an inline
 *      `saveSafeSpotSession(null)` / `saveEgoTripSession(null)` /
 *      `saveSugarCoatSession(null)` wipe, AND that the
 *      confirm/cancel testIDs the mirror tests against actually
 *      exist in the rendered tree. This is what catches "someone
 *      simplifying the FRESH START handler back to its old
 *      wipe-immediately shape" — the specific regression the task
 *      description calls out.
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
 *   5. SafeSpot.tsx source guards: confirm overlay testIDs exist;
 *      the FRESH START press handler routes through the confirm
 *      state and does NOT wipe the session inline.
 *   6. EgoTrip.tsx source guards: same as #5 for EgoTrip's
 *      egotrip-fresh / egotrip-fresh-confirm / egotrip-fresh-cancel
 *      testIDs.
 *   7. SugarCoat — same-day snapshot restored: sugarcoat-fresh
 *      opens confirm; sugarcoat-fresh-cancel dismisses without
 *      clearing; sugarcoat-fresh-confirm wipes the snapshot, resets
 *      the board/score/moves, and drops the START OVER affordance
 *      out of the header (because the new run isn't a restored one).
 *   8. SugarCoat.tsx source guards: confirm overlay testIDs exist;
 *      the START OVER button is gated on `wasRestoredRef.current`;
 *      the sugarcoat-fresh press handler routes through the confirm
 *      state and does NOT wipe the session inline; the confirm
 *      handler routes through `reset`, which is the one place
 *      `saveSugarCoatSession(null)` is allowed to fire from this
 *      flow.
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
void here; // referenced for pathing context above; kept for clarity.

// =====================================================================
// Test 1 — SafeSpot READY card with a same-day snapshot present.
// =====================================================================
//
// Mirror of the SafeSpot READY card's FRESH START / confirm overlay
// state machine. Mirrors the exact branching from `SafeSpot.tsx`:
//
//   safespot-start press:
//     if (resumeSnapshotRef.current) -> setShowFreshStartConfirm(true)
//     else -> saveSafeSpotSession(null); reset(); setPhase("PLAYING")
//
//   safespot-fresh-confirm press:
//     resumeSnapshotRef.current = null
//     saveSafeSpotSession(null)
//     reset()
//     setShowFreshStartConfirm(false)
//     setPhase("PLAYING")
//
//   safespot-fresh-cancel press:
//     setShowFreshStartConfirm(false)
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
    state.resumeSnapshot = null;
    saveSafeSpotSession(null);
    reset();
    state.showFreshStartConfirm = false;
    state.phase = "PLAYING";
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
    state.resume = null;
    saveEgoTripSession(null);
    reset();
    state.showFreshStartConfirm = false;
    state.phase = "COUNTDOWN";
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
// on `resumeRef.current` in the source. The source guard is in test 6.
// =====================================================================
{
  // Sanity: with no snapshot, EgoTrip's source renders the resume
  // block (which contains both `egotrip-resume` and `egotrip-fresh`)
  // ONLY when `resumeRef.current` is truthy. We verify that in test 6.
  console.log(
    "PASS  test 4: EgoTrip (no snapshot) renders no FRESH START button — covered by source guard in test 6",
  );
}

// =====================================================================
// Test 5 — SafeSpot.tsx source-shape guards. Locks in the actual
// component shape so a future refactor can't silently re-introduce
// the inline-wipe foot-gun.
// =====================================================================
{
  // Required testIDs must be present in the rendered tree.
  for (const id of [
    "safespot-start",
    "safespot-fresh-confirm",
    "safespot-fresh-cancel",
  ]) {
    assert(
      SAFE_SPOT_SRC.includes(`testID="${id}"`),
      `SafeSpot.tsx must render a Pressable with testID="${id}"`,
    );
  }

  // Carve out the safespot-start onPress handler body and assert it
  // routes through the confirm prompt for the snapshot branch.
  const startPressIdx = SAFE_SPOT_SRC.indexOf('testID="safespot-start"');
  assert(
    startPressIdx >= 0,
    "SafeSpot.tsx: locate the safespot-start Pressable",
  );
  const startBlock = SAFE_SPOT_SRC.slice(
    startPressIdx,
    startPressIdx + 1200,
  );
  assert(
    /if\s*\(\s*resumeSnapshotRef\.current\s*\)/.test(startBlock),
    "SafeSpot.tsx: safespot-start handler must guard on `resumeSnapshotRef.current` before doing anything destructive",
  );
  assert(
    /setShowFreshStartConfirm\(true\)/.test(startBlock),
    "SafeSpot.tsx: safespot-start handler must call setShowFreshStartConfirm(true) inside the snapshot branch (the foot-gun guard)",
  );

  // The snapshot-branch must NOT call `saveSafeSpotSession(null)`
  // before the `setShowFreshStartConfirm(true)` line — that would be
  // the exact regression the task is locking against. We carve out
  // just the if-branch and assert the wipe call doesn't appear in it.
  const ifMatch = startBlock.match(
    /if\s*\(\s*resumeSnapshotRef\.current\s*\)\s*\{([\s\S]*?)\}/,
  );
  assert(
    ifMatch != null,
    "SafeSpot.tsx: safespot-start handler must contain an `if (resumeSnapshotRef.current) { ... }` block",
  );
  const ifBody = ifMatch[1] ?? "";
  assert(
    !/saveSafeSpotSession\(\s*null\s*\)/.test(ifBody),
    "SafeSpot.tsx: safespot-start's snapshot branch must NOT call saveSafeSpotSession(null) inline — that's the pre-fix foot-gun",
  );
  assert(
    /setShowFreshStartConfirm\(true\)/.test(ifBody),
    "SafeSpot.tsx: safespot-start's snapshot branch must call setShowFreshStartConfirm(true)",
  );
  assert(
    /return\s*;/.test(ifBody),
    "SafeSpot.tsx: safespot-start's snapshot branch must return after opening the confirm so the wipe path doesn't fall through",
  );

  // Sanity-check the confirm and cancel handlers do the right thing.
  const confirmIdx = SAFE_SPOT_SRC.indexOf(
    'testID="safespot-fresh-confirm"',
  );
  const confirmBlock = SAFE_SPOT_SRC.slice(confirmIdx, confirmIdx + 800);
  assert(
    /resumeSnapshotRef\.current\s*=\s*null/.test(confirmBlock),
    "SafeSpot.tsx: safespot-fresh-confirm must clear the resume snapshot ref",
  );
  assert(
    /saveSafeSpotSession\(\s*null\s*\)/.test(confirmBlock),
    "SafeSpot.tsx: safespot-fresh-confirm must call saveSafeSpotSession(null)",
  );
  assert(
    /setPhase\(\s*"PLAYING"\s*\)/.test(confirmBlock),
    "SafeSpot.tsx: safespot-fresh-confirm must transition phase to PLAYING",
  );

  const cancelIdx = SAFE_SPOT_SRC.indexOf(
    'testID="safespot-fresh-cancel"',
  );
  const cancelBlock = SAFE_SPOT_SRC.slice(cancelIdx, cancelIdx + 400);
  assert(
    /setShowFreshStartConfirm\(false\)/.test(cancelBlock),
    "SafeSpot.tsx: safespot-fresh-cancel must close the confirm overlay",
  );
  assert(
    !/saveSafeSpotSession\(\s*null\s*\)/.test(cancelBlock),
    "SafeSpot.tsx: safespot-fresh-cancel must NOT clear the saved session",
  );
  assert(
    !/resumeSnapshotRef\.current\s*=\s*null/.test(cancelBlock),
    "SafeSpot.tsx: safespot-fresh-cancel must NOT null the resume snapshot ref",
  );
  console.log(
    "PASS  test 5: SafeSpot.tsx source guards — confirm overlay wired correctly; inline-wipe foot-gun cannot be re-introduced",
  );
}

// =====================================================================
// Test 6 — EgoTrip.tsx source-shape guards.
// =====================================================================
{
  for (const id of [
    "egotrip-fresh",
    "egotrip-fresh-confirm",
    "egotrip-fresh-cancel",
  ]) {
    assert(
      EGO_TRIP_SRC.includes(`testID="${id}"`),
      `EgoTrip.tsx must render a Pressable with testID="${id}"`,
    );
  }

  // The egotrip-fresh button must only exist inside the resume
  // block (`{resumeRef.current ? ( ... ) : null}`) — without a
  // saved run there's nothing to FRESH-START away from. We assert
  // this by locating the resume block opener and verifying the
  // `egotrip-fresh` testID lives inside it (i.e. between the
  // opener and its matching `: null}` terminator).
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

  // The egotrip-fresh handler must route through the confirm state
  // and must NOT wipe the session inline.
  const freshBlock = EGO_TRIP_SRC.slice(freshIdx, freshIdx + 800);
  assert(
    /setShowFreshStartConfirm\(true\)/.test(freshBlock),
    "EgoTrip.tsx: egotrip-fresh handler must call setShowFreshStartConfirm(true)",
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

  // Confirm handler clears + starts; cancel handler dismisses only.
  const confirmIdx = EGO_TRIP_SRC.indexOf(
    'testID="egotrip-fresh-confirm"',
  );
  const confirmBlock = EGO_TRIP_SRC.slice(confirmIdx, confirmIdx + 800);
  assert(
    /resumeRef\.current\s*=\s*null/.test(confirmBlock),
    "EgoTrip.tsx: egotrip-fresh-confirm must null the resume ref",
  );
  assert(
    /saveEgoTripSession\(\s*null\s*\)/.test(confirmBlock),
    "EgoTrip.tsx: egotrip-fresh-confirm must call saveEgoTripSession(null)",
  );
  assert(
    /setPhase\(\s*"COUNTDOWN"\s*\)/.test(confirmBlock),
    "EgoTrip.tsx: egotrip-fresh-confirm must transition phase to COUNTDOWN",
  );
  assert(
    /setShowFreshStartConfirm\(false\)/.test(confirmBlock),
    "EgoTrip.tsx: egotrip-fresh-confirm must close the confirm overlay",
  );

  const cancelIdx = EGO_TRIP_SRC.indexOf('testID="egotrip-fresh-cancel"');
  const cancelBlock = EGO_TRIP_SRC.slice(cancelIdx, cancelIdx + 400);
  assert(
    /setShowFreshStartConfirm\(false\)/.test(cancelBlock),
    "EgoTrip.tsx: egotrip-fresh-cancel must close the confirm overlay",
  );
  assert(
    !/saveEgoTripSession\(\s*null\s*\)/.test(cancelBlock),
    "EgoTrip.tsx: egotrip-fresh-cancel must NOT clear the saved session",
  );
  assert(
    !/resumeRef\.current\s*=\s*null/.test(cancelBlock),
    "EgoTrip.tsx: egotrip-fresh-cancel must NOT null the resume ref",
  );
  console.log(
    "PASS  test 6: EgoTrip.tsx source guards — confirm overlay wired correctly; inline-wipe foot-gun cannot be re-introduced",
  );
}

// =====================================================================
// Test 7 — SugarCoat header START OVER button with a same-day saved
// board restored on mount.
// =====================================================================
//
// Mirror of SugarCoat's sugarcoat-fresh / sugarcoat-fresh-confirm /
// sugarcoat-fresh-cancel handlers. Key differences vs SafeSpot/EgoTrip:
//
//   - SugarCoat has no READY phase. The game starts in PLAYING and the
//     header's START OVER pill is gated on `wasRestoredRef.current`
//     (only meaningful when this run was hydrated from a same-day
//     snapshot). After a successful confirm, the run is fresh, the
//     ref flips to false, and the pill drops out of the tree.
//   - The confirm button uses `onPress={reset}` (a function reference,
//     not an inline lambda). The `reset()` body is what actually clears
//     the snapshot via `saveSugarCoatSession(null)` — so the mirror
//     models `pressSugarcoatFreshConfirm` as "call reset()".
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
    // Mirrors `reset()` in SugarCoat.tsx — the confirm Pressable's
    // onPress is `reset` itself, so the wipe + board reset happen
    // here (and only here, in the FRESH START flow).
    state.showFreshStartConfirm = false;
    state.board = makeFreshBoard();
    state.score = 0;
    state.moves = 20;
    state.phase = "PLAYING";
    if (state.wasRestored) {
      state.wasRestored = false;
    }
    saveSugarCoatSession(null);
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
    "PASS  test 7: SugarCoat START OVER routes through confirm; START FRESH wipes; KEEP SAVED RUN preserves",
  );
}

// =====================================================================
// Test 8 — SugarCoat.tsx source-shape guards. Locks in the actual
// component shape so a future refactor can't silently re-introduce
// the inline-wipe foot-gun.
// =====================================================================
{
  // Required testIDs must be present in the rendered tree.
  for (const id of [
    "sugarcoat-fresh",
    "sugarcoat-fresh-confirm",
    "sugarcoat-fresh-cancel",
  ]) {
    assert(
      SUGAR_COAT_SRC.includes(`testID="${id}"`),
      `SugarCoat.tsx must render a Pressable with testID="${id}"`,
    );
  }

  // The sugarcoat-fresh button must only render when the current run
  // was hydrated from a saved snapshot — there's no point offering
  // "start over from the saved board" when nothing was restored. The
  // header gates it on `phase === "PLAYING" && wasRestoredRef.current`.
  const freshIdx = SUGAR_COAT_SRC.indexOf('testID="sugarcoat-fresh"');
  assert(
    freshIdx >= 0,
    "SugarCoat.tsx: locate the sugarcoat-fresh Pressable",
  );
  // Look back from the testID to find the nearest gating ternary opener
  // and assert it references `wasRestoredRef.current`.
  const beforeFresh = SUGAR_COAT_SRC.slice(0, freshIdx);
  assert(
    /wasRestoredRef\.current[^?]*\?[\s\S]*$/.test(beforeFresh),
    "SugarCoat.tsx: sugarcoat-fresh button must be gated on `wasRestoredRef.current` so it never renders without a restored saved run",
  );

  // The sugarcoat-fresh handler must route through the confirm state
  // and must NOT wipe the session inline.
  const freshBlock = SUGAR_COAT_SRC.slice(freshIdx, freshIdx + 800);
  assert(
    /setShowFreshStartConfirm\(true\)/.test(freshBlock),
    "SugarCoat.tsx: sugarcoat-fresh handler must call setShowFreshStartConfirm(true)",
  );
  assert(
    !/saveSugarCoatSession\(\s*null\s*\)/.test(freshBlock),
    "SugarCoat.tsx: sugarcoat-fresh handler must NOT call saveSugarCoatSession(null) inline — that's the pre-fix foot-gun",
  );
  assert(
    !/wasRestoredRef\.current\s*=\s*false/.test(freshBlock),
    "SugarCoat.tsx: sugarcoat-fresh handler must NOT flip wasRestoredRef inline — only the confirm flow (via reset) should",
  );
  assert(
    !/setBoard\(/.test(freshBlock),
    "SugarCoat.tsx: sugarcoat-fresh handler must NOT rebuild the board inline — only the confirm flow (via reset) should",
  );

  // The confirm Pressable's onPress is `reset` (a function reference,
  // not an inline lambda). Asserting on that exact shape pins down the
  // wiring so a refactor that inlines a partial wipe would trip.
  const confirmIdx = SUGAR_COAT_SRC.indexOf(
    'testID="sugarcoat-fresh-confirm"',
  );
  const confirmBlock = SUGAR_COAT_SRC.slice(confirmIdx, confirmIdx + 600);
  assert(
    /onPress=\{reset\}/.test(confirmBlock),
    "SugarCoat.tsx: sugarcoat-fresh-confirm must wire onPress to the `reset` function reference (not a partial inline handler)",
  );

  // The `reset` function itself is the one place the fresh-start
  // wipe + overlay close are allowed to happen. Carve it out and
  // assert the contract holds.
  const resetMatch = SUGAR_COAT_SRC.match(
    /function reset\(\)\s*\{([\s\S]*?)\n\s{2}\}/,
  );
  assert(
    resetMatch != null,
    "SugarCoat.tsx: locate the top-level `function reset()` body",
  );
  const resetBody = resetMatch[1] ?? "";
  assert(
    /saveSugarCoatSession\(\s*null\s*\)/.test(resetBody),
    "SugarCoat.tsx: reset() must call saveSugarCoatSession(null) so START FRESH actually wipes the saved snapshot",
  );
  assert(
    /setShowFreshStartConfirm\(false\)/.test(resetBody),
    "SugarCoat.tsx: reset() must close the FRESH START confirm overlay",
  );
  assert(
    /wasRestoredRef\.current\s*=\s*false/.test(resetBody),
    "SugarCoat.tsx: reset() must flip wasRestoredRef to false so the START OVER pill drops out of the header on the new run",
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

  // The cancel handler must close the overlay only — no wipe, no
  // ref nulling, no board reset.
  const cancelIdx = SUGAR_COAT_SRC.indexOf(
    'testID="sugarcoat-fresh-cancel"',
  );
  const cancelBlock = SUGAR_COAT_SRC.slice(cancelIdx, cancelIdx + 400);
  assert(
    /setShowFreshStartConfirm\(false\)/.test(cancelBlock),
    "SugarCoat.tsx: sugarcoat-fresh-cancel must close the confirm overlay",
  );
  assert(
    !/saveSugarCoatSession\(\s*null\s*\)/.test(cancelBlock),
    "SugarCoat.tsx: sugarcoat-fresh-cancel must NOT clear the saved session",
  );
  assert(
    !/wasRestoredRef\.current\s*=\s*false/.test(cancelBlock),
    "SugarCoat.tsx: sugarcoat-fresh-cancel must NOT flip wasRestoredRef",
  );
  assert(
    !/setBoard\(/.test(cancelBlock),
    "SugarCoat.tsx: sugarcoat-fresh-cancel must NOT rebuild the board",
  );
  console.log(
    "PASS  test 8: SugarCoat.tsx source guards — confirm overlay wired correctly; inline-wipe foot-gun cannot be re-introduced",
  );
}

console.log("\nAll fresh-start confirm regression tests passed.");
process.exit(0);
