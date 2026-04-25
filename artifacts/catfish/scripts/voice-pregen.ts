/**
 * voice-pregen — author-time renderer for every static suspect line.
 *
 * What it does:
 *   1. Walks every (KillerIdentity) × killerScript and INNOCENT_POOL
 *      × INNOCENT_SCRIPT pair to enumerate the universe of static
 *      lines we want bundled.
 *   2. For each line, computes a hash over (text, voiceId, settings).
 *      If the hash matches the sidecar `audio-hashes.json` AND the
 *      mp3 file already exists, the line is skipped.
 *   3. Otherwise, POSTs to the local api-server at /api/voice/speak,
 *      writes the returned bytes to assets/audio/<key>.mp3, and
 *      updates the hash sidecar.
 *   4. After the walk, regenerates `assets/audioManifest.ts` so the
 *      Metro bundler picks up the new clips with literal `require()`s.
 *
 * Idempotent: re-running the script with no script changes is a no-op
 * (just prints "0 generated"). Edit a line in identities.ts and
 * re-run to regenerate just that line.
 *
 * Usage:
 *   pnpm --filter @workspace/catfish run voice:pregen
 *
 * Pre-requisites: the api-server workflow must be running. The script
 * exits with code 1 immediately if /api/voice/speak isn't reachable.
 */
/* eslint-disable no-console */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { INNOCENT_SCRIPT, IDENTITY_REGISTRY } from "../core/identities";
import {
  INNOCENT_POOL,
  KILLER_VOICES,
  type VoiceProfile,
} from "../core/voiceProfiles";
import type { KillerIdentity } from "../core/models";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATFISH_ROOT = resolve(__dirname, "..");
const AUDIO_DIR = join(CATFISH_ROOT, "assets/audio");
const HASHES_PATH = join(AUDIO_DIR, "audio-hashes.json");
const MANIFEST_PATH = join(CATFISH_ROOT, "assets/audioManifest.ts");

// Where to talk to the api-server. Override with API_BASE for an
// alternate host (e.g. when the server runs on a non-default port).
const API_BASE = process.env["API_BASE"] ?? "http://localhost:8080";

interface SpeakUnit {
  /** Stable lookup key — also the bundled asset filename (sans .mp3). */
  key: string;
  characterKey: string;
  beatKey: string;
  lineIndex: number;
  text: string;
  profile: VoiceProfile;
}

interface HashSidecar {
  // key → sha256 of (text, voiceId, modelId, settings)
  [key: string]: string;
}

/* ─────────────── plan walk ───────────────────────────────────────── */

function planUnits(): SpeakUnit[] {
  const units: SpeakUnit[] = [];

  // Killer beats — 8 identities × ~3-4 turns × ~2 lines each.
  for (const identity of Object.keys(KILLER_VOICES) as KillerIdentity[]) {
    const profile = KILLER_VOICES[identity];
    const mod = IDENTITY_REGISTRY[identity];
    for (const turn of mod.killerScript) {
      const beatKey = turn.beatKey ?? "unknown";
      turn.suspectMessages.forEach((text, i) => {
        units.push({
          key: `${profile.characterKey}_${beatKey}_${i}`,
          characterKey: profile.characterKey,
          beatKey,
          lineIndex: i,
          text,
          profile,
        });
      });
    }
  }

  // Innocent pool × INNOCENT_SCRIPT — N voices × ~4 beats × ~2 lines.
  // We pre-render the full cross-product so any candidate that hashes
  // to any voice has its lines ready.
  for (const profile of INNOCENT_POOL) {
    for (const turn of INNOCENT_SCRIPT) {
      const beatKey = turn.beatKey ?? "unknown";
      turn.suspectMessages.forEach((text, i) => {
        units.push({
          key: `${profile.characterKey}_${beatKey}_${i}`,
          characterKey: profile.characterKey,
          beatKey,
          lineIndex: i,
          text,
          profile,
        });
      });
    }
  }

  return units;
}

/* ─────────────── hashing + sidecar ───────────────────────────────── */

