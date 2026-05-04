/**
 * Programmatic verification that `migrateRun` coerces run-level
 * integer-semantic numeric fields (`day`, `deckCursor`) and that
 * `migrateFact` floors its derived `day` value.
 *
 * Stubs AsyncStorage with the same in-memory map as the other test
 * harnesses so the store module can load under plain Node.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:migrate-run-numerics
 *
 * Asserts:
 *   day        — fractional values floored, NaN / ≤0 / non-numeric → 1.
 *   deckCursor — fractional values floored, NaN / <0 / non-numeric → 0.
 *   fact.day   — fractional values floored regardless of source field.
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

const { migrateRun } = await import("../core/gameStore.ts");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    process.exit(1);
  }
}

function stubRun(overrides: Record<string, unknown>) {
  return {
    id: "run_test",
    killer: "miles" as const,
    startedAt: new Date().toISOString(),
    day: 3,
    deck: [],
    deckCursor: 0,
    swipes: [],
    matches: [],
    threads: [],
    facts: [],
    pendingLikes: [],
    pendingMatchAnnouncements: [],
    closed: false,
    endingDismissed: false,
    ...overrides,
  };
}

let testNum = 0;

console.log("── day: numeric coercion (min 1) ──");

const dayCases: Array<{
  label: string;
  input: unknown;
  expected: number;
}> = [
  { label: "number 1", input: 1, expected: 1 },
  { label: "number 3", input: 3, expected: 3 },
  { label: "number 7", input: 7, expected: 7 },
  { label: "number 3.7", input: 3.7, expected: 3 },
  { label: "number 2.9", input: 2.9, expected: 2 },
  { label: "number 1.1", input: 1.1, expected: 1 },
  { label: 'string "4.7"', input: "4.7", expected: 4 },
  { label: 'string "3"', input: "3", expected: 3 },
  { label: 'string "1"', input: "1", expected: 1 },
  { label: "undefined", input: undefined, expected: 1 },
  { label: "null", input: null, expected: 1 },
  { label: 'non-numeric string "abc"', input: "abc", expected: 1 },
  { label: "empty string", input: "", expected: 1 },
  { label: "object {}", input: {}, expected: 1 },
  { label: "NaN", input: NaN, expected: 1 },
  { label: "number 0", input: 0, expected: 1 },
  { label: "number -1", input: -1, expected: 1 },
  { label: 'string "0"', input: "0", expected: 1 },
  { label: 'string "-2"', input: "-2", expected: 1 },
  { label: "boolean true", input: true, expected: 1 },
  { label: "boolean false", input: false, expected: 1 },
];

for (const { label, input, expected } of dayCases) {
  testNum++;
  const raw = stubRun({ day: input });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  assert(
    typeof migrated!.day === "number",
    `test ${testNum} (${label}): day must be a number, got ${typeof migrated!.day}`,
  );
  assert(
    migrated!.day === expected,
    `test ${testNum} (${label}): expected day === ${expected}, got ${migrated!.day}`,
  );
  console.log(`PASS  test ${testNum}: day ${label} → ${expected}`);
}

console.log("\n── deckCursor: numeric coercion (min 0) ──");

const deckCursorCases: Array<{
  label: string;
  input: unknown;
  expected: number;
}> = [
  { label: "number 0", input: 0, expected: 0 },
  { label: "number 3", input: 3, expected: 3 },
  { label: "number 5.8", input: 5.8, expected: 5 },
  { label: "number 2.1", input: 2.1, expected: 2 },
  { label: 'string "4.7"', input: "4.7", expected: 4 },
  { label: 'string "3"', input: "3", expected: 3 },
  { label: 'string "0"', input: "0", expected: 0 },
  { label: "undefined", input: undefined, expected: 0 },
  { label: "null", input: null, expected: 0 },
  { label: "boolean true", input: true, expected: 1 },
  { label: "boolean false", input: false, expected: 0 },
  { label: 'non-numeric string "abc"', input: "abc", expected: 0 },
  { label: "empty string", input: "", expected: 0 },
  { label: "object {}", input: {}, expected: 0 },
  { label: "NaN", input: NaN, expected: 0 },
  { label: "negative number -1", input: -1, expected: 0 },
  { label: "negative number -100", input: -100, expected: 0 },
  { label: 'negative string "-3"', input: "-3", expected: 0 },
];

for (const { label, input, expected } of deckCursorCases) {
  testNum++;
  const raw = stubRun({ deckCursor: input });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  assert(
    typeof migrated!.deckCursor === "number",
    `test ${testNum} (${label}): deckCursor must be a number, got ${typeof migrated!.deckCursor}`,
  );
  assert(
    migrated!.deckCursor === expected,
    `test ${testNum} (${label}): expected deckCursor === ${expected}, got ${migrated!.deckCursor}`,
  );
  console.log(`PASS  test ${testNum}: deckCursor ${label} → ${expected}`);
}

console.log("\n── migrateFact day: fractional inputs floored ──");

const factDayCases: Array<{
  label: string;
  factOverrides: Record<string, unknown>;
  runDay: number;
  expected: number;
}> = [
  {
    label: "f.day fractional 2.7",
    factOverrides: { day: 2.7 },
    runDay: 1,
    expected: 2,
  },
  {
    label: "f.day fractional 4.9",
    factOverrides: { day: 4.9 },
    runDay: 1,
    expected: 4,
  },
  {
    label: "f.day integer 3",
    factOverrides: { day: 3 },
    runDay: 1,
    expected: 3,
  },
  {
    label: "capturedOnDay fractional 1.5 (f.day missing)",
    factOverrides: { day: undefined, capturedOnDay: 1.5 },
    runDay: 1,
    expected: 1,
  },
  {
    label: "capturedOnDay fractional 3.9 (f.day missing)",
    factOverrides: { day: undefined, capturedOnDay: 3.9 },
    runDay: 1,
    expected: 3,
  },
  {
    label: "falls back to run.day fractional 5.5",
    factOverrides: { day: undefined, capturedOnDay: undefined },
    runDay: 5.5,
    expected: 5,
  },
  {
    label: "falls back to run.day integer 4",
    factOverrides: { day: undefined, capturedOnDay: undefined },
    runDay: 4,
    expected: 4,
  },
];

for (const { label, factOverrides, runDay, expected } of factDayCases) {
  testNum++;
  const baseFact = {
    id: "fact_test",
    kind: "captured" as const,
    source: { kind: "chatMessage" as const, messageId: "msg_test" },
    day: 1,
    payload: { text: "test" },
    payloadJson: '{"text":"test"}',
    ...factOverrides,
  };
  const raw = stubRun({ day: runDay, facts: [baseFact] });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  const fact = migrated!.facts[0];
  assert(
    typeof fact.day === "number",
    `test ${testNum} (${label}): fact.day must be a number, got ${typeof fact.day}`,
  );
  assert(
    fact.day === expected,
    `test ${testNum} (${label}): expected fact.day === ${expected}, got ${fact.day}`,
  );
  console.log(`PASS  test ${testNum}: fact.day ${label} → ${expected}`);
}

console.log(`\nAll ${testNum} migrateRun run-level numeric coercion tests passed.`);
process.exit(0);
