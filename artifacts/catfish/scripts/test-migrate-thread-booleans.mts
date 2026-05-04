/**
 * Programmatic verification that `migrateRun` coerces thread-level
 * boolean fields (`improvPending`, `improvError`) correctly so a
 * corrupted or legacy save can never break downstream logic.
 *
 * Stubs AsyncStorage with the same in-memory map as the other test
 * harnesses so the store module can load under plain Node.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:migrate-thread-booleans
 *
 * Asserts:
 *   improvPending — always hard-reset to `false` regardless of input.
 *   improvError   — truthy values coerced to `true`, falsy values to `undefined`.
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

console.log("── improvPending: always reset to false ──");

const pendingCases: Array<{ label: string; input: unknown }> = [
  { label: "true", input: true },
  { label: "false", input: false },
  { label: "undefined", input: undefined },
  { label: 'truthy string "yes"', input: "yes" },
  { label: "truthy number 1", input: 1 },
];

for (const { label, input } of pendingCases) {
  testNum++;
  const raw = stubRun({ improvPending: input });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  const thread = migrated!.threads[0];
  assert(
    thread.improvPending === false,
    `test ${testNum} (${label}): expected improvPending === false, got ${thread.improvPending}`,
  );
  console.log(`PASS  test ${testNum}: improvPending ${label} → false`);
}

console.log("\n── improvError: truthy → true, falsy → undefined ──");

const errorCases: Array<{
  label: string;
  input: unknown;
  expected: boolean | undefined;
}> = [
  { label: "boolean true", input: true, expected: true },
  { label: "boolean false", input: false, expected: undefined },
  { label: "undefined", input: undefined, expected: undefined },
  { label: "null", input: null, expected: undefined },
  { label: "0", input: 0, expected: undefined },
  { label: "empty string", input: "", expected: undefined },
  { label: 'truthy string "yes"', input: "yes", expected: true },
  { label: 'truthy string "true"', input: "true", expected: true },
  { label: "truthy number 1", input: 1, expected: true },
  { label: "truthy object {}", input: {}, expected: true },
];

for (const { label, input, expected } of errorCases) {
  testNum++;
  const raw = stubRun({ improvError: input });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  const thread = migrated!.threads[0];
  assert(
    thread.improvError === expected,
    `test ${testNum} (${label}): expected improvError === ${expected}, got ${thread.improvError}`,
  );
  if (expected !== undefined) {
    assert(
      typeof thread.improvError === "boolean",
      `test ${testNum} (${label}): improvError must be a boolean, got ${typeof thread.improvError}`,
    );
  }
  console.log(`PASS  test ${testNum}: improvError ${label} → ${expected}`);
}

console.log(`\nAll ${testNum} migrateRun thread-boolean coercion tests passed.`);
process.exit(0);
