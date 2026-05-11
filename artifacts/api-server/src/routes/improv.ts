/**
 * /improv — live chat continuation for innocent dating-app threads.
 *
 * Task #58. Each innocent match starts on a static, hand-generated
 * 4-turn tree (committed at `artifacts/catfish/core/innocentTrees.ts`).
 * After the player consumes the final scripted reply the conversation
 * needs to keep going — rather than authoring 30+ trees of unbounded
 * length, we hand the tail of the transcript to Gemini and ask it to
 * keep the same casual texting voice going for one more turn.
 *
 * Wire shape — kept narrow on purpose so the mobile client can be a
 * thin POST + parse:
 *
 *   POST /improv/chat
 *   { suspect: { name, bio, scriptedTail }, transcript: [...] }
 *   →
 *   { suspectMessages: string[1..2], replyOptions: string[3] }
 *
 * The endpoint is rate-limited per-IP (same shape as /voice/speak) to
 * keep public callers from burning quota on the paid Gemini path.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";

import { ai } from "@workspace/integrations-gemini-ai/client";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/* ─────────────── schema ──────────────────────────────────────────── */

const TranscriptEntrySchema = z
  .object({
    sender: z.enum(["suspect", "player"]),
    // Allow long-ish so we don't reject anything the store has staged,
    // but still cap it so a malicious caller can't shove megabytes of
    // text into a Gemini prompt.
    text: z.string().trim().min(1).max(500),
  })
  .strict();

