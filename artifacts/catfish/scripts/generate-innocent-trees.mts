/**
 * generate-innocent-trees — author-time script that asks Gemini for
 * 30 distinct decoy dialogue trees and emits a static TS file at
 * `core/innocentTrees.ts`.
 *
 * The output is committed to the repo as ordinary source code. The
 * runtime never calls Gemini for these trees — improv (the chat
 * surface that kicks in *after* a tree exhausts) is the only live
 * Gemini path. This script exists so a future "expand the pool" pass
 * can re-roll the file without hand-authoring 120 individual
 * `DialogueTurn`s.
 *
 * Idempotent-ish: the generator emits a deterministic file (alphabetical
 * by id, fixed ordering) so re-running with the same Gemini snapshot
 * produces a near-identical diff. Trees are quality-gated (min/max
 * line lengths, exactly 4 turns) before being written; failures throw
 * so the file isn't silently truncated.
 *
 * Usage:
 *   pnpm --filter @workspace/catfish run dialogue:gen
 */
/* eslint-disable no-console */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ai } from "@workspace/integrations-gemini-ai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "core", "innocentTrees.ts");

const TURNS_PER_TREE = 4;
const TREES = 30;
const BATCH_SIZE = 30;

const SYSTEM_INSTRUCTION = `You author short, naturalistic dating-app chat trees for a pixel-art noir detective game called Catfish. The player is a detective swiping on dating profiles to find a serial killer; this content is for the *innocent* matches who are simply trying to date.

Hard constraints on every tree you produce:
- Exactly 4 turns. Each turn is one suspect "beat" plus the player's reply options.
- Each turn has 1 to 2 short suspect lines (5 to 14 words each). Lowercase casual texting voice. No emoji. Contractions are fine. No exclamation marks. Em dashes ok.
- Each turn has exactly 3 reply options. Each option is 2 to 8 words, lowercase, distinct in tone (one earnest, one playful, one cagey/curious).
- The 4 turns flow as: open -> warm-up question -> small reveal/tease -> light date proposal or close. Never explicitly schedule a meet on day/time; keep it open.
- Persona must come through in BOTH the suspect lines and the reply options. A jazz pianist sounds different from a botanist.
- Absolutely no references to crime, murder, danger, suspicion, lying, secrets in a sinister sense, weapons, blood, death, or detective work. These are innocent matches. "Mysterious" or "what aren't you telling me" type teasing is OK as long as it stays flirty, not threatening.

Each tree carries one persona: a single archetype distinct from the other 29.`;

/** Persona seeds, sliced into BATCH_SIZE-sized prompts. */
const PERSONAS: { slug: string; concept: string }[] = [
  { slug: "ceramicist-dawn", concept: "ceramicist who throws bowls at dawn" },
  { slug: "paramedic-dry", concept: "paramedic between shifts, dry humor" },
  { slug: "trivia-host", concept: "competitive trivia host" },
  { slug: "bike-mechanic", concept: "vintage-bike mechanic, grease under nails" },
  { slug: "slam-poet", concept: "slam poet, performs friday nights" },
  { slug: "astronomer", concept: "astronomer at the planetarium" },
  { slug: "sourdough-baker", concept: "sourdough baker who never sleeps in" },
  { slug: "tattoo-apprentice", concept: "tattoo apprentice, soft voice" },
  { slug: "dog-trainer", concept: "dog trainer, mostly large breeds" },
  { slug: "ferry-captain", concept: "ferry captain on the inland route" },
  { slug: "florist-no-roses", concept: "florist who refuses to sell roses" },
  { slug: "game-designer", concept: "game designer making a small thing" },
  { slug: "choir-director", concept: "choir director at a tiny church" },
  { slug: "ice-climber", concept: "ice climber who guides on weekends" },
  { slug: "open-mic-comic", concept: "stand-up comic still in open-mic phase" },
  { slug: "city-archivist", concept: "archivist at the city library" },
  { slug: "noodle-critic", concept: "food critic with strong noodle opinions" },
  { slug: "er-nurse", concept: "ER nurse, just got off shift" },
  { slug: "urban-beekeeper", concept: "urban beekeeper" },
  { slug: "chem-teacher", concept: "high-school chemistry teacher" },
  { slug: "cellist", concept: "cellist in a string quartet" },
  { slug: "neighborhood-mechanic", concept: "neighborhood mechanic, fixes anything" },
  { slug: "moss-botanist", concept: "botanist studying coastal moss" },
  { slug: "lighting-designer", concept: "lighting designer for small theaters" },
  { slug: "wedding-photog", concept: "wedding photographer, hates posed shots" },
  { slug: "overnight-dj", concept: "radio DJ for the overnight set" },
  { slug: "rec-center-potter", concept: "pottery teacher at the rec center" },
  { slug: "salsa-accountant", concept: "forensic accountant by day, salsa by night" },
  { slug: "perfumer-apprentice", concept: "perfumer apprentice, smells everything" },
  { slug: "mystery-bookseller", concept: "bookstore manager, mystery section" },
];

