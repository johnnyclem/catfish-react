/**
 * Programmatic verification that `migrateRun` coerces `endingDismissed`
 * to a strict boolean so a corrupted or legacy save can never wedge the
 * End-of-Run overlay.
 *
 * Stubs AsyncStorage with the same in-memory map as the other test
 * harnesses so the store module can load under plain Node.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:migrate-dismissed
 *
 * Asserts:
 *   1. `undefined` (legacy save) → `false`
 *   2. `null` → `false`
 *   3. `0` → `false`
 *   4. `""` (empty string) → `false`
 *   5. `"yes"` (truthy non-boolean string) → `true`
 *   6. `1` (truthy non-boolean number) → `true`
 *   7. `true` → `true` (no-op identity)
 *   8. `false` → `false` (no-op identity)
 *   9. After migration with a malformed truthy value, the End-of-Run
 *      overlay logic (`closed && ending && !endingDismissed`) behaves
 *      correctly — the card re-mounts because the coerced `true` keeps
 *      the overlay hidden until `reopenEnding` flips it back.
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

function stubRun(endingDismissed: unknown) {
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
    closed: true,
    ending: {
      correct: true,
      matchedDeduction: null,
      ending: "caughtThem" as const,
      narrativeBeat: "You nailed it.",
    },
    endingDismissed,
  };
}

const cases: Array<{ label: string; input: unknown; expected: boolean }> = [
  { label: "undefined (legacy save)", input: undefined, expected: false },
  { label: "null", input: null, expected: false },
  { label: "0", input: 0, expected: false },
  { label: "empty string", input: "", expected: false },
  { label: "truthy string \"yes\"", input: "yes", expected: true },
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
    migrated!.endingDismissed === expected,
    `test ${testNum} (${label}): expected endingDismissed === ${expected}, got ${migrated!.endingDismissed}`,
  );
  assert(
    typeof migrated!.endingDismissed === "boolean",
    `test ${testNum} (${label}): endingDismissed must be a boolean, got ${typeof migrated!.endingDismissed}`,
  );
  console.log(`PASS  test ${testNum}: ${label} → ${expected}`);
}

testNum++;
{
  const raw = stubRun("yes");
  const migrated = migrateRun(raw as any)!;
  assert(migrated.endingDismissed === true, "coerced truthy string to true");
  assert(migrated.closed === true, "run is still closed");
  assert(migrated.ending !== null && migrated.ending !== undefined, "ending payload preserved");

  const overlayVisible = migrated.closed && migrated.ending && !migrated.endingDismissed;
  assert(
    !overlayVisible,
    `test ${testNum}: overlay stays hidden when endingDismissed coerces to true`,
  );
  console.log(`PASS  test ${testNum}: overlay logic correct for coerced truthy → dismissed`);
}

testNum++;
{
  const raw = stubRun(0);
  const migrated = migrateRun(raw as any)!;
  assert(migrated.endingDismissed === false, "coerced falsy 0 to false");

  const overlayVisible = migrated.closed && migrated.ending && !migrated.endingDismissed;
  assert(
    overlayVisible,
    `test ${testNum}: overlay re-mounts when endingDismissed coerces to false`,
  );
  console.log(`PASS  test ${testNum}: overlay re-mounts cleanly for coerced falsy → not dismissed`);
}

console.log(`\nAll ${testNum} migrateRun endingDismissed tests passed.`);
process.exit(0);
