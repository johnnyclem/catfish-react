/**
 * Content-integrity lint — proves every "level" (killer variant) is
 * actually winnable by cross-referencing the authored content tables
 * against each other:
 *
 *   1. Every killer's deck carries exactly one killer-candidate whose
 *      identity slot matches the run's killer.
 *   2. Every killer has a solving deduction, and every required fact
 *      id materializes for that killer's run AND passes the
 *      `isFactRevealedYet` gate on a day-7 run where the killer was
 *      matched — i.e. the win condition is reachable by play.
 *   3. Every evidence-chain definition references facts that exist in
 *      the fact universe; chains pointed at a killer only reference
 *      facts that materialize (and reveal) for that killer's run.
 *   4. For every killer there exists a selection of at most 3 chains
 *      (the AccusationStep3 cap) covering at least 80% of the solving
 *      deduction's required facts — so the "full evidence" verdict is
 *      achievable on every run.
 *   5. Every voicemail's `linkedFactId` resolves to a fact that
 *      materializes for the killer(s) the voicemail can appear under.
 *   6. Chain definitions don't duplicate a pair (in either order) and
 *      never link a fact to itself.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:content-integrity
 */

import type { CaseRun, Fact, KillerIdentity } from "../core/models.ts";

const { CHAIN_DEFINITIONS } = await import("../core/evidenceChains.ts");
const { buildAuthoredFacts, getAuthoredFactUniverse, isFactRevealedYet } =
  await import("../core/factBootstrap.ts");
const { getIdentityModule } = await import("../core/identities.ts");
const { ALL_KILLERS } = await import("../core/models.ts");
const { AUTHORED_VOICEMAILS } = await import("../core/voicemailContent.ts");

let failures = 0;

function fail(msg: string): void {
  failures += 1;
  console.error("FAIL ", msg);
}

function pass(msg: string): void {
  console.log("PASS ", msg);
}

const universeIds = new Set(getAuthoredFactUniverse().map((f) => f.id));

/**
 * Synthesize the end-state run a thorough player reaches: full deck
 * swiped, the killer matched, day clock at 7. `isFactRevealedYet`
 * checked against this run answers "is the fact discoverable at all
 * before the case auto-closes".
 */
function buildFullyPlayedRun(killer: KillerIdentity): {
  run: CaseRun;
  factsById: Map<string, Fact>;
} {
  const identity = getIdentityModule(killer);
  const deck = identity.buildDeck();
  const killerCand = deck.find((c) => c.isKillerCandidate);
  const facts = buildAuthoredFacts("run_lint", killer);
  const run: CaseRun = {
    id: "run_lint",
    killer,
    startedAt: new Date().toISOString(),
    day: 7,
    deck,
    deckCursor: deck.length,
    swipes: [],
    matches: killerCand
      ? [
          {
            id: "match_lint",
            runId: "run_lint",
            candidateId: killerCand.id,
            matchedOnDay: 2,
            matchedAt: new Date().toISOString(),
            threadId: "thread_lint",
            unmatched: false,
          },
        ]
      : [],
    threads: [],
    facts,
    closed: false,
  };
  return { run, factsById: new Map(facts.map((f) => [f.id, f])) };
}

