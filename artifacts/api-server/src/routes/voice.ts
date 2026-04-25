/**
 * /voice — text-to-speech proxy backed by ElevenLabs.
 *
 * Two reasons this lives behind our own server instead of a direct
 * client call to ElevenLabs:
 *
 *   1. The API key never leaves the server. The Replit Connectors
 *      SDK injects auth headers via the proxy call.
 *
 *   2. We get a content-addressed disk cache — repeat calls with the
 *      same (voiceId, settings, text) tuple skip the upstream call
 *      entirely. This makes the pre-gen script idempotent and keeps
 *      the live-TTS path cheap on hot lines.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { logger } from "../lib/logger";
import { getConnectorsClient } from "../lib/connectors";

const router: IRouter = Router();

/* ─────────────── schema ──────────────────────────────────────────── */

// Hand-authored to match openapi.yaml#/components/schemas/VoiceSpeakRequest.
// Trimming both bounds keeps the cache key normalised regardless of
// minor caller drift.
const VoiceSettingsSchema = z
  .object({
    stability: z.number().min(0).max(1).optional(),
    similarityBoost: z.number().min(0).max(1).optional(),
    style: z.number().min(0).max(1).optional(),
    useSpeakerBoost: z.boolean().optional(),
  })
  .strict();

const VoiceSpeakRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(4000),
    voiceId: z.string().trim().min(1),
    modelId: z.string().trim().min(1).optional(),
    settings: VoiceSettingsSchema.optional(),
  })
  .strict();

type VoiceSpeakRequest = z.infer<typeof VoiceSpeakRequestSchema>;

const DEFAULT_MODEL = "eleven_multilingual_v2";

/* ─────────────── disk cache ──────────────────────────────────────── */

// Sits beside dist/ — gitignored. Stable across rebuilds because we
// resolve from the api-server artifact root, not from import.meta.url
// (which moves into dist/ at build time).
const CACHE_DIR = path.resolve(
  process.cwd(),
  "artifacts/api-server/.cache/voice",
);

let cacheReady: Promise<void> | null = null;

async function ensureCacheDir(): Promise<void> {
  if (!cacheReady) {
    cacheReady = mkdir(CACHE_DIR, { recursive: true }).then(() => undefined);
  }
  return cacheReady;
}

/**
 * Cache key — sha256 of the canonical (voiceId, modelId, settings, text)
 * tuple. Note that `JSON.stringify` over a normalised settings object
 * keeps key ordering deterministic, since the keys we accept are a
 * fixed set in a fixed declaration order.
 */
