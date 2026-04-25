/**
 * Programmatic verification of the Pass-4 Clue Graph schema.
 *
 * Stubs AsyncStorage with the same in-memory map as the undo-queue
 * test so the Zustand store + the bootstrapper can run under plain
 * Node without any React Native shims.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:clue-graph
 *
 * Asserts (in order):
 *   1. `buildAuthoredFacts` materializes static + variable + the
 *      killer's conditional facts; conditional facts the killer
 *      doesn't own are NOT materialized.
 *   2. The "double-blind tell" works: Miles and Jules both see the
 *      same `miles_bio_downtown_view` row, but its payload text
 *      diverges based on which of them is the killer.
 *   3. `startNewRun` populates `run.facts` with the authored set.
 *   4. `commitFact` appends a row with `kind: "captured"`, the new
 *      typed `source`/`payload`/`day`/`aboutCharacter` fields, AND
 *      preserves the legacy `payloadJson`/`captured*` breadcrumbs.
 *   5. `resolveAccusation` covers all four `CaseEnding`s:
 *        - correct + full chain → `caughtThem` with matchedDeduction
 *        - correct + partial    → `caughtThem` with no deduction
 *        - wrong accusation     → `wrongfulAccusation`
 *        - "metKiller" outcome  → `metKillerStub`
 *        - "escaped" outcome    → `escapedStub`
 *   6. `migrateRun` backfills the new fields on a pre-Pass-4 run
 *      blob without dropping data and without injecting authored
 *      facts retroactively.
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

const { useGameState, migrateRun } = await import("../core/gameStore.ts");
const { buildAuthoredFacts, getAuthoredFactUniverse } = await import(
  "../core/factBootstrap.ts"
);
const { resolveAccusation } = await import("../core/accusation.ts");
const { saveActiveRun, loadActiveRun } = await import("../core/repository.ts");
const { newRunId } = await import("../core/models.ts");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    process.exit(1);
  }
}

const state = useGameState.getState;

// ─── Test 1: bootstrapper inclusion rules ──────────────────────────────
{
  const runId = newRunId();
  const milesFacts = buildAuthoredFacts(runId, "miles");
  const julesFacts = buildAuthoredFacts(runId, "jules");
  const universe = getAuthoredFactUniverse();

  const milesKeys = new Set(milesFacts.map((f) => f.authoringKey));
  const julesKeys = new Set(julesFacts.map((f) => f.authoringKey));

  // Static + variable always present for both.
  for (const row of universe) {
    if (row.kind === "static" || row.kind === "variable") {
      assert(
        milesKeys.has(row.id),
        `Miles run should include ${row.kind} fact ${row.id}`,
      );
      assert(
        julesKeys.has(row.id),
        `Jules run should include ${row.kind} fact ${row.id}`,
      );
    }
  }

  // Miles owns his two conditional rows, jules owns his two.
  assert(
    milesKeys.has("miles_portrait_uneasy_day5") &&
      milesKeys.has("dev_text_day4_miles_sus"),
    "Miles run should include Miles's two conditional facts",
  );
  assert(
    !milesKeys.has("jules_portrait_sinister_day5") &&
      !milesKeys.has("dev_text_day4_jules_sus"),
    "Miles run must NOT include Jules's conditional facts",
  );
  assert(
    julesKeys.has("jules_portrait_sinister_day5") &&
      julesKeys.has("dev_text_day4_jules_sus"),
    "Jules run should include Jules's two conditional facts",
  );
  assert(
    !julesKeys.has("miles_portrait_uneasy_day5") &&
      !julesKeys.has("dev_text_day4_miles_sus"),
    "Jules run must NOT include Miles's conditional facts",
  );

  // None of the other-killer conditional rows leak into Miles's
  // or Jules's run. Pass 4 added per-killer day-5 portrait
  // conditionals alongside the original devText alibi rows, so the
  // foreign list now covers both.
  const foreignConditionals = [
    "tessa_conditional_lateshift",
    "tessa_portrait_uneasy_day5",
    "ren_conditional_dawn_alibi",
    "ren_portrait_sinister_day5",
    "kai_conditional_paint_late",
    "kai_portrait_sinister_day5",
    "delphine_conditional_smell_secret",
    "delphine_portrait_uneasy_day5",
    "river_conditional_solo_scout",
    "river_portrait_sinister_day5",
    "sam_conditional_double_shift",
    "sam_portrait_sinister_day5",
  ];
  for (const id of foreignConditionals) {
    assert(
      !milesKeys.has(id),
      `Miles run must NOT include foreign conditional ${id}`,
    );
    assert(
      !julesKeys.has(id),
      `Jules run must NOT include foreign conditional ${id}`,
    );
  }
  console.log("PASS  test 1: bootstrapper inclusion rules");
}

// ─── Test 2: double-blind variable swap ────────────────────────────────
{
  const runId = newRunId();
  const milesFacts = buildAuthoredFacts(runId, "miles");
  const julesFacts = buildAuthoredFacts(runId, "jules");

  const milesView = milesFacts.find(
    (f) => f.authoringKey === "miles_bio_downtown_view",
  );
  const julesView = julesFacts.find(
    (f) => f.authoringKey === "miles_bio_downtown_view",
  );
  assert(
    milesView && julesView,
    "Both runs should carry the miles_bio_downtown_view variable row",
  );
  assert(
    milesView!.payload.text !== julesView!.payload.text,
    "Variable payload should diverge between Miles-killer and Jules-killer runs",
  );
  assert(
    milesView!.payload.text.includes("warehouse"),
    "Miles override mentions the warehouse strip",
  );
  assert(
    julesView!.payload.text.includes("Jules"),
    "Jules override re-frames Miles's view in terms of Jules's bar",
  );

  // jules_bio_night_walks should also flip when Jules is killer
  // (his override) but stay default when Miles is.
  const milesNightWalks = milesFacts.find(
    (f) => f.authoringKey === "jules_bio_night_walks",
  );
  const julesNightWalks = julesFacts.find(
    (f) => f.authoringKey === "jules_bio_night_walks",
  );
  assert(
    milesNightWalks && julesNightWalks,
    "jules_bio_night_walks should be present in both runs (variable)",
  );
  assert(
    milesNightWalks!.payload.text !== julesNightWalks!.payload.text,
    "jules_bio_night_walks should swap when Jules is the killer",
  );
  assert(
    julesNightWalks!.payload.text.includes("warehouse"),
    "Jules-killer override of jules_bio_night_walks names the warehouse strip",
  );

  console.log("PASS  test 2: double-blind variable payload swap");
}

// ─── Test 3: startNewRun materializes authored facts ───────────────────
{
  await state().startNewRun("miles");
  const run = state().run!;
  assert(run, "run exists after startNewRun");
  assert(run.killer === "miles", "run.killer is Miles");
  // Authored set, computed against the loaded universe: every
  // static + variable row, plus only Miles's own conditional rows.
  // (Pass 4 added per-killer variable bio/IG rows for every killer
  // and a day-5 portrait conditional for each, so this count is
  // expected to grow each time a new authored killer lands —
  // computing dynamically keeps the test from drifting silently.)
  const universe = getAuthoredFactUniverse();
  const milesConditionalIDs = new Set([
    "miles_portrait_uneasy_day5",
    "dev_text_day4_miles_sus",
  ]);
  const expectedAuthored = universe.filter(
    (row) =>
      row.kind === "static" ||
      row.kind === "variable" ||
      (row.kind === "conditional" && milesConditionalIDs.has(row.id)),
  ).length;
  const authored = run.facts.filter((f) => f.kind !== "captured");
  assert(
    authored.length === expectedAuthored,
    `expected ${expectedAuthored} authored facts for Miles run, got ${authored.length}`,
  );
  assert(
    run.facts.every((f) => f.runId === run.id),
    "every authored fact carries the run id",
  );
  assert(
    run.facts.every(
      (f) => typeof f.payload?.text === "string" && f.payload.text.length > 0,
    ),
    "every authored fact has a non-empty payload.text",
  );
  console.log("PASS  test 3: startNewRun populates authored facts");
}

// ─── Test 4: commitFact populates new + legacy fields ──────────────────
{
  const run = state().run!;
  const candidate = run.deck[0]!;
  const captured = await state().commitFact({
    candidateId: candidate.id,
    quote: "I close most weeknights.",
    threadId: undefined,
    messageId: undefined,
  });
  assert(captured, "commitFact returns the new fact");
  assert(captured!.kind === "captured", "captured fact has kind 'captured'");
  assert(
    captured!.source.kind === "chatMessage",
    "captured fact source is chatMessage",
  );
  assert(captured!.day === run.day, "captured fact stamped with run day");
  assert(
    captured!.aboutCharacter === candidate.identity,
    "captured fact aboutCharacter matches the candidate's identity",
  );
  assert(
    captured!.payload.text === "I close most weeknights.",
    "captured payload.text matches the quote",
  );
  // Back-compat fields preserved for the existing FactCard renderer.
  assert(
    captured!.capturedQuote === "I close most weeknights.",
    "captured legacy capturedQuote preserved",
  );
  assert(
    captured!.capturedOnDay === run.day,
    "captured legacy capturedOnDay preserved",
  );
  assert(
    typeof captured!.payloadJson === "string" &&
      captured!.payloadJson.includes("captured"),
    "captured legacy payloadJson populated",
  );
  console.log("PASS  test 4: commitFact populates new + legacy fields");
}

// ─── Test 5: resolveAccusation covers all four endings ─────────────────
{
  const run = state().run!;
  // Authored Facts use their authoring key as their `Fact.id` (see
  // `factBootstrap.buildAuthoredFacts`), so the accusation resolver's
  // `requiredFactIDs` (themselves authoring keys) subset-check works
  // uniformly against either field. No casts needed — pass `f.id`
  // straight through.
  const allDiscoveredIds = new Set(run.facts.map((f) => f.id));

  // Lock the invariant in: every authored fact has `id ===
  // authoringKey`. If a future change reintroduces random per-row
  // ids for authored rows, the resolver silently breaks — make that
  // failure loud here.
  for (const f of run.facts) {
    if (f.kind !== "captured") {
      assert(
        f.id === f.authoringKey,
        `authored fact ${f.authoringKey} must use its authoring key as id; got ${f.id}`,
      );
    }
  }

  // 5a — wrong accusation.
  const wrong = resolveAccusation({
    accused: "tessa",
    run,
    discoveredFactIds: allDiscoveredIds,
  });
  assert(
    wrong.ending === "wrongfulAccusation" &&
      wrong.correct === false &&
      wrong.matchedDeduction === null,
    "wrong accusation -> wrongfulAccusation, no matched deduction",
  );

  // 5b — correct + partial chain (drop one required fact).
  // Authoring keys are plain strings, and `FactId = string`, so these
  // literals assign without any cast.
  const requiredKeys = [
    "miles_bio_downtown_view",
    "miles_ig_window_reflection",
    "miles_portrait_uneasy_day5",
    "dev_text_day4_miles_sus",
  ];
  const requiredIds = new Set(requiredKeys);
  // Sanity: every required authoring key was actually materialized
  // for the Miles run (otherwise the resolver test is meaningless).
  // We look the row up by `id` here (not `authoringKey`) to also
  // exercise the new invariant: id === authoringKey for authored rows.
  for (const k of requiredKeys) {
    assert(
      run.facts.some((f) => f.id === k),
      `expected required fact ${k} to be in the materialized run with id === authoringKey`,
    );
  }

  const partial = new Set(requiredIds);
  // Remove one — verify resolver detects the missing link.
  const drop = [...partial][0]!;
  partial.delete(drop);
  const weak = resolveAccusation({
    accused: "miles",
    run,
    discoveredFactIds: partial,
  });
  assert(
    weak.ending === "caughtThem" &&
      weak.correct === true &&
      weak.matchedDeduction === null,
    "correct accusation, partial chain -> caughtThem with no matched deduction",
  );

  // 5c — correct + full chain.
  const full = resolveAccusation({
    accused: "miles",
    run,
    discoveredFactIds: requiredIds,
  });
  assert(
    full.ending === "caughtThem" &&
      full.correct === true &&
      full.matchedDeduction !== null &&
      full.matchedDeduction!.id === "miles_solve_canal_warehouse",
    "correct accusation, full chain -> caughtThem with Miles's solving deduction",
  );
  assert(
    full.narrativeBeat.includes("window"),
    "matched-deduction narrative beat surfaces in the result",
  );

  // 5d — metKiller stub. Correct identity passed through, but no
  // deduction matched (face-to-face flow doesn't require evidence).
  const met = resolveAccusation({
    accused: "miles",
    run,
    discoveredFactIds: new Set(),
    outcome: "metKiller",
  });
  assert(
    met.ending === "metKillerStub" &&
      met.correct === true &&
      met.matchedDeduction === null,
    "metKiller outcome -> metKillerStub",
  );

  // 5e — escaped stub. Always wrong, always no deduction.
  const escaped = resolveAccusation({
    accused: "miles",
    run,
    discoveredFactIds: requiredIds,
    outcome: "escaped",
  });
  assert(
    escaped.ending === "escapedStub" &&
      escaped.correct === false &&
      escaped.matchedDeduction === null,
    "escaped outcome -> escapedStub (always 'incorrect')",
  );
  console.log("PASS  test 5: resolveAccusation covers all four endings");
}

// ─── Test 6: migrateRun backfills legacy persisted runs ────────────────
{
  // Build a synthetic pre-Pass-4 blob. Simulates what `loadActiveRun`
  // would yield from a JSON write done by an older build: captured
  // fact rows that lack `kind`/`source`/`day`/`aboutCharacter`/`payload`.
  const liveRun = state().run!;
  const aCandidate = liveRun.deck[0]!;
  const legacyFact = {
    id: "fact_legacy_1" as unknown as ReturnType<typeof newRunId>,
    runId: liveRun.id,
    authoringKey: "captured_legacy_msg_1",
    payloadJson: JSON.stringify({
      kind: "captured",
      quote: "legacy quote text",
      threadId: null,
      messageId: "msg_1",
    }),
    committed: true,
    capturedFromCandidateId: aCandidate.id,
    capturedFromMessageId: "msg_1" as unknown as string,
    capturedQuote: "legacy quote text",
    capturedOnDay: 2,
    capturedAt: "2026-04-25T00:00:00.000Z",
  } as unknown as (typeof liveRun.facts)[number];

  const legacyRun = {
    ...liveRun,
    day: 3,
    facts: [legacyFact],
  };

  await saveActiveRun(legacyRun);
  // Round-trip through the actual persistence + migration path the
  // store uses on cold start. We invoke them directly here because
  // `hydrate()` caches its promise across calls (so it would no-op
  // after the earlier `startNewRun` already populated the store).
  const persisted = await loadActiveRun();
  assert(persisted, "persisted run reloads from storage");
  const hydrated = migrateRun(persisted)!;
  assert(hydrated, "migrateRun returns a non-null run for a legacy blob");
  assert(
    hydrated.facts.length === 1,
    "no extra authored facts injected into a legacy in-flight run",
  );
  const migrated = hydrated.facts[0]!;
  assert(migrated.kind === "captured", "legacy fact backfilled with kind");
  assert(
    migrated.source && migrated.source.kind === "chatMessage",
    "legacy fact backfilled with chatMessage source",
  );
  assert(
    migrated.source.kind === "chatMessage" &&
      migrated.source.messageId === ("msg_1" as unknown as string),
    "legacy source.messageId preserved from capturedFromMessageId",
  );
  assert(migrated.day === 2, "legacy fact day backfilled from capturedOnDay");
  assert(
    migrated.aboutCharacter === aCandidate.identity,
    "aboutCharacter derived from capturedFromCandidateId's identity",
  );
  assert(
    migrated.payload && migrated.payload.text === "legacy quote text",
    "legacy payload.text lifted from capturedQuote",
  );
  // Round-trip sanity: the legacy fields stay where they were so the
  // existing FactCard rendering path keeps working.
  assert(
    migrated.capturedQuote === "legacy quote text" &&
      migrated.capturedOnDay === 2,
    "legacy capture breadcrumbs preserved post-migration",
  );

  console.log(
    "PASS  test 6: migrateRun backfills pre-Pass-4 captured facts",
  );
}

await state().resetRun();
console.log("\nAll Clue Graph tests passed.");
process.exit(0);
