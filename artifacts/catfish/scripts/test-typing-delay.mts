/**
 * Programmatic verification of the length-aware suspect typing beat
 * (`nextSuspectDelayMs` in `core/gameStore.ts`). Locks in the
 * floor/ceiling/jitter contract introduced by Task #63 so a future
 * tweak can't silently regress short lines back to feeling sluggish
 * or push long lines past the 6s ceiling.
 *
 * Stubs AsyncStorage with the in-memory shim used by the rest of the
 * test:* scripts so the Zustand store can load under plain Node
 * without React Native or Expo shims.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:typing-delay
 *
 * Asserts (in order):
 *   1. Very short text always lands in the floor band (~2.0–2.5s).
 *   2. Mid-length text scales with character count plus jitter, and a
 *      strictly longer line lands at a strictly higher mean delay.
 *   3. Very long text always clamps to the ceiling band (~5.5–6.0s).
 *   4. Undefined / empty text still respects the floor band.
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

const {
  __nextSuspectDelayMsForTests: nextSuspectDelayMs,
  __SUSPECT_DELAY_MIN_MS_FOR_TESTS: MIN,
  __SUSPECT_DELAY_MAX_MS_FOR_TESTS: MAX,
  __SUSPECT_DELAY_PER_CHAR_MS_FOR_TESTS: PER_CHAR,
  __SUSPECT_DELAY_JITTER_MS_FOR_TESTS: JITTER,
} = await import("../core/gameStore.ts");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    process.exit(1);
  }
}

const ITERATIONS = 1000;

interface Sample {
  min: number;
  max: number;
  mean: number;
}

function sample(text?: string): Sample {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const v = nextSuspectDelayMs(text);
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, mean: sum / ITERATIONS };
}

// --- Test 1: very short text lands in the floor band.
//
// "hi" → perChar = 70ms → clamped up to MIN (2000ms). After ±JITTER
// and re-clamp the result must sit in [MIN, MIN + JITTER] = [2000,
// 2500]. The mean should land somewhere strictly inside that band
// (not pinned to either edge), proving the jitter actually fires.
{
  const { min, max, mean } = sample("hi");
  assert(min >= MIN, `short: min ${min} >= ${MIN}`);
  assert(
    max <= MIN + JITTER,
    `short: max ${max} <= MIN + JITTER (${MIN + JITTER})`,
  );
  assert(
    mean > MIN + JITTER * 0.1 && mean < MIN + JITTER * 0.9,
    `short: mean ${mean.toFixed(1)} sits strictly inside floor band ` +
      `(${MIN + JITTER * 0.1}, ${MIN + JITTER * 0.9})`,
  );
  console.log(
    `PASS  test 1: short text floor band [${min}, ${max}] ` +
      `mean ${mean.toFixed(1)}`,
  );
}

// --- Test 2: mid-length text scales with character count plus jitter.
//
// 100 chars × 35ms = 3500ms baseline, comfortably between floor and
// ceiling, so jitter is the only adjustment. A 70-char input should
// land at a strictly lower mean delay than a 100-char input — that's
// the whole point of Task #63.
{
  const longerLen = 100;
  const baselineLong = longerLen * PER_CHAR;
  const longer = sample("x".repeat(longerLen));
  assert(
    longer.min >= Math.max(MIN, baselineLong - JITTER),
    `mid (long): min ${longer.min} >= baseline-jitter ` +
      `(${Math.max(MIN, baselineLong - JITTER)})`,
  );
  assert(
    longer.max <= Math.min(MAX, baselineLong + JITTER),
    `mid (long): max ${longer.max} <= baseline+jitter ` +
      `(${Math.min(MAX, baselineLong + JITTER)})`,
  );
  // Mean should track the per-char baseline tightly. 1000 samples of
  // an integer-uniform jitter on [-500,500] gives a standard error of
  // the mean ≈ 9ms, so JITTER * 0.25 (= 125ms) is a comfortable bound
  // that's still tight enough to catch a regression to the floor.
  assert(
    Math.abs(longer.mean - baselineLong) < JITTER * 0.25,
    `mid (long): mean ${longer.mean.toFixed(1)} ≈ baseline ${baselineLong}`,
  );

  const shorterLen = 70;
  const shorter = sample("x".repeat(shorterLen));
  assert(
    shorter.mean < longer.mean - JITTER * 0.5,
    `mid: shorter mean ${shorter.mean.toFixed(1)} clearly below ` +
      `longer mean ${longer.mean.toFixed(1)}`,
  );
  console.log(
    `PASS  test 2: mid-length scales — ${shorterLen}ch mean ` +
      `${shorter.mean.toFixed(1)}, ${longerLen}ch mean ` +
      `${longer.mean.toFixed(1)}`,
  );
}

// --- Test 3: very long text clamps to the ceiling band.
//
// 500 chars × 35ms = 17500ms → clamped to MAX (6000ms). After ±JITTER
// and re-clamp the result must sit in [MAX - JITTER, MAX] = [5500,
// 6000].
{
  const { min, max, mean } = sample("x".repeat(500));
  assert(
    min >= MAX - JITTER,
    `long: min ${min} >= MAX - JITTER (${MAX - JITTER})`,
  );
  assert(max <= MAX, `long: max ${max} <= ${MAX}`);
  assert(
    mean > MAX - JITTER * 0.9 && mean < MAX - JITTER * 0.1,
    `long: mean ${mean.toFixed(1)} sits strictly inside ceiling band ` +
      `(${MAX - JITTER * 0.9}, ${MAX - JITTER * 0.1})`,
  );
  console.log(
    `PASS  test 3: long text ceiling band [${min}, ${max}] ` +
      `mean ${mean.toFixed(1)}`,
  );
}

// --- Test 4: undefined / empty text still respects the floor band.
{
  for (const empty of [undefined, ""] as const) {
    const label = JSON.stringify(empty);
    const { min, max } = sample(empty);
    assert(min >= MIN, `empty (${label}): min ${min} >= ${MIN}`);
    assert(
      max <= MIN + JITTER,
      `empty (${label}): max ${max} <= MIN + JITTER (${MIN + JITTER})`,
    );
  }
  console.log(`PASS  test 4: undefined/empty text respects floor band`);
}

console.log("\nAll typing-delay tests passed.");
process.exit(0);
