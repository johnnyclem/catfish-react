/**
 * Verifies the post-audit AccusationSheet pathway: the store accepts
 * `accuse({ accusedCandidateId })` and decides killer-vs-decoy from
 * the candidate row itself, NOT from the (now-decoy-undefined)
 * `Candidate.identity` field.
 *
 * Pre-audit, every decoy was stamped with the killer's identity
 * slot, which made every "accuse" auto-resolve as `caughtThem`
 * regardless of which candidate the player tapped. This test pins
 * that bug shut by:
 *
 *   1. Asserting decoy candidates have NO `identity` (the type
 *      change in `models.ts` plus the decoyPool fix).
 *   2. Accusing a decoy via `accusedCandidateId` returns
 *      `wrongfulAccusation` even on a run where the killer-candidate
 *      sits elsewhere in the same deck.
 *   3. Accusing the killer-candidate via `accusedCandidateId` on a
 *      run with the full required-fact chain returns `caughtThem`.
 *   4. `accuse({ accusedCandidateId })` against an unknown id is a
 *      no-op (returns null, leaves the run open).
 *   5. Captured facts from a decoy chat-message commit leave
 *      `aboutCharacter` undefined but stamp
 *      `capturedFromCandidateId` correctly — the AccusationSheet's
 *      per-row tally keys off the latter.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:accuse-by-candidate-id
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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    process.exit(1);
  }
}

const state = useGameState.getState;

// ─── Test 1: decoys carry no identity slot ─────────────────────────────
{
  await state().resetRun();
  await state().startNewRun("miles");
  const run = state().run!;

  const killerCand = run.deck.find((c) => c.isKillerCandidate);
  assert(killerCand, "every run should have exactly one killer-candidate");
  assert(
    killerCand!.identity === "miles",
    "killer-candidate's identity slot equals run.killer",
  );

  const decoys = run.deck.filter((c) => !c.isKillerCandidate);
  assert(decoys.length > 0, "fresh deck contains decoys");
  for (const d of decoys) {
    assert(
      d.identity === undefined,
      `decoy ${d.displayName} must leave identity undefined (got ${d.identity ?? "undefined"})`,
    );
  }
  console.log(
    `PASS  test 1: killer-candidate carries identity, all ${decoys.length} decoys do not`,
  );
}

// ─── Test 2: accusing a decoy via id resolves to wrongfulAccusation ────
{
  await state().resetRun();
  await state().startNewRun("miles");
  const run = state().run!;
  const decoy = run.deck.find((c) => !c.isKillerCandidate)!;

  const result = await state().accuse({
    accusedCandidateId: decoy.id,
    outcome: "accuse",
  });
  assert(result, "accuse({accusedCandidateId}) returns a result for a decoy");
  assert(
    result!.ending === "wrongfulAccusation",
    `decoy accusation must close as wrongfulAccusation (got ${result!.ending})`,
  );
  assert(
    result!.correct === false,
    "wrongful accusation reads as correct: false",
  );
  assert(
    result!.matchedDeduction === null,
    "wrongful accusation never carries a matched deduction",
  );

  const after = state().run!;
  assert(after.closed === true, "wrongful accusation still closes the run");
  console.log("PASS  test 2: decoy via accusedCandidateId → wrongfulAccusation");
}

// ─── Test 3: accusing the killer-candidate via id wins on full chain ───
{
  await state().resetRun();
  await state().startNewRun("miles");
  const run = state().run!;
  const killerCand = run.deck.find((c) => c.isKillerCandidate)!;

  // The accuse path gates discovered facts through `isFactRevealedYet`,
  // so the full chain only counts once the killer is matched and the
  // day clock has reached the day-5 portrait fact: swipe the deck
  // (right on the killer), then sleep to day 5.
  while (state().run!.deckCursor < state().run!.deck.length) {
    const cur = state().run!;
    const card = cur.deck[cur.deckCursor];
    const ok = await state().swipe(
      card.id,
      card.id === killerCand.id ? "right" : "left",
    );
    assert(ok === true, `swipe on ${card.displayName} should be accepted`);
  }
  while (state().run!.day < 5) {
    await state().advanceDay();
  }
  assert(
    state().run!.matches.some((m) => m.candidateId === killerCand.id),
    "killer should be matched after the overnight resolver",
  );

  const result = await state().accuse({
    accusedCandidateId: killerCand.id,
    outcome: "accuse",
  });
  assert(result, "accuse({accusedCandidateId}) returns a result for the killer");
  assert(
    result!.ending === "caughtThem" && result!.correct === true,
    `killer-candidate accusation with full chain should resolve to caughtThem (got ${result!.ending})`,
  );
  assert(
    result!.matchedDeduction !== null,
    "caughtThem result carries the matched deduction",
  );

  const after = state().run!;
  assert(after.closed === true, "correct accusation closes the run");
  console.log("PASS  test 3: killer-candidate via accusedCandidateId → caughtThem");
}

// ─── Test 4: unknown candidate id is a no-op ───────────────────────────
{
  await state().resetRun();
  await state().startNewRun("miles");
  const beforeRun = state().run!;
  const result = await state().accuse({
    accusedCandidateId: "candidate_does_not_exist",
    outcome: "accuse",
  });
  assert(result === null, "unknown accusedCandidateId returns null");
  const after = state().run!;
  assert(
    after.closed === false,
    "unknown id leaves the run open (no spurious close)",
  );
  assert(
    after.facts.length === beforeRun.facts.length,
    "unknown id leaves the fact list untouched",
  );
  console.log("PASS  test 4: unknown accusedCandidateId is a clean no-op");
}

// ─── Test 5: decoy capture stamps capturedFromCandidateId, not aboutCharacter
{
  await state().resetRun();
  await state().startNewRun("miles");
  const run = state().run!;
  const decoy = run.deck.find((c) => !c.isKillerCandidate)!;

  const captured = await state().commitFact({
    candidateId: decoy.id,
    quote: "I never go near the canal.",
    threadId: undefined,
    messageId: undefined,
  });
  assert(captured, "commitFact returns the new fact for a decoy capture");
  assert(
    captured!.capturedFromCandidateId === decoy.id,
    "capturedFromCandidateId pins the actual decoy candidate",
  );
  assert(
    captured!.aboutCharacter === undefined,
    `decoy capture leaves aboutCharacter undefined (got ${String(captured!.aboutCharacter)})`,
  );

  // And a killer-candidate capture still stamps `aboutCharacter` with
  // the killer's slot — we have NOT broken the authored-evidence path.
  const killerCand = state().run!.deck.find((c) => c.isKillerCandidate)!;
  const killerCapture = await state().commitFact({
    candidateId: killerCand.id,
    quote: "The window was open. So what?",
    threadId: undefined,
    messageId: undefined,
  });
  assert(
    killerCapture!.aboutCharacter === "miles",
    "killer-candidate capture preserves aboutCharacter for the journal's grouping",
  );
  console.log(
    "PASS  test 5: decoy captures leave aboutCharacter undefined; killer captures still stamp it",
  );
}

// ─── Test 6: migrateRun scrubs legacy decoy identity stamp ─────────────
{
  // Simulate a pre-fix persisted run where every decoy had been
  // stamped with the killer's identity slot. We round-trip through
  // the actual repository + migration path the store uses on cold
  // start so this catches regressions if either layer ever skips
  // the scrub.
  await state().resetRun();
  await state().startNewRun("miles");
  const live = state().run!;
  // Hand-corrupt the live run the same way the pre-fix decoyPool did:
  // every non-killer candidate gets stamped with `identity: <killer>`,
  // and one captured fact gets the matching legacy `aboutCharacter`.
  const corruptedDeck = live.deck.map((c) =>
    c.isKillerCandidate ? c : { ...c, identity: live.killer },
  );
  const decoy = corruptedDeck.find((c) => !c.isKillerCandidate)!;
  const corruptedFact = {
    id: "fact_legacy_decoy_capture" as unknown as string,
    runId: live.id,
    kind: "captured" as const,
    authoringKey: "captured_legacy_decoy_msg",
    source: { kind: "chatMessage" as const, threadId: undefined, messageId: "msg_x" },
    day: 2,
    // Legacy stamp: pre-fix builds wrote the killer's slot here even
    // though the source candidate was a decoy.
    aboutCharacter: live.killer,
    payload: { text: "Honestly I work nights, never near the canal." },
    payloadJson: JSON.stringify({ kind: "captured", quote: "x" }),
    committed: true,
    capturedFromCandidateId: decoy.id,
    capturedFromMessageId: "msg_x",
    capturedQuote: "Honestly I work nights, never near the canal.",
    capturedOnDay: 2,
    capturedAt: "2026-04-25T00:00:00.000Z",
  } as unknown as (typeof live.facts)[number];

  const corruptedRun = {
    ...live,
    deck: corruptedDeck,
    facts: [...live.facts, corruptedFact],
  };

  const { saveActiveRun, loadActiveRun } = await import(
    "../core/repository.ts"
  );
  const { migrateRun } = await import("../core/gameStore.ts");
  await saveActiveRun(corruptedRun);
  const persisted = await loadActiveRun();
  assert(persisted, "corrupted run reloads from storage");
  const hydrated = migrateRun(persisted)!;
  assert(hydrated, "migrateRun returns a non-null run for a corrupted blob");

  // Deck scrub: every non-killer row must have `identity: undefined`.
  const decoysAfter = hydrated.deck.filter((c) => !c.isKillerCandidate);
  for (const d of decoysAfter) {
    assert(
      d.identity === undefined,
      `migration must drop identity stamp on decoy ${d.displayName} (got ${String(d.identity)})`,
    );
  }
  // Killer-candidate is left intact.
  const killerAfter = hydrated.deck.find((c) => c.isKillerCandidate)!;
  assert(
    killerAfter.identity === live.killer,
    "killer-candidate's identity slot survives migration",
  );

  // Captured-fact scrub: the legacy decoy capture must lose its stale
  // `aboutCharacter` stamp.
  const migratedFact = hydrated.facts.find(
    (f) => f.id === ("fact_legacy_decoy_capture" as unknown as typeof f.id),
  )!;
  assert(migratedFact, "the legacy decoy capture is preserved on the row list");
  assert(
    migratedFact.aboutCharacter === undefined,
    `migration must clear stale aboutCharacter on a decoy capture (got ${String(migratedFact.aboutCharacter)})`,
  );
  assert(
    migratedFact.capturedFromCandidateId === decoy.id,
    "capturedFromCandidateId is preserved by migration (UI grouping keys off it)",
  );

  console.log(
    "PASS  test 6: migrateRun scrubs legacy decoy identity + stale aboutCharacter",
  );
}

await state().resetRun();
console.log("\nAll accuse-by-candidate-id tests passed.");
process.exit(0);
