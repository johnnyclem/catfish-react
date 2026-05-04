/**
 * Programmatic verification that `migrateRun` coerces `innocentScriptId`
 * (a string field) correctly so a corrupted or legacy save never silently
 * drops a truthy non-string value.
 *
 * Stubs AsyncStorage with the same in-memory map as the other test
 * harnesses so the store module can load under plain Node.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:migrate-thread-strings
 *
 * Asserts:
 *   innocentScriptId — non-null values coerced via String(),
 *                      null/undefined/empty-string become undefined.
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

console.log("── innocentScriptId: string coercion ──");

const cases: Array<{
  label: string;
  input: unknown;
  expected: string | undefined;
}> = [
  { label: 'valid string "tree_a"', input: "tree_a", expected: "tree_a" },
  { label: "empty string", input: "", expected: undefined },
  { label: "undefined", input: undefined, expected: undefined },
  { label: "null", input: null, expected: undefined },
  { label: "boolean true", input: true, expected: "true" },
  { label: "boolean false", input: false, expected: "false" },
  { label: "number 42", input: 42, expected: "42" },
  { label: "number 0", input: 0, expected: "0" },
];

for (const { label, input, expected } of cases) {
  testNum++;
  const raw = stubRun({ innocentScriptId: input });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  const thread = migrated!.threads[0];
  assert(
    thread.innocentScriptId === expected,
    `test ${testNum} (${label}): expected innocentScriptId === ${JSON.stringify(expected)}, got ${JSON.stringify(thread.innocentScriptId)}`,
  );
  if (expected !== undefined) {
    assert(
      typeof thread.innocentScriptId === "string",
      `test ${testNum} (${label}): innocentScriptId must be a string, got ${typeof thread.innocentScriptId}`,
    );
  }
  console.log(`PASS  test ${testNum}: innocentScriptId ${label} → ${JSON.stringify(expected)}`);
}

console.log(`\nAll ${testNum} migrateRun thread-string coercion tests passed.`);
process.exit(0);