function buildBatchPrompt(batch: { slug: string; concept: string }[]): string {
  const lines = batch
    .map(
      (p, i) =>
        `${i + 1}. id="${p.slug}" — persona: ${p.concept}`,
    )
    .join("\n");
  return `Generate ${batch.length} distinct dating-app chat trees for innocent matches. Each tree has a fixed id and persona — do not invent your own.

${lines}

Return STRICT JSON matching this shape exactly (no prose around it, no markdown fences):

{
  "trees": [
    {
      "id": "<the exact id from the list above>",
      "personaConcept": "one short sentence describing the match's vibe (you write this)",
      "turns": [
        {
          "beatKey": "<id>__open",
          "suspectMessages": ["..."],
          "replyOptions": ["...", "...", "..."]
        }
        // exactly 4 turns total, beatKey suffixes in order: open, warmup, reveal, close
      ]
    }
    // exactly ${batch.length} trees, one per id above, in the order given
  ]
}

Return only the JSON object.`;
}

interface RawTurn {
  beatKey?: unknown;
  suspectMessages?: unknown;
  replyOptions?: unknown;
}
interface RawTree {
  id?: unknown;
  personaConcept?: unknown;
  turns?: unknown;
}
interface RawPayload {
  trees?: unknown;
}

interface CleanTree {
  id: string;
  personaConcept: string;
  turns: {
    beatKey: string;
    suspectMessages: string[];
    replyOptions: string[];
  }[];
}

function isStringArray(v: unknown, min: number, max: number): v is string[] {
  if (!Array.isArray(v)) return false;
  if (v.length < min || v.length > max) return false;
  return v.every((s) => typeof s === "string" && s.trim().length > 0);
}

function clean(payload: RawPayload, expected: number): CleanTree[] {
  const trees = payload.trees;
  if (!Array.isArray(trees))
    throw new Error("payload.trees missing or not an array");
  if (trees.length !== expected)
    throw new Error(
      `expected ${expected} trees, got ${trees.length}`,
    );

  const seenIds = new Set<string>();
  const cleaned: CleanTree[] = [];
  for (const t of trees as RawTree[]) {
    if (typeof t.id !== "string" || !/^[a-z][a-z0-9-]+$/.test(t.id)) {
      throw new Error(`bad id: ${JSON.stringify(t.id)}`);
    }
    if (seenIds.has(t.id)) throw new Error(`duplicate id: ${t.id}`);
    seenIds.add(t.id);

    if (typeof t.personaConcept !== "string" || t.personaConcept.length < 8) {
      throw new Error(`tree ${t.id}: bad personaConcept`);
    }

    if (!Array.isArray(t.turns) || t.turns.length !== TURNS_PER_TREE) {
      throw new Error(
        `tree ${t.id}: expected ${TURNS_PER_TREE} turns, got ${(t.turns as unknown[])?.length ?? "n/a"}`,
      );
    }

    const cleanedTurns = (t.turns as RawTurn[]).map((turn, i) => {
      if (typeof turn.beatKey !== "string" || turn.beatKey.length < 4) {
        throw new Error(`tree ${t.id} turn ${i}: bad beatKey`);
      }
      // Be lenient: accept 1-3 suspect lines, slice to 2 to match the
      // game's chat bubble budget. Model occasionally over-produces.
      if (!isStringArray(turn.suspectMessages, 1, 3)) {
        throw new Error(
          `tree ${t.id} turn ${i}: suspectMessages must be 1-3 strings`,
        );
      }
      // Be lenient: accept 3-4 reply options, slice to 3 (the picker's
      // hard limit).
      if (!isStringArray(turn.replyOptions, 3, 4)) {
        throw new Error(
          `tree ${t.id} turn ${i}: replyOptions must be 3-4 strings`,
        );
      }
      const suspectMessages = turn.suspectMessages.slice(0, 2);
      const replyOptions = turn.replyOptions.slice(0, 3);
      // Length sanity: a chat line longer than ~140 chars is almost
      // always Gemini drifting into prose. Guardrails > silent ship.
      for (const m of suspectMessages) {
        if (m.length > 160)
          throw new Error(
            `tree ${t.id} turn ${i}: suspect line too long (${m.length} chars)`,
          );
      }
      for (const r of replyOptions) {
        if (r.length > 80)
          throw new Error(
            `tree ${t.id} turn ${i}: reply option too long (${r.length} chars)`,
          );
      }
      return {
        beatKey: turn.beatKey,
        suspectMessages: suspectMessages.map((s) => s.trim()),
        replyOptions: replyOptions.map((s) => s.trim()),
      };
    });

    cleaned.push({
      id: t.id,
      personaConcept: t.personaConcept.trim(),
      turns: cleanedTurns,
    });
  }

  cleaned.sort((a, b) => a.id.localeCompare(b.id));
  return cleaned;
}

