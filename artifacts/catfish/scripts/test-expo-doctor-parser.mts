/**
 * Programmatic verification of `parseFailedChecks` from
 * `scripts/check-expo-doctor.mjs`.
 *
 * The pre-flight gate (`enforceExpoDoctor`) parses raw `expo-doctor`
 * output to name which check failed in its blocked-startup message.
 * If a future `expo-doctor` release tweaks its output format (new
 * marker glyph, different indentation, extra summary lines, etc.),
 * the parser will silently fall back to "could not parse failed-check
 * names" and contributors will lose the most useful part of the
 * failure summary until somebody notices in CI.
 *
 * Run via:
 *   pnpm --filter @workspace/catfish test:expo-doctor-parser
 *
 * Asserts (in order):
 *   1. A real doctor failure transcript (the missing `expo-asset`
 *      peer-dep one captured during task #37, including ANSI colour
 *      codes) yields exactly one failed check with the correct name
 *      and a non-empty advice block.
 *   2. A clean transcript ("17/17 checks passed") yields zero failed
 *      checks.
 *   3. A multi-failure transcript yields each failed check separately,
 *      with each detail block stopping at the next ✓ / ✖ marker or
 *      the closing summary line.
 */

import { parseFailedChecks } from "./check-expo-doctor.mjs";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    process.exit(1);
  }
}

// --- Test 1: real doctor failure transcript (with ANSI colour codes,
// mirroring what `expo-doctor` actually streams to stdout). Captured
// from the missing `expo-asset` peer-dep run during task #37.
const realFailure = [
  "Running 17 checks on your project...",
  "\x1b[32m\u2713\x1b[39m Check package.json for common issues",
  "\x1b[32m\u2713\x1b[39m Check Expo config for common issues",
  "\x1b[32m\u2713\x1b[39m Check dependencies for packages that should not be installed directly",
  "\x1b[31m\u2716\x1b[39m Check that packages match versions required by installed Expo SDK",
  "  This project contains the following issues:",
  "    - expo-asset is required as a peer dependency by expo-audio",
  "      but is not installed in this workspace.",
  "    Advice:",
  "    - Run `pnpm add expo-asset` from this package.",
  "1 check failed, see above for issues and advice to resolve them.",
].join("\n");

const t1 = parseFailedChecks(realFailure);
assert(
  t1.length === 1,
  `real failure transcript should yield exactly 1 failed check, got ${t1.length}`,
);
assert(
  t1[0]!.name ===
    "Check that packages match versions required by installed Expo SDK",
  `failed check name should match the doctor section header, got: ${JSON.stringify(t1[0]!.name)}`,
);
assert(
  t1[0]!.detail.length > 0,
  "failed check should carry a non-empty advice block",
);
assert(
  t1[0]!.detail.includes("expo-asset"),
  "advice block should mention the offending package (expo-asset)",
);
assert(
  t1[0]!.detail.includes("Advice:"),
  "advice block should include the doctor 'Advice:' section",
);
assert(
  !t1[0]!.detail.includes("see above for issues"),
  "advice block must stop at the closing summary line",
);
console.log("PASS  test 1: real failure transcript parsed cleanly");

// --- Test 2: clean transcript — no failures, just the all-green
// summary. Parser should yield an empty list.
const cleanRun = [
  "Running 17 checks on your project...",
  "\x1b[32m\u2713\x1b[39m Check package.json for common issues",
  "\x1b[32m\u2713\x1b[39m Check Expo config for common issues",
  "\x1b[32m\u2713\x1b[39m Check dependencies for packages that should not be installed directly",
  "\x1b[32m\u2713\x1b[39m Check for legacy global CLI installed locally",
  "\x1b[32m\u2713\x1b[39m Check that packages match versions required by installed Expo SDK",
  "17/17 checks passed. No issues detected!",
].join("\n");

const t2 = parseFailedChecks(cleanRun);
assert(
  t2.length === 0,
  `clean transcript should yield 0 failed checks, got ${t2.length}`,
);
console.log("PASS  test 2: clean transcript yields no failed checks");

// --- Test 3: multi-failure transcript — three failed checks
// interleaved with passing ones. Each failure's advice block must
// stop at the next ✓ / ✖ marker (or the closing summary line).
const multiFailure = [
  "Running 17 checks on your project...",
  "\u2713 Check package.json for common issues",
  "\u2716 Check that packages match versions required by installed Expo SDK",
  "  This project contains the following issues:",
  "    - expo-asset is required as a peer dependency by expo-audio.",
  "\u2713 Check for legacy global CLI installed locally",
  "\u2716 Check Expo config (app.json/ app.config.js) schema",
  "  Found invalid:",
  "    - ios.bundleIdentifier must match /^[A-Za-z0-9.-]+$/",
  "\u2713 Check native tooling versions",
  "\u2716 Check for app config fields that may not be synced in a non-CNG project",
  "  This project may have native code that doesn't reflect app config changes.",
  "  Advice:",
  "    - Run `npx expo prebuild --clean` to regenerate native projects.",
  "3 checks failed, see above for issues and advice to resolve them.",
].join("\n");

const t3 = parseFailedChecks(multiFailure);
assert(
  t3.length === 3,
  `multi-failure transcript should yield 3 failed checks, got ${t3.length}`,
);
assert(
  t3[0]!.name ===
    "Check that packages match versions required by installed Expo SDK",
  `first failure name mismatch: ${JSON.stringify(t3[0]!.name)}`,
);
assert(
  t3[1]!.name === "Check Expo config (app.json/ app.config.js) schema",
  `second failure name mismatch: ${JSON.stringify(t3[1]!.name)}`,
);
assert(
  t3[2]!.name ===
    "Check for app config fields that may not be synced in a non-CNG project",
  `third failure name mismatch: ${JSON.stringify(t3[2]!.name)}`,
);
// Each detail block must be scoped to its own section — the first
// failure's detail must NOT contain text from the second failure, and
// so on. This is the regression that breaks if the parser ever stops
// honouring the next-marker boundary.
assert(
  t3[0]!.detail.includes("expo-asset"),
  "first failure detail should describe the expo-asset peer-dep issue",
);
assert(
  !t3[0]!.detail.includes("bundleIdentifier"),
  "first failure detail must not bleed into the second failure's advice",
);
assert(
  !t3[0]!.detail.includes("Check for legacy global CLI"),
  "first failure detail must stop at the next ✓ marker",
);
assert(
  t3[1]!.detail.includes("bundleIdentifier"),
  "second failure detail should describe the bundleIdentifier issue",
);
assert(
  !t3[1]!.detail.includes("prebuild"),
  "second failure detail must not bleed into the third failure's advice",
);
assert(
  t3[2]!.detail.includes("prebuild"),
  "third failure detail should describe the prebuild advice",
);
assert(
  !t3[2]!.detail.includes("see above for issues"),
  "third failure detail must stop at the closing summary line",
);
console.log("PASS  test 3: multi-failure transcript parsed cleanly");

console.log("\nAll expo-doctor parser tests passed.");
process.exit(0);
