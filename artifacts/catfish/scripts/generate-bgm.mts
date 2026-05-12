/**
 * generate-bgm — generate BGM tracks via ElevenLabs Music API.
 *
 * Output: artifacts/catfish/assets/audio/music/<name>.mp3
 *
 * Uses a hash sidecar (audio-music-hashes.json) for idempotency —
 * re-running with unchanged prompts skips already-generated files.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk_xxx pnpm --filter @workspace/catfish run bgm:gen
 *
 * Prerequisites:
 *   - ElevenLabs paid account (Music API requires paid tier)
 *   - ELEVENLABS_API_KEY set in env or .env
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATFISH_ROOT = resolve(__dirname, "..");
const OUT_DIR = join(CATFISH_ROOT, "assets", "audio", "music");
const HASHES_PATH = join(CATFISH_ROOT, "assets", "audio", "audio-music-hashes.json");

const API_KEY = process.env["ELEVENLABS_API_KEY"];
if (!API_KEY) {
  console.error("ERROR: ELEVENLABS_API_KEY is required");
  process.exit(1);
}

const API_BASE = "https://api.elevenlabs.io";

interface BgmRecipe {
  name: string;
  prompt: string;
  /** milliseconds (3s-600s). Default: 20000 */
  lengthMs?: number;
}

const RECIPES: BgmRecipe[] = [
  {
    name: "bgm_main_theme",
    prompt: "Moody noir detective theme, slow jazz-influenced piano melody with deep bass, vinyl crackle texture, melancholic and mysterious, 70 BPM, instrumental",
    lengthMs: 30000,
  },
  {
    name: "bgm_swipe_deck",
    prompt: "Upbeat dating app background music, bright synth pop with light percussion, hopeful and playful, 100 BPM, instrumental",
    lengthMs: 25000,
  },
  {
    name: "bgm_chat",
    prompt: "Subtle background ambient for text conversation, soft electronic pads with gentle pulse, curious and neutral, minimal and unobtrusive, 60 BPM, instrumental",
    lengthMs: 20000,
  },
  {
    name: "bgm_date",
    prompt: "Romantic ambient background for a date scene, warm piano and soft strings, intimate and tender, 65 BPM, instrumental",
    lengthMs: 30000,
  },
  {
    name: "bgm_investigation",
    prompt: "Tense investigation music, dark synth drone with subtle rhythmic pulse, focused and urgent, 80 BPM, instrumental",
    lengthMs: 25000,
  },
  {
    name: "bgm_suspense",
    prompt: "Suspenseful noir soundtrack, creeping bass line with atmospheric pads, unease and tension building, 55 BPM, instrumental",
    lengthMs: 30000,
  },
  {
    name: "bgm_revelation",
    prompt: "Dramatic revelation theme, swelling orchestral strings with deep brass, moment of truth feeling, cinematic and powerful, 75 BPM, instrumental",
    lengthMs: 25000,
  },
  {
    name: "bgm_phone_home",
    prompt: "Retro phone interface background music, lo-fi synthwave with subtle 8-bit textures, nostalgic and calm, 80 BPM, instrumental",
    lengthMs: 20000,
  },
  {
    name: "bgm_journal",
    prompt: "Introspective journal music, solo piano with ambient reverb, thoughtful and quiet, contemplative, 50 BPM, instrumental",
    lengthMs: 25000,
  },
  {
    name: "bgm_accusation",
    prompt: "Intense accusation standoff music, driving percussion with dramatic brass stabs, high stakes and confrontational, 90 BPM, instrumental",
    lengthMs: 20000,
  },
  {
    name: "bgm_end_roll",
    prompt: "Bittersweet end credits music, emotional piano and strings, resolution and reflection, 70 BPM, instrumental",
    lengthMs: 35000,
  },
  {
    name: "bgm_game_over",
    prompt: "Dark game over theme, minor key piano with deep sub bass, somber and heavy, sense of finality, 45 BPM, instrumental",
    lengthMs: 20000,
  },
];

function recipeHash(recipe: BgmRecipe): string {
  return createHash("sha256")
    .update(JSON.stringify({ prompt: recipe.prompt, lengthMs: recipe.lengthMs }))
    .digest("hex");
}

function loadHashes(): Record<string, string> {
  if (!existsSync(HASHES_PATH)) return {};
  try {
    return JSON.parse(readFileSync(HASHES_PATH, "utf8"));
  } catch {
    console.warn("[generate-bgm] hash sidecar unreadable — starting fresh");
    return {};
  }
}

function saveHashes(hashes: Record<string, string>): void {
  writeFileSync(
    HASHES_PATH,
    `${JSON.stringify(hashes, Object.keys(hashes).sort(), 2)}\n`,
  );
}

async function generateTrack(recipe: BgmRecipe): Promise<Buffer> {
  const url = `${API_BASE}/v1/music?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: recipe.prompt,
      music_length_ms: recipe.lengthMs ?? 20000,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "<unreadable>");
    throw new Error(`ElevenLabs music API ${res.status}: ${detail.slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const hashes = loadHashes();
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`[generate-bgm] generating ${RECIPES.length} BGM tracks\n`);

  for (const recipe of RECIPES) {
    const targetPath = join(OUT_DIR, `${recipe.name}.mp3`);
    const expectedHash = recipeHash(recipe);

    if (hashes[recipe.name] === expectedHash && existsSync(targetPath)) {
      skipped += 1;
      console.log(`  ${recipe.name.padEnd(24)} SKIP (unchanged)`);
      continue;
    }

    process.stdout.write(`  ${recipe.name.padEnd(24)} generating … `);
    try {
      const audio = await generateTrack(recipe);
      writeFileSync(targetPath, audio);
      hashes[recipe.name] = expectedHash;
      generated += 1;
      console.log(`${(audio.byteLength / 1024).toFixed(1)} KB`);
    } catch (err) {
      failed += 1;
      console.log(`FAIL — ${err instanceof Error ? err.message : err}`);
      delete hashes[recipe.name];
    }
  }

  saveHashes(hashes);

  console.log(
    `\n[generate-bgm] done — ${generated} generated, ${skipped} skipped, ${failed} failed`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[generate-bgm] crashed:", err);
  process.exit(1);
});