function unitHash(unit: SpeakUnit): string {
  const canonical = JSON.stringify({
    text: unit.text,
    voiceId: unit.profile.voiceId,
    modelId: unit.profile.modelId,
    // Match the api-server's normalised settings shape — see
    // routes/voice.ts. Keys in declaration order so a future re-import
    // of the same data produces the same hash.
    settings: {
      stability: unit.profile.settings.stability ?? null,
      similarityBoost: unit.profile.settings.similarityBoost ?? null,
      style: unit.profile.settings.style ?? null,
      useSpeakerBoost: unit.profile.settings.useSpeakerBoost ?? null,
    },
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function loadHashes(): HashSidecar {
  if (!existsSync(HASHES_PATH)) return {};
  try {
    return JSON.parse(readFileSync(HASHES_PATH, "utf8")) as HashSidecar;
  } catch {
    console.warn("[voice-pregen] hash sidecar unreadable — starting fresh");
    return {};
  }
}

function saveHashes(hashes: HashSidecar): void {
  writeFileSync(
    HASHES_PATH,
    `${JSON.stringify(hashes, Object.keys(hashes).sort(), 2)}\n`,
  );
}

/* ─────────────── http call ───────────────────────────────────────── */

async function fetchOne(unit: SpeakUnit): Promise<Buffer> {
  const res = await fetch(`${API_BASE}/api/voice/speak`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: unit.text,
      voiceId: unit.profile.voiceId,
      modelId: unit.profile.modelId,
      settings: unit.profile.settings,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "<unreadable>");
    throw new Error(
      `voice/speak ${res.status} for ${unit.key}: ${detail.slice(0, 300)}`,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

async function preflightApiServer(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/healthz`);
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    console.error(
      `\n✘ Couldn't reach the api-server at ${API_BASE}/api/healthz.\n` +
        `   Make sure the "artifacts/api-server: API Server" workflow is running\n` +
        `   before re-running this pre-gen pass.\n   Cause: ${
          err instanceof Error ? err.message : String(err)
        }\n`,
    );
    process.exit(1);
  }
}

/* ─────────────── manifest writer ─────────────────────────────────── */

function writeManifest(generatedKeys: string[]): void {
  const sorted = [...generatedKeys].sort();
  const entries = sorted
    .map((key) => `  ${JSON.stringify(key)}: require("./audio/${key}.mp3"),`)
    .join("\n");
  const banner = "// audio-pregen-start";
  const footer = "// audio-pregen-end";
  const replacement = `${banner}\nconst AUDIO_MANIFEST_RAW = {\n${entries}\n} as const;\n${footer}`;
  const current = readFileSync(MANIFEST_PATH, "utf8");
  const re = new RegExp(`${banner}[\\s\\S]*?${footer}`);
  if (!re.test(current)) {
    throw new Error(
      `Manifest markers not found in ${MANIFEST_PATH}. ` +
        `Did the file get hand-edited? Restore the audio-pregen-start ` +
        `/ audio-pregen-end markers and re-run.`,
    );
  }
  writeFileSync(MANIFEST_PATH, current.replace(re, replacement));
}

/* ─────────────── orphan cleanup ──────────────────────────────────── */

/**
 * Drops mp3 files in assets/audio that are no longer referenced by
 * any unit — happens when a line is deleted from a script. Keeps the
 * git diff clean and the bundle slim.
 */
function pruneOrphans(validKeys: Set<string>): string[] {
  if (!existsSync(AUDIO_DIR)) return [];
  const removed: string[] = [];
  for (const file of readdirSync(AUDIO_DIR)) {
    if (!file.endsWith(".mp3")) continue;
    const key = file.slice(0, -".mp3".length);
    if (!validKeys.has(key)) {
      unlinkSync(join(AUDIO_DIR, file));
      removed.push(key);
    }
  }
  return removed;
}

/* ─────────────── main ────────────────────────────────────────────── */

async function main(): Promise<void> {
  console.log(`[voice-pregen] using api at ${API_BASE}`);
  await preflightApiServer();

  if (!existsSync(AUDIO_DIR)) {
    mkdirSync(AUDIO_DIR, { recursive: true });
  }

  const units = planUnits();
  const hashes = loadHashes();
  const validKeys = new Set(units.map((u) => u.key));

  // Sanity: catch a key collision (two units → same filename) at
  // pre-gen time rather than overwriting silently.
  const counts = new Map<string, number>();
  for (const u of units) counts.set(u.key, (counts.get(u.key) ?? 0) + 1);
  const collisions = [...counts.entries()].filter(([, n]) => n > 1);
  if (collisions.length > 0) {
    throw new Error(
      `Voice unit key collision (two lines map to the same filename): ${collisions
        .map(([k, n]) => `${k} (${n}×)`)
        .join(", ")}`,
    );
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const unit of units) {
    const targetPath = join(AUDIO_DIR, `${unit.key}.mp3`);
    const expectedHash = unitHash(unit);
    if (hashes[unit.key] === expectedHash && existsSync(targetPath)) {
      skipped += 1;
      continue;
    }
    try {
      process.stdout.write(`  ${unit.key} … `);
      const audio = await fetchOne(unit);
      writeFileSync(targetPath, audio);
      hashes[unit.key] = expectedHash;
      generated += 1;
      console.log(`${audio.byteLength} bytes`);
    } catch (err) {
      failed += 1;
      console.log(`FAIL — ${err instanceof Error ? err.message : err}`);
      // Drop a stale hash so the next run retries.
      delete hashes[unit.key];
    }
  }

  saveHashes(hashes);

  // Manifest only references units that have a hash row AND a file —
  // a half-failed run won't produce a require() to a missing asset.
  const manifestKeys = units
    .filter(
      (u) =>
        hashes[u.key] !== undefined &&
        existsSync(join(AUDIO_DIR, `${u.key}.mp3`)),
    )
    .map((u) => u.key);
  writeManifest(manifestKeys);

  const removed = pruneOrphans(validKeys);

  console.log(
    `\n[voice-pregen] done — ${generated} generated, ${skipped} skipped, ${failed} failed, ${removed.length} pruned`,
  );
  if (removed.length > 0) {
    console.log(`  pruned: ${removed.join(", ")}`);
  }
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[voice-pregen] crashed:", err);
  process.exit(1);
});
