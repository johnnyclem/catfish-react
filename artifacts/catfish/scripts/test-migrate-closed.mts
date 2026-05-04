/**
 * Programmatic verification that `migrateRun` coerces `closed`
 * to a strict boolean so a corrupted or legacy save can never
 * break downstream `=== true` conditional checks.
 *
 * Stubs AsyncStorage with the same in-memory map as the other test
 * harnesses so the store module can load under plain Node.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:migrate-closed
 *
 * Asserts:
 *   1. `undefined` → `false`
 *   2. `null` → `false`
 *   3. `0` → `false`
 *   4. `""` (empty string) → `false`
 *   5. `"true"` (truthy non-boolean string) → `true`
 *   6. `1` (truthy non-boolean number) → `true`
 *   7. `true` → `true` (no-op identity)
 *   8. `false` → `false` (no-op identity)
 *   9. After migration with `closed` coerced to `true`, the overlay
 *      visibility gate (`closed && ending && !endingDismissed`) still
 *      behaves correctly.
 *  10. After migration with `closed` coerced to `false`, the overlay
 *      stays hidden because the run isn't closed.
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

function stubRun(closed: unknown) {
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
    closed,
    ending: {
      correct: true,
      matchedDeduction: null,
      ending: "caughtThem" as const,
      narrativeBeat: "You nailed it.",
    },
    endingDismissed: false,
  };
}

const cases: Array<{ label: string; input: unknown; expected: boolean }> = [
  { label: "undefined", input: undefined, expected: false },
  { label: "null", input: null, expected: false },
  { label: "0", input: 0, expected: false },
  { label: "empty string", input: "", expected: false },
  { label: "truthy string \"true\"", input: "true", expected: true },
  { label: "truthy number 1", input: 1, expected: true },
  { label: "boolean true", input: true, expected: true },
  { label: "boolean false", input: false, expected: false },
];

let testNum = 0;
for (const { label, input, expected } of cases) {
  testNum++;
  const raw = stubRun(input);
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  assert(
    migrated!.closed === expected,
    `test ${testNum} (${label}): expected closed === ${expected}, got ${migrated!.closed}`,
  );
  assert(
    typeof migrated!.closed === "boolean",
    `test ${testNum} (${label}): closed must be a boolean, got ${typeof migrated!.closed}`,
  );
  console.log(`PASS  test ${testNum}: ${label} → ${expected}`);
}

testNum++;
{
  const raw = stubRun("true");
  const migrated = migrateRun(raw as any)!;
  assert(migrated.closed === true, "coerced truthy string to true");
  assert(migrated.ending !== null && migrated.ending !== undefined, "ending payload preserved");
  assert(migrated.endingDismissed === false, "endingDismissed stays false");

  const overlayVisible = migrated.closed && migrated.ending && !migrated.endingDismissed;
  assert(
    overlayVisible,
    `test ${testNum}: overlay shows when closed coerces to true and endingDismissed is false`,
  );
  console.log(`PASS  test ${testNum}: overlay visible for coerced truthy closed + not dismissed`);
}

testNum++;
{
  const raw = stubRun(0);
  const migrated = migrateRun(raw as any)!;
  assert(migrated.closed === false, "coerced falsy 0 to false");

  const overlayVisible = migrated.closed && migrated.ending && !migrated.endingDismissed;
  assert(
    !overlayVisible,
    `test ${testNum}: overlay hidden when closed coerces to false`,
  );
  console.log(`PASS  test ${testNum}: overlay hidden for coerced falsy closed`);
}

console.log(`\nAll ${testNum} migrateRun closed coercion tests passed.`);
process.exit(0);
