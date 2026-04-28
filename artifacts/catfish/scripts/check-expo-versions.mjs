#!/usr/bin/env node
/**
 * Block dev/build/publish when Expo reports a package-version mismatch.
 *
 * Expo's runtime is sensitive to a fairly narrow band of versions for each of
 * its native packages — when the lockfile drifts (e.g. a package gets pinned
 * outside the band the SDK expects), the dev server only prints a yellow
 * "expected version: ~x.y.z" warning and keeps going. That warning is easy to
 * miss, and shipping past it means the app crashes on real devices.
 *
 * Running `expo install --check` exits non-zero whenever any installed
 * package falls outside the expected range for the current SDK, so we use it
 * as a guardrail before launching the dev server and before building for
 * deployment.
 *
 * Exposed as both:
 *   - a CLI: `node scripts/check-expo-versions.mjs`
 *   - a function: `await checkExpoVersions({ projectRoot })`
 *
 * The check normally finishes in 5–10s, which is cheap enough to run on every
 * workflow restart.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DEFAULT_PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/**
 * Run `expo install --check` in the given project. Resolves with `{ ok, output }`
 * — never throws on a version mismatch, so callers can decide how to surface it.
 * Throws only on unexpected spawn errors.
 */
export function checkExpoVersions({ projectRoot = DEFAULT_PROJECT_ROOT } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "expo", "install", "--check"], {
      cwd: projectRoot,
      // `ignore` on stdin keeps Expo from dropping into an interactive
      // "fix this for you?" prompt when versions are off.
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1" },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("error", (err) => {
      reject(err);
    });
    child.on("exit", (code) => {
      resolve({
        ok: code === 0,
        output: (stdout + stderr).trim(),
      });
    });
  });
}

/**
 * Pull the offending package list out of `expo install --check` output so we
 * can name them in the failure message. Expo prints lines like:
 *   expo-audio@1.0.13 - expected version: ~1.1.1
 */
export function parseMismatchedPackages(output) {
  const matches = [];
  const re = /(\S+)@(\S+)\s+-\s+expected version:\s+(\S+)/g;
  let m;
  while ((m = re.exec(output)) !== null) {
    matches.push({ name: m[1], installed: m[2], expected: m[3] });
  }
  return matches;
}

/**
 * Run the check and exit the current process with a clear message when it
 * fails. Returns normally when versions are healthy.
 */
export async function enforceExpoVersions({
  projectRoot = DEFAULT_PROJECT_ROOT,
  context = "startup",
} = {}) {
  // Opt-in escape hatch for CI/test environments where the dev server is
  // launched purely to host the web build for an e2e suite. The check is
  // still important for human dev/build/publish flows — the env var must be
  // set explicitly per-invocation, and the bypass is announced loudly so
  // it can't silently hide drift in regular dev.
  if (process.env.SKIP_EXPO_VERSION_CHECK === "1") {
    console.warn(
      `[expo-version-check] SKIP_EXPO_VERSION_CHECK=1 set — bypassing version check for ${context}.`,
    );
    return;
  }

  let result;
  try {
    result = await checkExpoVersions({ projectRoot });
  } catch (err) {
    console.error(
      `[expo-version-check] Could not run \`expo install --check\`: ${err.message}`,
    );
    console.error(
      "[expo-version-check] Skipping the guardrail. Fix the spawn error and retry.",
    );
    process.exit(1);
  }

  if (result.ok) {
    console.log("[expo-version-check] All Expo packages match the SDK. ✓");
    return;
  }

  const offenders = parseMismatchedPackages(result.output);
  console.error("");
  console.error(
    `[expo-version-check] Blocked ${context}: Expo reports package-version mismatches.`,
  );
  if (offenders.length > 0) {
    console.error("[expo-version-check] Offending packages:");
    for (const o of offenders) {
      console.error(
        `  - ${o.name}: installed ${o.installed}, expected ${o.expected}`,
      );
    }
  }
  console.error("");
  console.error("[expo-version-check] Full Expo output:");
  console.error(result.output);
  console.error("");
  console.error(
    "[expo-version-check] Fix by running `pnpm --filter @workspace/catfish exec expo install --fix` and committing the package.json changes.",
  );
  process.exit(1);
}

const isDirectInvocation =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  enforceExpoVersions({ context: "check" });
}
