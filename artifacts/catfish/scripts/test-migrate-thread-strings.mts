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

function stubRunTopLevel(overrides: Record<string, unknown>) {
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

console.log("\n── improvReplyOptions: element coercion ──");

const arrayCases: Array<{
  label: string;
  input: unknown;
  expected: string[] | undefined;
}> = [
  {
    label: "all strings",
    input: ["a", "b", "c"],
    expected: ["a", "b", "c"],
  },
  {
    label: "mixed types coerced",
    input: ["a", 42, true],
    expected: ["a", "42", "true"],
  },
  {
    label: "null/undefined elements filtered",
    input: ["a", null, undefined, "b"],
    expected: ["a", "b"],
  },
  {
    label: "number-only array",
    input: [1, 2, 3],
    expected: ["1", "2", "3"],
  },
  {
    label: "boolean false element kept",
    input: [false],
    expected: ["false"],
  },
  {
    label: "number 0 element kept",
    input: [0],
    expected: ["0"],
  },
  {
    label: "empty array stays empty",
    input: [],
    expected: [],
  },
  {
    label: "not an array → undefined",
    input: "not-an-array",
    expected: undefined,
  },
  {
    label: "undefined → undefined",
    input: undefined,
    expected: undefined,
  },
];

for (const { label, input, expected } of arrayCases) {
  testNum++;
  const raw = stubRun({ improvReplyOptions: input });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  const thread = migrated!.threads[0];
  const actual = thread.improvReplyOptions;
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `test ${testNum} (${label}): expected improvReplyOptions === ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
  if (expected !== undefined) {
    assert(
      Array.isArray(actual),
      `test ${testNum} (${label}): improvReplyOptions must be an array`,
    );
    for (let i = 0; i < actual!.length; i++) {
      assert(
        typeof actual![i] === "string",
        `test ${testNum} (${label}): improvReplyOptions[${i}] must be a string, got ${typeof actual![i]}`,
      );
    }
  }
  console.log(`PASS  test ${testNum}: improvReplyOptions ${label} → ${JSON.stringify(expected)}`);
}

console.log("\n── pendingMatchAnnouncements: element coercion ──");

const matchAnnouncementCases: Array<{
  label: string;
  input: unknown;
  expected: string[];
}> = [
  {
    label: "all strings",
    input: ["match_abc", "match_def"],
    expected: ["match_abc", "match_def"],
  },
  {
    label: "mixed types coerced",
    input: ["match_abc", 42, true],
    expected: ["match_abc", "42", "true"],
  },
  {
    label: "null/undefined elements filtered",
    input: ["match_abc", null, undefined, "match_def"],
    expected: ["match_abc", "match_def"],
  },
  {
    label: "number-only array",
    input: [1, 2, 3],
    expected: ["1", "2", "3"],
  },
  {
    label: "boolean false element kept",
    input: [false],
    expected: ["false"],
  },
  {
    label: "number 0 element kept",
    input: [0],
    expected: ["0"],
  },
  {
    label: "empty array stays empty",
    input: [],
    expected: [],
  },
  {
    label: "not an array → empty",
    input: "not-an-array",
    expected: [],
  },
  {
    label: "undefined → empty",
    input: undefined,
    expected: [],
  },
];

for (const { label, input, expected } of matchAnnouncementCases) {
  testNum++;
  const raw = stubRunTopLevel({ pendingMatchAnnouncements: input });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  const actual = migrated!.pendingMatchAnnouncements ?? [];
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `test ${testNum} (${label}): expected pendingMatchAnnouncements === ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
  for (let i = 0; i < actual.length; i++) {
    assert(
      typeof actual[i] === "string",
      `test ${testNum} (${label}): pendingMatchAnnouncements[${i}] must be a string, got ${typeof actual[i]}`,
    );
  }
  console.log(`PASS  test ${testNum}: pendingMatchAnnouncements ${label} → ${JSON.stringify(expected)}`);
}

console.log("\n── usedInnocentScriptIds: element coercion ──");

const usedIdsCases: Array<{
  label: string;
  input: unknown;
  expected: string[];
}> = [
  {
    label: "all strings",
    input: ["tree_a", "tree_b"],
    expected: ["tree_a", "tree_b"],
  },
  {
    label: "mixed types coerced",
    input: ["tree_a", 42, true],
    expected: ["tree_a", "42", "true"],
  },
  {
    label: "null/undefined elements filtered",
    input: ["tree_a", null, undefined, "tree_b"],
    expected: ["tree_a", "tree_b"],
  },
  {
    label: "number-only array",
    input: [1, 2, 3],
    expected: ["1", "2", "3"],
  },
  {
    label: "boolean false element kept",
    input: [false],
    expected: ["false"],
  },
  {
    label: "number 0 element kept",
    input: [0],
    expected: ["0"],
  },
  {
    label: "empty array stays empty",
    input: [],
    expected: [],
  },
  {
    label: "not an array → empty",
    input: "not-an-array",
    expected: [],
  },
  {
    label: "undefined → empty",
    input: undefined,
    expected: [],
  },
];

for (const { label, input, expected } of usedIdsCases) {
  testNum++;
  const raw = stubRunTopLevel({ usedInnocentScriptIds: input });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  const actual = migrated!.usedInnocentScriptIds ?? [];
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `test ${testNum} (${label}): expected usedInnocentScriptIds === ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
  for (let i = 0; i < actual.length; i++) {
    assert(
      typeof actual[i] === "string",
      `test ${testNum} (${label}): usedInnocentScriptIds[${i}] must be a string, got ${typeof actual[i]}`,
    );
  }
  console.log(`PASS  test ${testNum}: usedInnocentScriptIds ${label} → ${JSON.stringify(expected)}`);
}

console.log("\n── messages: id/text coercion ──");

const messageCases: Array<{
  label: string;
  messages: unknown[];
  expectedCount: number;
  expectedId?: string;
  expectedText?: string;
}> = [
  {
    label: "valid string fields preserved",
    messages: [{ id: "msg_1", sender: "suspect", text: "hello", sentAt: "2025-01-01" }],
    expectedCount: 1,
    expectedId: "msg_1",
    expectedText: "hello",
  },
  {
    label: "numeric id coerced to string",
    messages: [{ id: 42, sender: "suspect", text: "hello", sentAt: "2025-01-01" }],
    expectedCount: 1,
    expectedId: "42",
    expectedText: "hello",
  },
  {
    label: "numeric text coerced to string",
    messages: [{ id: "msg_1", sender: "player", text: 99, sentAt: "2025-01-01" }],
    expectedCount: 1,
    expectedId: "msg_1",
    expectedText: "99",
  },
  {
    label: "boolean id coerced to string",
    messages: [{ id: true, sender: "suspect", text: "hi", sentAt: "2025-01-01" }],
    expectedCount: 1,
    expectedId: "true",
    expectedText: "hi",
  },
  {
    label: "null id drops message",
    messages: [{ id: null, sender: "suspect", text: "hi", sentAt: "2025-01-01" }],
    expectedCount: 0,
  },
  {
    label: "undefined text drops message",
    messages: [{ id: "msg_1", sender: "suspect", text: undefined, sentAt: "2025-01-01" }],
    expectedCount: 0,
  },
  {
    label: "invalid sender drops message",
    messages: [{ id: "msg_1", sender: "admin", text: "hello", sentAt: "2025-01-01" }],
    expectedCount: 0,
  },
];

for (const { label, messages, expectedCount, expectedId, expectedText } of messageCases) {
  testNum++;
  const raw = stubRun({ messages });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  const thread = migrated!.threads[0];
  assert(
    thread.messages.length === expectedCount,
    `test ${testNum} (${label}): expected ${expectedCount} messages, got ${thread.messages.length}`,
  );
  if (expectedCount > 0 && expectedId !== undefined) {
    assert(
      thread.messages[0].id === expectedId,
      `test ${testNum} (${label}): expected id === ${JSON.stringify(expectedId)}, got ${JSON.stringify(thread.messages[0].id)}`,
    );
    assert(
      typeof thread.messages[0].id === "string",
      `test ${testNum} (${label}): id must be a string`,
    );
  }
  if (expectedCount > 0 && expectedText !== undefined) {
    assert(
      thread.messages[0].text === expectedText,
      `test ${testNum} (${label}): expected text === ${JSON.stringify(expectedText)}, got ${JSON.stringify(thread.messages[0].text)}`,
    );
    assert(
      typeof thread.messages[0].text === "string",
      `test ${testNum} (${label}): text must be a string`,
    );
  }
  console.log(`PASS  test ${testNum}: messages ${label}`);
}

console.log("\n── pendingSuspectQueue: id/text coercion ──");

const queueCases: Array<{
  label: string;
  queue: unknown[];
  expectedCount: number;
  expectedId?: string;
  expectedText?: string;
  expectedBeatKey?: string | undefined;
  checkBeatKey?: boolean;
}> = [
  {
    label: "valid string fields preserved",
    queue: [{ id: "psl_1", text: "typing..." }],
    expectedCount: 1,
    expectedId: "psl_1",
    expectedText: "typing...",
  },
  {
    label: "numeric id coerced to string",
    queue: [{ id: 7, text: "typing..." }],
    expectedCount: 1,
    expectedId: "7",
    expectedText: "typing...",
  },
  {
    label: "numeric text coerced to string",
    queue: [{ id: "psl_1", text: 100 }],
    expectedCount: 1,
    expectedId: "psl_1",
    expectedText: "100",
  },
  {
    label: "numeric beatKey coerced to string",
    queue: [{ id: "psl_1", text: "hi", beatKey: 99 }],
    expectedCount: 1,
    expectedBeatKey: "99",
    checkBeatKey: true,
  },
  {
    label: "string beatKey preserved",
    queue: [{ id: "psl_1", text: "hi", beatKey: "beat_intro" }],
    expectedCount: 1,
    expectedBeatKey: "beat_intro",
    checkBeatKey: true,
  },
  {
    label: "null beatKey becomes undefined",
    queue: [{ id: "psl_1", text: "hi", beatKey: null }],
    expectedCount: 1,
    expectedBeatKey: undefined,
    checkBeatKey: true,
  },
  {
    label: "null id drops line",
    queue: [{ id: null, text: "typing..." }],
    expectedCount: 0,
  },
  {
    label: "undefined text drops line",
    queue: [{ id: "psl_1", text: undefined }],
    expectedCount: 0,
  },
];

for (const { label, queue, expectedCount, expectedId, expectedText, expectedBeatKey, checkBeatKey } of queueCases) {
  testNum++;
  const raw = stubRun({ pendingSuspectQueue: queue, messages: [] });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  const thread = migrated!.threads[0];
  assert(
    thread.messages.length === expectedCount,
    `test ${testNum} (${label}): expected ${expectedCount} flushed messages, got ${thread.messages.length}`,
  );
  if (expectedCount > 0 && expectedId !== undefined) {
    assert(
      thread.messages[0].id === expectedId,
      `test ${testNum} (${label}): expected id === ${JSON.stringify(expectedId)}, got ${JSON.stringify(thread.messages[0].id)}`,
    );
    assert(
      typeof thread.messages[0].id === "string",
      `test ${testNum} (${label}): id must be a string`,
    );
  }
  if (expectedCount > 0 && expectedText !== undefined) {
    assert(
      thread.messages[0].text === expectedText,
      `test ${testNum} (${label}): expected text === ${JSON.stringify(expectedText)}, got ${JSON.stringify(thread.messages[0].text)}`,
    );
    assert(
      typeof thread.messages[0].text === "string",
      `test ${testNum} (${label}): text must be a string`,
    );
  }
  if (expectedCount > 0 && checkBeatKey) {
    const actualBeatKey = thread.messages[0].beatKey;
    assert(
      actualBeatKey === expectedBeatKey,
      `test ${testNum} (${label}): expected beatKey === ${JSON.stringify(expectedBeatKey)}, got ${JSON.stringify(actualBeatKey)}`,
    );
    if (expectedBeatKey !== undefined) {
      assert(
        typeof actualBeatKey === "string",
        `test ${testNum} (${label}): beatKey must be a string, got ${typeof actualBeatKey}`,
      );
    }
  }
  console.log(`PASS  test ${testNum}: pendingSuspectQueue ${label}`);
}

console.log("\n── pendingLikes: candidateId/at/day coercion ──");

const likeCases: Array<{
  label: string;
  likes: unknown[];
  expectedCount: number;
  expectedCandidateId?: string;
  expectedAt?: string;
  expectedDay?: number;
}> = [
  {
    label: "valid fields preserved",
    likes: [{ candidateId: "c_1", day: 2, at: "2025-01-01T00:00:00Z", status: "pending" }],
    expectedCount: 1,
    expectedCandidateId: "c_1",
    expectedAt: "2025-01-01T00:00:00Z",
    expectedDay: 2,
  },
  {
    label: "numeric candidateId coerced to string",
    likes: [{ candidateId: 42, day: 1, at: "2025-01-01T00:00:00Z", status: "pending" }],
    expectedCount: 1,
    expectedCandidateId: "42",
  },
  {
    label: "numeric at coerced to string",
    likes: [{ candidateId: "c_1", day: 1, at: 1234567890, status: "matched" }],
    expectedCount: 1,
    expectedAt: "1234567890",
  },
  {
    label: "string day coerced to number",
    likes: [{ candidateId: "c_1", day: "3", at: "2025-01-01T00:00:00Z", status: "pending" }],
    expectedCount: 1,
    expectedDay: 3,
  },
  {
    label: "NaN day defaults to 0",
    likes: [{ candidateId: "c_1", day: "not-a-number", at: "2025-01-01T00:00:00Z", status: "pending" }],
    expectedCount: 1,
    expectedDay: 0,
  },
  {
    label: "null candidateId drops record",
    likes: [{ candidateId: null, day: 1, at: "2025-01-01T00:00:00Z", status: "pending" }],
    expectedCount: 0,
  },
  {
    label: "null at drops record",
    likes: [{ candidateId: "c_1", day: 1, at: null, status: "pending" }],
    expectedCount: 0,
  },
  {
    label: "invalid status drops record",
    likes: [{ candidateId: "c_1", day: 1, at: "2025-01-01T00:00:00Z", status: "invalid" }],
    expectedCount: 0,
  },
];

for (const { label, likes, expectedCount, expectedCandidateId, expectedAt, expectedDay } of likeCases) {
  testNum++;
  const raw = stubRunTopLevel({ pendingLikes: likes });
  const migrated = migrateRun(raw as any);
  assert(migrated !== null, `test ${testNum}: migrateRun should not return null`);
  const actual = migrated!.pendingLikes ?? [];
  assert(
    actual.length === expectedCount,
    `test ${testNum} (${label}): expected ${expectedCount} likes, got ${actual.length}`,
  );
  if (expectedCount > 0) {
    if (expectedCandidateId !== undefined) {
      assert(
        actual[0].candidateId === expectedCandidateId,
        `test ${testNum} (${label}): expected candidateId === ${JSON.stringify(expectedCandidateId)}, got ${JSON.stringify(actual[0].candidateId)}`,
      );
      assert(typeof actual[0].candidateId === "string", `test ${testNum} (${label}): candidateId must be a string`);
    }
    if (expectedAt !== undefined) {
      assert(
        actual[0].at === expectedAt,
        `test ${testNum} (${label}): expected at === ${JSON.stringify(expectedAt)}, got ${JSON.stringify(actual[0].at)}`,
      );
      assert(typeof actual[0].at === "string", `test ${testNum} (${label}): at must be a string`);
    }
    if (expectedDay !== undefined) {
      assert(
        actual[0].day === expectedDay,
        `test ${testNum} (${label}): expected day === ${expectedDay}, got ${actual[0].day}`,
      );
      assert(typeof actual[0].day === "number", `test ${testNum} (${label}): day must be a number`);
    }
  }
  console.log(`PASS  test ${testNum}: pendingLikes ${label}`);
}

console.log(`\nAll ${testNum} migrateRun string coercion tests passed.`);
process.exit(0);