// ─── Per-killer checks ──────────────────────────────────────────────────
for (const killer of ALL_KILLERS) {
  const identity = getIdentityModule(killer);
  const { run, factsById } = buildFullyPlayedRun(killer);

  // 1. Deck sanity.
  const killerCands = run.deck.filter((c) => c.isKillerCandidate);
  if (killerCands.length !== 1) {
    fail(`${killer}: deck has ${killerCands.length} killer-candidates (want 1)`);
  } else if (killerCands[0].identity !== killer) {
    fail(
      `${killer}: killer-candidate identity slot is ${killerCands[0].identity}`,
    );
  }

  // 2. Solving deduction is fully discoverable.
  const deduction = identity.solvingDeduction;
  if (!deduction || deduction.requiredFactIDs.length === 0) {
    fail(`${killer}: no solving deduction — run cannot be won with evidence`);
    continue;
  }
  for (const fid of deduction.requiredFactIDs) {
    const fact = factsById.get(fid);
    if (!fact) {
      fail(`${killer}: required fact ${fid} never materializes for this run`);
      continue;
    }
    if (!isFactRevealedYet(fact, run)) {
      fail(`${killer}: required fact ${fid} is never revealed by day 7`);
    }
  }

  // 3+4. Chains pointed at this killer resolve + cover the deduction.
  const killerChains = CHAIN_DEFINITIONS.filter(
    (c) => c.aboutCandidate === killer,
  );
  if (killerChains.length === 0) {
    fail(`${killer}: no evidence-chain definitions point at this killer`);
  }
  for (const chain of killerChains) {
    for (const fid of [chain.factIdA, chain.factIdB]) {
      const fact = factsById.get(fid);
      if (!fact) {
        fail(
          `${killer}: chain "${chain.label.slice(0, 50)}…" references ${fid}, which never materializes`,
        );
      } else if (!isFactRevealedYet(fact, run)) {
        fail(
          `${killer}: chain "${chain.label.slice(0, 50)}…" references ${fid}, which is never revealed by day 7`,
        );
      }
    }
  }

  // 4. Some ≤3-chain selection covers ≥80% of the required facts (the
  // AccusationStep3 "full evidence" threshold).
  const required = deduction.requiredFactIDs;
  const need = Math.ceil(required.length * 0.8);
  let bestCover = 0;
  const pickets = killerChains.map(
    (c) => new Set([c.factIdA, c.factIdB].filter((id) => required.includes(id))),
  );
  const n = pickets.length;
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      for (let k = j; k < n; k++) {
        const cover = new Set([...pickets[i], ...pickets[j], ...pickets[k]]);
        bestCover = Math.max(bestCover, cover.size);
      }
    }
  }
  if (bestCover < need) {
    fail(
      `${killer}: best 3-chain coverage is ${bestCover}/${required.length} required facts (need ${need} for a full-evidence case)`,
    );
  }

  if (failures === 0) {
    pass(`${killer}: deck, deduction, reveal gates, and chain coverage all check out`);
  }
}

// ─── Voicemail linkage ──────────────────────────────────────────────────
for (const vm of AUTHORED_VOICEMAILS) {
  if (!vm.linkedFactId) continue;
  const killers = vm.killerGate ? [vm.killerGate] : ALL_KILLERS;
  for (const killer of killers) {
    const { factsById } = buildFullyPlayedRun(killer);
    if (vm.killerGate && !factsById.has(vm.linkedFactId)) {
      fail(
        `voicemail ${vm.id ?? vm.text?.slice(0, 30)}: linkedFactId ${vm.linkedFactId} never materializes for killer ${killer}`,
      );
    }
    if (!vm.killerGate && !universeIds.has(vm.linkedFactId)) {
      fail(
        `voicemail (ungated): linkedFactId ${vm.linkedFactId} not in fact universe`,
      );
    }
  }
}
pass("voicemail linkedFactIds all resolve");

// ─── Chain-table global hygiene ─────────────────────────────────────────
const seenPairs = new Set<string>();
for (const chain of CHAIN_DEFINITIONS) {
  if (chain.factIdA === chain.factIdB) {
    fail(`chain "${chain.label.slice(0, 50)}…" links a fact to itself`);
  }
  for (const fid of [chain.factIdA, chain.factIdB]) {
    if (!universeIds.has(fid)) {
      fail(
        `chain "${chain.label.slice(0, 50)}…" references ${fid}, which is not in factUniverse.json`,
      );
    }
  }
  const key = [chain.factIdA, chain.factIdB].sort().join("::");
  if (seenPairs.has(key)) {
    fail(`duplicate chain pair (order-insensitive): ${key}`);
  }
  seenPairs.add(key);
}
pass("chain table has no self-links, dangling ids, or duplicate pairs");

if (failures > 0) {
  console.error(`\n${failures} content-integrity failure(s).`);
  process.exit(1);
}
console.log("\nAll content-integrity checks passed.");
process.exit(0);