const ImprovChatRequestSchema = z
  .object({
    suspect: z
      .object({
        name: z.string().trim().min(1).max(80),
        bio: z.string().trim().min(1).max(400),
      })
      .strict(),
    voiceProfile: z
      .object({
        voiceId: z.string().trim().min(1).max(80),
        modelId: z.string().trim().min(1).max(40),
        notes: z.string().trim().min(1).max(200).optional(),
        settings: z
          .object({
            stability: z.number().optional(),
            similarityBoost: z.number().optional(),
            style: z.number().optional(),
            useSpeakerBoost: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    transcript: z.array(TranscriptEntrySchema).min(1).max(40),
  })
  .strict();

type ImprovChatRequest = z.infer<typeof ImprovChatRequestSchema>;

/* ─────────────── prompt ──────────────────────────────────────────── */

// Mirrors the constraints baked into the generator script so the live
// turn reads as a continuation of the static tree, not a tonal break.
// Keep this short — the model handles "match the voice above" better
// than a long re-statement of rules, and short prompts also keep cost
// + latency lower.
//
// Role labels in the transcript are the suspect's display name vs
// "PLAYER" rather than "you"/"them". The "you"/"them" version was
// ambiguous because the system prompt also addresses the model as
// "you", which produced occasional perspective leaks where the model
// dropped a player-style reply ("thanks for offering", "that sounds
// fun") into suspectMessages.
const SYSTEM_INSTRUCTION = `You are continuing an in-progress dating-app chat for a pixel-art noir detective game called Catfish. The player is a detective swiping on dating profiles; you voice an innocent match who is just trying to date.

The transcript below uses two role labels:
- The match's display name (e.g. "SIENNA:") — these are YOUR previous lines as the match.
- "PLAYER:" — these are the detective's previous taps. NEVER write a new line from the PLAYER's perspective in suspectMessages.

Hard constraints on every reply:
- Output JSON: { "suspectMessages": [1-2 strings], "replyOptions": [3 strings] }.
- suspectMessages: 1 to 2 short messages spoken BY the match, continuing what the match has been saying. 5 to 14 words each. Lowercase casual texting voice. No emoji. Contractions fine. No exclamation marks. Em dashes ok. Each line max 80 chars. NEVER thank the player for an offer the match itself just made; never accept an invitation the match itself just extended; never react as if the match is hearing its own previous line for the first time.
- replyOptions: exactly 3, each a complete short sentence the PLAYER (detective) could tap to send. Mix of warm / curious / playful. Each max 60 chars. No emoji. No exclamation marks. These are the only place where player-perspective text belongs.
- Stay 100% in character as a normal person on a date. NEVER describe a crime, mention being a killer, break the fourth wall, or roleplay as the detective. If the player asks something dark, deflect naturally as a real person would.
- Continue the established topic. Do not re-introduce yourself. Do not abruptly change subject unless the previous PLAYER message asked you to.`;

function buildUserPrompt(input: ImprovChatRequest): string {
  const matchLabel = input.suspect.name.toUpperCase();
  const lines = input.transcript
    .map((m) => {
      const tag = m.sender === "suspect" ? matchLabel : "PLAYER";
      return `${tag}: ${m.text}`;
    })
    .join("\n");

  const voiceHints = input.voiceProfile
    ? [
        "",
        "Voice guidance for this character:",
        `- ElevenLabs voice id: ${input.voiceProfile.voiceId}`,
        input.voiceProfile.settings
          ? [
              input.voiceProfile.settings.stability !== undefined
                ? `  stability: ${input.voiceProfile.settings.stability} (0=expressive, 1=monotone)`
                : null,
              input.voiceProfile.settings.similarityBoost !== undefined
                ? `  similarityBoost: ${input.voiceProfile.settings.similarityBoost}`
                : null,
              input.voiceProfile.settings.style !== undefined
                ? `  style: ${input.voiceProfile.settings.style} (0=neutral, 1=exaggerated)`
                : null,
            ]
              .filter(Boolean)
              .join("\n")
          : null,
        input.voiceProfile.notes ? `  character notes: "${input.voiceProfile.notes}"` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return [
    `Match name: ${input.suspect.name}`,
    `Match bio: ${input.suspect.bio}`,
    voiceHints,
    "",
    "Recent conversation (oldest first):",
    lines,
    "",
    `Continue the conversation. Your suspectMessages must be the next thing ${matchLabel} would say to PLAYER, not the other way around. Return JSON only — { "suspectMessages": [...], "replyOptions": [...] }.`,
  ].join("\n");
}

/* ─────────────── upstream call ───────────────────────────────────── */

const MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 25_000;

const RawImprovSchema = z
  .object({
    suspectMessages: z.array(z.string().trim().min(1)).min(1).max(2),
    replyOptions: z.array(z.string().trim().min(1)).length(3),
  })
  .strict();

type Improv = z.infer<typeof RawImprovSchema>;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout after ${ms}ms (${label})`)),
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

// Trim to the per-line caps the system prompt promised. We do this
// server-side too so the client never has to re-validate Gemini drift,
// and so a long line never blows the chat bubble layout.
function tidy(input: Improv): Improv {
  const cap = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
  return {
    suspectMessages: input.suspectMessages.map((s) => cap(s, 80)),
    replyOptions: input.replyOptions.map((s) => cap(s, 60)),
  };
}

async function callGemini(input: ImprovChatRequest): Promise<Improv> {
  const resp = await withTimeout(
    ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(input) }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        // Plenty of headroom for the tiny JSON object we ask for.
        maxOutputTokens: 1024,
        // 0.9 was creative enough that the model occasionally drifted
        // into player-perspective lines inside suspectMessages. 0.7
        // keeps the voice loose without that role-confusion tail.
        temperature: 0.7,
      },
    }),
    REQUEST_TIMEOUT_MS,
    "improv/chat",
  );
  const raw = resp.text ?? "";
  if (!raw.trim()) {
    throw new Error("Gemini returned an empty body");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Gemini returned invalid JSON: ${(err as Error).message}`,
    );
  }
  const validated = RawImprovSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Gemini response failed schema: ${validated.error.message}`,
    );
  }
  return tidy(validated.data);
}

/* ─────────────── abuse guard ─────────────────────────────────────── */

// Mirrors the bucket sizing in /voice/speak — same artifact, same
// rough request rate (one tap per chat turn), same cost concerns.
const RATE_LIMIT_BURST = 30;
const RATE_LIMIT_REFILL_PER_SEC = 0.5;

interface Bucket {
  tokens: number;
  lastRefill: number;
}
const buckets = new Map<string, Bucket>();
const BUCKETS_CAP = 5000;

function rateLimitConsume(ip: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket) {
    if (buckets.size >= BUCKETS_CAP) {
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
    bucket = { tokens: RATE_LIMIT_BURST, lastRefill: now };
    buckets.set(ip, bucket);
  } else {
    const elapsedSec = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      RATE_LIMIT_BURST,
      bucket.tokens + elapsedSec * RATE_LIMIT_REFILL_PER_SEC,
    );
    bucket.lastRefill = now;
  }
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function isLoopback(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("127.")
  );
}

/* ─────────────── route ───────────────────────────────────────────── */

router.post("/improv/chat", async (req: Request, res: Response) => {
  const t0 = Date.now();

  const ip = clientIp(req);
  if (!isLoopback(ip) && !rateLimitConsume(ip)) {
    res.setHeader("Retry-After", "30");
    return res.status(429).json({
      error: "rate_limited",
      detail: "Too many improv requests from this client. Try again shortly.",
    });
  }

  const parsed = ImprovChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_request",
      detail: parsed.error.message,
    });
  }

  try {
    const improv = await callGemini(parsed.data);
    logger.info(
      {
        ms: Date.now() - t0,
        suspectName: parsed.data.suspect.name,
        transcriptLength: parsed.data.transcript.length,
      },
      "improv/chat",
    );
    return res.status(200).json(improv);
  } catch (err) {
    logger.error(
      {
        err,
        ms: Date.now() - t0,
        suspectName: parsed.data.suspect.name,
      },
      "improv/chat failed",
    );
    return res.status(502).json({
      error: "upstream_failure",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
