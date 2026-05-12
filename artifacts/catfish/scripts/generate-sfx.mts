/**
 * generate-sfx — generate SFX and ambience tracks via ElevenLabs
 * Sound Effects API.
 *
 * Output:
 *   artifacts/catfish/assets/audio/sfx/<name>.wav
 *   artifacts/catfish/assets/audio/ambience/<name>.wav
 *
 * Uses a hash sidecar (audio-sfx-hashes.json + audio-ambience-hashes.json)
 * for idempotency — re-running with unchanged prompts skips already-
 * generated files.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk_xxx pnpm --filter @workspace/catfish run sfx:gen
 *
 * Prerequisites:
 *   - ElevenLabs account with API key
 *   - ELEVENLABS_API_KEY set in env or .env
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATFISH_ROOT = resolve(__dirname, "..");
const SFX_OUT_DIR = join(CATFISH_ROOT, "assets", "audio", "sfx");
const AMB_OUT_DIR = join(CATFISH_ROOT, "assets", "audio", "ambience");
const SFX_HASHES_PATH = join(CATFISH_ROOT, "assets", "audio", "audio-sfx-hashes.json");
const AMB_HASHES_PATH = join(CATFISH_ROOT, "assets", "audio", "audio-ambience-hashes.json");

const API_KEY = process.env["ELEVENLABS_API_KEY"];
if (!API_KEY) {
  console.error("ERROR: ELEVENLABS_API_KEY is required");
  process.exit(1);
}

const API_BASE = "https://api.elevenlabs.io";

interface SfxRecipe {
  name: string;
  prompt: string;
  durationSeconds?: number;
  promptInfluence?: number;
}

const SFX_RECIPES: SfxRecipe[] = [
  {
    name: "swipe_left",
    prompt: "Quick soft whoosh sound, card being swiped away, short air movement, 0.15 seconds",
    durationSeconds: 1,
  },
  {
    name: "swipe_right",
    prompt: "Quick bright whoosh sound, card being swiped approvingly, upward tone, 0.15 seconds",
    durationSeconds: 1,
  },
  {
    name: "match_first_message_tone",
    prompt: "Soft cheerful notification chime, two rising notes, pleasant and warm, dating app first message alert",
    durationSeconds: 2,
  },
  {
    name: "tab_switch",
    prompt: "Subtle UI click, soft tap sound, interface tab selection, clean and minimal",
    durationSeconds: 1,
  },
  {
    name: "app_open",
    prompt: "Smooth app opening swoosh, brief ascending tone, phone application launch sound",
    durationSeconds: 1,
  },
  {
    name: "app_close",
    prompt: "Quick app closing sound, descending tone, phone application dismiss",
    durationSeconds: 1,
  },
  {
    name: "back_button",
    prompt: "Soft UI back navigation click, gentle tap, interface back button press",
    durationSeconds: 1,
  },
  {
    name: "evidence_link",
    prompt: "Satisfying chain link connection sound, two pieces clicking together, puzzle piece snap, discovery confirmation",
    durationSeconds: 2,
  },
  {
    name: "accusation_correct",
    prompt: "Triumphant revelation sound, ascending orchestral hit, mystery solved, multiple rising tones, victorious",
    durationSeconds: 3,
  },
  {
    name: "accusation_wrong",
    prompt: "Wrong answer buzzer, descending dissonant tone, failure sting, somber and disappointing",
    durationSeconds: 2,
  },
  {
    name: "phone_buzz",
    prompt: "Phone vibration buzz, short low rumble, notification vibration pattern, haptic feedback sound",
    durationSeconds: 1,
  },
  {
    name: "notification_chime",
    prompt: "Soft cheerful notification chime, text message received, pleasant ping, gentle alert",
    durationSeconds: 1,
  },
  {
    name: "message_send",
    prompt: "Message sent swoosh, outgoing text message sound, paper airplane whoosh, short and satisfying",
    durationSeconds: 1,
  },
  {
    name: "message_receive",
    prompt: "Message received pop, incoming text notification, gentle double tap, iPhone message-like soft chime",
    durationSeconds: 1,
  },
  {
    name: "day_advance",
    prompt: "Clock ticking forward, day transition sound, soft page turn with chime, passage of time",
    durationSeconds: 2,
  },
  {
    name: "focusShift",
    prompt: "Subtle camera focus shift sound, soft lens adjustment, gentle transition whoosh, scene change",
    durationSeconds: 2,
  },
  {
    name: "clueDiscovered",
    prompt: "Exciting clue discovery sound, sparkling chime with rising notes, eureka moment, evidence found",
    durationSeconds: 2,
  },
  {
    name: "choiceSelect",
    prompt: "Interactive choice selection sound, soft button press with confirmation tone, menu option select",
    durationSeconds: 1,
  },
  {
    name: "dateEnd",
    prompt: "Date ending sound, romantic soft closure, gentle descending chime, evening ends",
    durationSeconds: 2,
  },
];

const AMBIENCE_RECIPES: SfxRecipe[] = [
  {
    name: "amb_rain",
    prompt: "Steady gentle rain falling, soft precipitation on surfaces, calming background rainfall, continuous rain noise",
    durationSeconds: 10,
  },
  {
    name: "amb_city_night",
    prompt: "Distant city night ambience, far traffic hum, occasional distant siren, urban nighttime atmosphere",
    durationSeconds: 10,
  },
  {
    name: "amb_coffee_shop",
    prompt: "Quiet coffee shop ambience, soft chatter, gentle clinking of cups, warm indoor atmosphere",
    durationSeconds: 10,
  },
  {
    name: "amb_forest",
    prompt: "Peaceful forest ambience, birds chirping, leaves rustling, gentle wind through trees, nature sounds",
    durationSeconds: 10,
  },
  {
    name: "amb_office",
    prompt: "Quiet office ambience, distant keyboard typing, soft air conditioning hum, professional workspace atmosphere",
    durationSeconds: 10,
  },
  {
    name: "amb_subway",
    prompt: "Subway station ambience, train rumbling in distance, platform announcements echo, underground transit atmosphere",
    durationSeconds: 10,
  },
  {
    name: "amb_beach",
    prompt: "Gentle ocean waves lapping shore, seagulls in distance, calm beach atmosphere, relaxing seaside ambience",
    durationSeconds: 10,
  },
  {
    name: "amb_wind",
    prompt: "Wind blowing through empty spaces, mournful but soft, outdoor windy atmosphere, steady breeze",
    durationSeconds: 10,
  },
];

function recipeHash(recipe: SfxRecipe): string {
  return createHash("sha256")
    .update(JSON.stringify({
      prompt: recipe.prompt,
      durationSeconds: recipe.durationSeconds,
      promptInfluence: recipe.promptInfluence,
    }))
    .digest("hex");
}

function loadHashes(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    console.warn(`[generate-sfx] hash sidecar unreadable — starting fresh`);
    return {};
  }
}

function saveHashes(path: string, hashes: Record<string, string>): void {
  writeFileSync(
    path,
    `${JSON.stringify(hashes, Object.keys(hashes).sort(), 2)}\n`,
  );
}

async function generateSound(recipe: SfxRecipe): Promise<Buffer> {
  const url = `${API_BASE}/v1/sound-generation`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/wav",
    },
    body: JSON.stringify({
      text: recipe.prompt,
      duration_seconds: recipe.durationSeconds,
      prompt_influence: recipe.promptInfluence ?? 0.7,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "<unreadable>");
    throw new Error(`ElevenLabs sound API ${res.status}: ${detail.slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function processRecipes(
  label: string,
  recipes: SfxRecipe[],
  outDir: string,
  hashesPath: string,
  ext: string,
): Promise<{ generated: number; skipped: number; failed: number }> {
  mkdirSync(outDir, { recursive: true });
  const hashes = loadHashes(hashesPath);
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`[generate-sfx] generating ${recipes.length} ${label}\n`);

  for (const recipe of recipes) {
    const targetPath = join(outDir, `${recipe.name}.${ext}`);
    const expectedHash = recipeHash(recipe);

    if (hashes[recipe.name] === expectedHash && existsSync(targetPath)) {
      skipped += 1;
      console.log(`  ${recipe.name.padEnd(24)} SKIP (unchanged)`);
      continue;
    }

    process.stdout.write(`  ${recipe.name.padEnd(24)} generating … `);
    try {
      const audio = await generateSound(recipe);
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

  saveHashes(hashesPath, hashes);
  return { generated, skipped, failed };
}

async function main(): Promise<void> {
  const sfxResult = await processRecipes("SFX", SFX_RECIPES, SFX_OUT_DIR, SFX_HASHES_PATH, "wav");
  console.log("");
  const ambResult = await processRecipes("ambience", AMBIENCE_RECIPES, AMB_OUT_DIR, AMB_HASHES_PATH, "wav");

  const totalGen = sfxResult.generated + ambResult.generated;
  const totalSkip = sfxResult.skipped + ambResult.skipped;
  const totalFail = sfxResult.failed + ambResult.failed;

  console.log(
    `\n[generate-sfx] done — ${totalGen} generated, ${totalSkip} skipped, ${totalFail} failed`,
  );
  if (totalFail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[generate-sfx] crashed:", err);
  process.exit(1);
});