function cacheKey(req: Required<Pick<VoiceSpeakRequest, "text" | "voiceId">> & {
  modelId: string;
  settings: VoiceSpeakRequest["settings"];
}): string {
  const canonical = JSON.stringify({
    voiceId: req.voiceId,
    modelId: req.modelId,
    // Serialize keys in a fixed order — guards against object-spread
    // re-ordering breaking cache keys across releases.
    settings: req.settings
      ? {
          stability: req.settings.stability ?? null,
          similarityBoost: req.settings.similarityBoost ?? null,
          style: req.settings.style ?? null,
          useSpeakerBoost: req.settings.useSpeakerBoost ?? null,
        }
      : null,
    text: req.text,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function cachePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.mp3`);
}

async function readFromCache(key: string): Promise<Buffer | null> {
  try {
    return await readFile(cachePath(key));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    // Anything other than "missing file" is worth surfacing — could be
    // a permissions problem we don't want to swallow.
    logger.warn({ err, key }, "voice cache read failed");
    return null;
  }
}

async function writeToCache(key: string, body: Buffer): Promise<void> {
  await ensureCacheDir();
  try {
    await writeFile(cachePath(key), body);
  } catch (err) {
    // Cache failure is non-fatal — we still return the audio bytes.
    logger.warn({ err, key }, "voice cache write failed");
  }
}

/* ─────────────── upstream call ───────────────────────────────────── */

interface UpstreamResult {
  audio: Buffer;
}

/** Map our camelCase wire format to ElevenLabs' snake_case API. */
function toElevenLabsBody(input: VoiceSpeakRequest, modelId: string): string {
  const voiceSettings = input.settings
    ? {
        stability: input.settings.stability,
        similarity_boost: input.settings.similarityBoost,
        style: input.settings.style,
        use_speaker_boost: input.settings.useSpeakerBoost,
      }
    : undefined;
  return JSON.stringify({
    text: input.text,
    model_id: modelId,
    voice_settings: voiceSettings,
  });
}

async function callElevenLabs(
  input: VoiceSpeakRequest,
  modelId: string,
): Promise<UpstreamResult> {
  const connectors = getConnectorsClient();
  const proxyRes = await connectors.proxy(
    "elevenlabs",
    `/v1/text-to-speech/${encodeURIComponent(input.voiceId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: toElevenLabsBody(input, modelId),
    },
  );

  if (!proxyRes.ok) {
    // Pull the upstream error body as text so we can surface a useful
    // message back to the caller (especially during the pre-gen pass
    // when a stale voice id will produce a quiet 422).
    let detail = "";
    try {
      detail = await proxyRes.text();
    } catch {
      detail = "<unreadable upstream body>";
    }
    const err = new Error(
      `ElevenLabs upstream returned ${proxyRes.status}: ${detail.slice(0, 400)}`,
    );
    (err as Error & { upstreamStatus?: number }).upstreamStatus = proxyRes.status;
    throw err;
  }

  const audio = Buffer.from(await proxyRes.arrayBuffer());
  if (audio.byteLength === 0) {
    throw new Error("ElevenLabs upstream returned an empty audio body");
  }
  return { audio };
}

/* ─────────────── abuse guard ─────────────────────────────────────── */

/**
 * Lightweight per-IP token-bucket rate limit. The route proxies a
 * paid upstream (ElevenLabs) and is reachable from the public web via
 * the Replit dev domain — without a guard, anyone with the URL could
 * burn quota / cost. Burst budget + sustained refill chosen to
 * comfortably accommodate one player working through a chat thread
 * (rare new lines) while throttling scripted abuse to a crawl.
 *
 * In-memory only — restarting the server resets the buckets. Good
 * enough for this artifact (single-process); a multi-replica deploy
 * would need a shared store like Redis instead.
 */
const RATE_LIMIT_BURST = 30; // tokens immediately available per IP
const RATE_LIMIT_REFILL_PER_SEC = 0.5; // ≈ 30 req/min sustained

interface Bucket {
  tokens: number;
  lastRefill: number;
}
const buckets = new Map<string, Bucket>();
// Cap the map so a flood of unique IPs can't OOM the process.
const BUCKETS_CAP = 5000;

function rateLimitConsume(ip: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket) {
    if (buckets.size >= BUCKETS_CAP) {
      // Drop the oldest entry to keep the map bounded. Map iteration
      // order is insertion order, so the first key is the LRU-ish one.
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

/**
 * Best-effort client identifier. Express's `req.ip` honours the
 * trust-proxy setting; behind the Replit edge that's the real client.
 * Falls back to socket address for the local-dev case.
 */
function clientIp(req: Request): string {
  return (
    req.ip ?? req.socket.remoteAddress ?? "unknown"
  );
}

/* ─────────────── route ───────────────────────────────────────────── */

router.post("/voice/speak", async (req: Request, res: Response) => {
  const t0 = Date.now();

  // Throttle FIRST — cheap rejection before we ever touch the body
  // parser or upstream. Returns 429 + Retry-After so well-behaved
  // clients back off rather than hammering.
  const ip = clientIp(req);
  if (!rateLimitConsume(ip)) {
    res.setHeader("Retry-After", "30");
    return res.status(429).json({
      error: "rate_limited",
      detail: "Too many voice requests from this client. Try again shortly.",
    });
  }

  const parsed = VoiceSpeakRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_request",
      detail: parsed.error.message,
    });
  }

  const input = parsed.data;
  const modelId = input.modelId ?? DEFAULT_MODEL;
  const key = cacheKey({
    text: input.text,
    voiceId: input.voiceId,
    modelId,
    settings: input.settings,
  });

  // Hot path: serve from disk if the cached MP3 is sitting there.
  await ensureCacheDir();
  const cached = await readFromCache(key);
  if (cached) {
    logger.info(
      {
        cache: "hit",
        voiceId: input.voiceId,
        bytes: cached.byteLength,
        ms: Date.now() - t0,
      },
      "voice/speak",
    );
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("X-Voice-Cache", "hit");
    return res.send(cached);
  }

  try {
    const { audio } = await callElevenLabs(input, modelId);
    // Fire-and-await: we want the cache write to finish before
    // responding so the *next* identical request always hits cache,
    // even back-to-back. The write is small and local.
    await writeToCache(key, audio);

    logger.info(
      {
        cache: "miss",
        voiceId: input.voiceId,
        bytes: audio.byteLength,
        ms: Date.now() - t0,
      },
      "voice/speak",
    );
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("X-Voice-Cache", "miss");
    return res.send(audio);
  } catch (err) {
    const upstreamStatus =
      (err as Error & { upstreamStatus?: number }).upstreamStatus ?? null;
    logger.error(
      { err, voiceId: input.voiceId, upstreamStatus, ms: Date.now() - t0 },
      "voice/speak failed",
    );

    // 401/403 from upstream → the caller should know it's an auth
    // problem, not a bad request. Anything else is a 502.
    if (upstreamStatus === 401 || upstreamStatus === 403) {
      return res.status(502).json({
        error: "upstream_unauthorized",
        detail:
          "ElevenLabs rejected our credentials. Re-link the integration if this persists.",
      });
    }
    if (upstreamStatus === 429) {
      return res.status(502).json({
        error: "upstream_rate_limited",
        detail: "ElevenLabs rate-limited the request. Try again shortly.",
      });
    }
    return res.status(502).json({
      error: "upstream_failure",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
