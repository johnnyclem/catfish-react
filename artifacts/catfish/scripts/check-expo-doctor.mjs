#!/usr/bin/env node
/**
 * Block dev/build when `expo-doctor` reports any failed checks.
 *
 * `expo install --check` (see check-expo-versions.mjs) only catches packages
 * pinned outside their SDK version range. Doctor runs a much broader set of
 * checks: missing native peer dependencies, autolinking metadata drift, app
 * config issues, plugin misconfigurations, etc. Many of those used to ship as
 * yellow warnings that were easy to miss until the app crashed on a real
 * device (cf. the audio crash, Apr 2026, where a missing peer dep would have
 * been caught here).
 *
 * Doctor is a slow check (~30s on this project), so we cache the last
 * successful run keyed on the inputs that can actually move its result —
 * `package.json`, `app.json`, `app.config.*`, and the workspace lockfile. If
 * none of those have changed since the last green run, we skip and return
 * immediately. Set `EXPO_DOCTOR_FORCE=1` to bypass the cache.
 *
 * Exposed as both:
 *   - a CLI: `node scripts/check-expo-doctor.mjs`
 *   - a function: `await enforceExpoDoctor({ projectRoot, context })`
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const CACHE_FILE_REL = path.join(
  "node_modules",
  ".cache",
  "expo-doctor",
  "last-pass.json",
);

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function findWorkspaceRoot(startDir) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function collectCacheInputs(projectRoot) {
  const workspaceRoot = findWorkspaceRoot(projectRoot);
  const candidates = [
    path.join(projectRoot, "package.json"),
    path.join(projectRoot, "app.json"),
    path.join(projectRoot, "app.config.js"),
    path.join(projectRoot, "app.config.cjs"),
    path.join(projectRoot, "app.config.mjs"),
    path.join(projectRoot, "app.config.ts"),
  ];
  if (workspaceRoot) {
    candidates.push(path.join(workspaceRoot, "pnpm-lock.yaml"));
  }
  return candidates.filter((p) => fs.existsSync(p));
}

function computeCacheKey(projectRoot) {
  const hash = createHash("sha256");
  for (const file of collectCacheInputs(projectRoot)) {
    hash.update(path.relative(projectRoot, file));
    hash.update("\0");
    hash.update(fs.readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function cachePath(projectRoot) {
  return path.join(projectRoot, CACHE_FILE_REL);
}

function readCache(projectRoot) {
  try {
    return JSON.parse(fs.readFileSync(cachePath(projectRoot), "utf-8"));
  } catch {
    return null;
  }
}

function writeCache(projectRoot, key) {
  const p = cachePath(projectRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(
    p,
    JSON.stringify({ key, savedAt: new Date().toISOString() }, null, 2),
  );
}

/**
 * Run `expo-doctor`, streaming its output live so the user can watch progress
 * during the 20–40s it takes. Resolves with `{ ok, output }` — never throws on
 * a doctor failure. Throws only on unexpected spawn errors.
 */
export function runExpoDoctor({ projectRoot = DEFAULT_PROJECT_ROOT } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "expo-doctor"], {
      cwd: projectRoot,
      // Doctor never needs stdin; ignoring it prevents any accidental prompt.
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1" },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      const s = d.toString();
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      process.stderr.write(s);
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({ ok: code === 0, output: (stdout + stderr) });
    });
  });
}

/**
 * Pull failed-check names (and their advice block) out of doctor output so we
 * can list them in the failure summary. Doctor prints one section per check,
 * each starting with `✖ <check name>` followed by indented advice lines until
 * the next `✓` / `✖` marker or the closing summary line.
 */
export function parseFailedChecks(output) {
  const lines = output.replace(ANSI_RE, "").split(/\r?\n/);
  const failed = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\u2716\s*(.+?)\s*$/);
    if (!m) continue;
    const detail = [];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (/^[\u2713\u2716]\s/.test(next)) break;
      if (/^\d+\s+check[s]?\s+failed/.test(next)) break;
      if (next.trim() === "") continue;
      detail.push(next.trim());
    }
    failed.push({ name: m[1], detail: detail.join("\n      ") });
  }
  return failed;
}

/**
 * Run the doctor and exit the current process with a clear message when it
 * fails. Returns normally when all checks pass (or the cache says we already
 * passed for this set of inputs).
 */
export async function enforceExpoDoctor({
  projectRoot = DEFAULT_PROJECT_ROOT,
  context = "startup",
} = {}) {
  const force = process.env.EXPO_DOCTOR_FORCE === "1";

  let cacheKey = null;
  try {
    cacheKey = computeCacheKey(projectRoot);
  } catch (err) {
    console.warn(
      `[expo-doctor] Could not compute cache key (${err.message}); running anyway.`,
    );
  }

  if (!force && cacheKey) {
    const cache = readCache(projectRoot);
    if (cache && cache.key === cacheKey) {
      console.log(
        `[expo-doctor] Cached pass — package.json / app.json / lockfile unchanged since ${cache.savedAt}. ✓`,
      );
      return;
    }
  }

  console.log(
    "[expo-doctor] Running expo-doctor (this can take 20–40s; cached on success)...",
  );

  let result;
  try {
    result = await runExpoDoctor({ projectRoot });
  } catch (err) {
    console.error(
      `[expo-doctor] Could not run \`expo-doctor\`: ${err.message}`,
    );
    console.error(
      "[expo-doctor] Skipping the guardrail. Fix the spawn error and retry.",
    );
    process.exit(1);
  }

  if (result.ok) {
    console.log("[expo-doctor] All doctor checks passed. ✓");
    if (cacheKey) {
      try {
        writeCache(projectRoot, cacheKey);
      } catch (err) {
        console.warn(
          `[expo-doctor] Could not write cache (${err.message}); doctor will rerun next time.`,
        );
      }
    }
    return;
  }

  const failures = parseFailedChecks(result.output);
  console.error("");
  console.error(
    `[expo-doctor] Blocked ${context}: expo-doctor reported failed checks.`,
  );
  if (failures.length > 0) {
    console.error("[expo-doctor] Failed checks:");
    for (const f of failures) {
      console.error(`  - ${f.name}`);
      if (f.detail) {
        console.error(`      ${f.detail}`);
      }
    }
  } else {
    console.error(
      "[expo-doctor] (Could not parse failed-check names; see the streamed output above for details.)",
    );
  }
  console.error("");
  console.error(
    "[expo-doctor] Fix each failed check above, then re-run with `pnpm --filter @workspace/catfish run check:expo-doctor`.",
  );
  console.error(
    "[expo-doctor] Set EXPO_DOCTOR_FORCE=1 to bypass the cache when retrying.",
  );
  process.exit(1);
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  enforceExpoDoctor({ context: "check" });
}
