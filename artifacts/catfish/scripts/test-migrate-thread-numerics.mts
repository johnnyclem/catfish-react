/**
 * Programmatic verification that `migrateRun` coerces thread-level
 * numeric fields (`turnIndex`, `unreadCount`) correctly so a
 * corrupted or legacy save can never break downstream logic.
 *
 * Stubs AsyncStorage with the same in-memory map as the other test
 * harnesses so the store module can load under plain Node.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:migrate-thread-numerics
 *
 * Asserts:
 *   turnIndex   — numeric values preserved, string-numbers parsed,
 *                 non-numeric values fall back to 0.
 *   unreadCount — same as turnIndex, plus negative values fall back to 0.
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

function stubRun(threadOverrides: Record<string, unknown>) {
  return {
    id: "run_test",
    killer: "miles" as const,
    startedAt: new Date().toISOString(),
    day: 3,
    deck: [],
    deckCursor: 0,
    swipes: [],
    matches: [],
    threads: [
      {
        odCharacterId: "suspect_a",
        messages: [],
        turnIndex: 0,
        unreadCount: 0,
        ...threadOverrides,
      },
    ],
    facts: [],
    pendingLikes: [],
    pendingMatchAnnouncements: [],
    closed: false,
    endingDismissed: false,
  };
}

let testNum = 0;

console.log("── turnIndex: numeric coercion ──");

const turnIndexCases: Array<{
  label: string;
  input: unknown;
  expected: number;
}> = [
  { label: "number 0", input: 0, expected: 0 },
  { label: "number 3", input: 3, expected: 3 },
  { label: "number 7.5", input: 7.5, expected: 7.5 },
  { label: 'string "3"', input: "3", expected: 3 },
  { label: 'string "0"', input: "0", expected: 0 },
  { label: 'string "10"', input: "10", expected: 10 },
  { label: "undefined", input: undefined, expected: 0 },
  { label: "null", input: null, expected: 0 },
  { label: "boolean true", input: true, expected: 1 },
  { label: "boolean false", input: false, expected: 0 },
  { label: 'non-numeric string "abc"', input: "abc", expected: 0 },
  { label: "empty string", input: "", expected: 0 },
  { label: "object {}", input: {}, expected: 0 },
  { label: "NaN", input: NaN, expected: 0 },
];

for (const { label, input, expected } of turnIndexCases) {
  testNum++;
  const raw = stubRun({ turnIndex: input });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  const thread = migrated!.threads[0];
  assert(
    typeof thread.turnIndex === "number",
    `test ${testNum} (${label}): turnIndex must be a number, got ${typeof thread.turnIndex}`,
  );
  assert(
    thread.turnIndex === expected,
    `test ${testNum} (${label}): expected turnIndex === ${expected}, got ${thread.turnIndex}`,
  );
  console.log(`PASS  test ${testNum}: turnIndex ${label} → ${expected}`);
}

console.log("\n── unreadCount: numeric coercion (negative → 0) ──");

const unreadCountCases: Array<{
  label: string;
  input: unknown;
  expected: number;
}> = [
  { label: "number 0", input: 0, expected: 0 },
  { label: "number 5", input: 5, expected: 5 },
  { label: 'string "5"', input: "5", expected: 5 },
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

for (const { label, input, expected } of unreadCountCases) {
  testNum++;
  const raw = stubRun({ unreadCount: input });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  const thread = migrated!.threads[0];
  assert(
    typeof thread.unreadCount === "number",
    `test ${testNum} (${label}): unreadCount must be a number, got ${typeof thread.unreadCount}`,
  );
  assert(
    thread.unreadCount === expected,
    `test ${testNum} (${label}): expected unreadCount === ${expected}, got ${thread.unreadCount}`,
  );
  console.log(`PASS  test ${testNum}: unreadCount ${label} → ${expected}`);
}

console.log(`\nAll ${testNum} migrateRun thread-numeric coercion tests passed.`);
process.exit(0);