function tsLiteral(s: string): string {
  // Single-quote strings, escape single quotes and backslashes only.
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function emit(trees: CleanTree[]): string {
  const header = `/**
 * Innocent dialogue tree pool — 30 distinct 4-turn chat trees that
 * non-killer matches draw from at thread-open time. Each thread in a
 * given run claims a unique tree id (see \`CaseRun.usedInnocentScriptIds\`)
 * so two innocent matches in the same run never deliver the same
 * scripted opener.
 *
 * Generated by \`scripts/generate-innocent-trees.mts\`. Hand-edits
 * are welcome — the generator is a one-shot bootstrap, not a
 * deploy-time step. If you re-run the generator, review the diff
 * carefully before committing.
 *
 * Trees are sorted by id so the file diff is deterministic across
 * regenerations.
 */
import type { DialogueTurn } from "./identities";

export interface InnocentTree {
  /** Stable kebab-case id; doubles as the AsyncStorage check-out key. */
  id: string;
  /** Author-facing one-liner (not surfaced in UI). */
  personaConcept: string;
  /** Always 4 turns today. */
  turns: DialogueTurn[];
}

export const INNOCENT_TREE_POOL: readonly InnocentTree[] = [
`;
  const body = trees
    .map((t) => {
      const turns = t.turns
        .map((turn) => {
          const sus = turn.suspectMessages
            .map((m) => `      ${tsLiteral(m)},`)
            .join("\n");
          const reps = turn.replyOptions
            .map((r) => `      ${tsLiteral(r)},`)
            .join("\n");
          return `  {
    beatKey: ${tsLiteral(turn.beatKey)},
    suspectMessages: [
${sus}
    ],
    replyOptions: [
${reps}
    ],
  }`;
        })
        .join(",\n");
      return `  {
    id: ${tsLiteral(t.id)},
    personaConcept: ${tsLiteral(t.personaConcept)},
    turns: [
${turns
  .split("\n")
  .map((l) => "    " + l)
  .join("\n")},
    ],
  }`;
    })
    .join(",\n");
  const footer = `,
];

/** Stable lookup by id — null if the id isn't in the pool. */
export function getInnocentTreeById(id: string): InnocentTree | null {
  for (const t of INNOCENT_TREE_POOL) {
    if (t.id === id) return t;
  }
  return null;
}

/** All ids in pool order; useful for tests + check-out fallback. */
export const INNOCENT_TREE_IDS: readonly string[] = INNOCENT_TREE_POOL.map(
  (t) => t.id,
);
`;
  return header + body + footer;
}

const REQUEST_TIMEOUT_MS = 180_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timed out after ${ms}ms (${label})`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function generateBatch(
  batch: { slug: string; concept: string }[],
  attempt: number,
): Promise<CleanTree[]> {
  const t0 = Date.now();
  const resp = await withTimeout(
    ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [
        { role: "user", parts: [{ text: buildBatchPrompt(batch) }] },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        maxOutputTokens: 65536,
        temperature: 0.9,
      },
    }),
    REQUEST_TIMEOUT_MS,
    `batch attempt ${attempt}`,
  );
  const raw = resp.text ?? "";
  if (!raw.trim())
    throw new Error(`empty response (batch attempt ${attempt})`);
  console.log(`  got ${raw.length} chars in ${Date.now() - t0}ms`);
  let parsed: RawPayload;
  try {
    parsed = JSON.parse(raw) as RawPayload;
  } catch (err) {
    throw new Error(
      `invalid JSON (batch attempt ${attempt}): ${(err as Error).message}`,
    );
  }
  return clean(parsed, batch.length);
}

async function main(): Promise<void> {
  if (PERSONAS.length !== TREES) {
    throw new Error(
      `PERSONAS list has ${PERSONAS.length} entries, expected ${TREES}`,
    );
  }
  const t0 = Date.now();
  const all: CleanTree[] = [];
  for (let i = 0; i < PERSONAS.length; i += BATCH_SIZE) {
    const batch = PERSONAS.slice(i, i + BATCH_SIZE);
    console.log(
      `Batch ${i / BATCH_SIZE + 1}/${Math.ceil(PERSONAS.length / BATCH_SIZE)} — ${batch.length} trees…`,
    );
    let lastErr: unknown = null;
    let batchTrees: CleanTree[] | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        batchTrees = await generateBatch(batch, attempt);
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`  attempt ${attempt} failed: ${(err as Error).message}`);
      }
    }
    if (!batchTrees) throw lastErr;
    all.push(...batchTrees);
  }

  if (all.length !== TREES) {
    throw new Error(`assembled ${all.length} trees, expected ${TREES}`);
  }
  console.log(`Validated ${all.length} trees. Writing ${OUT_PATH}…`);
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, emit(all), "utf8");
  console.log(`✓ Wrote ${all.length} trees in ${Date.now() - t0}ms.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
