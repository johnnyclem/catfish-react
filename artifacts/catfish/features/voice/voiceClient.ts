/**
 * voiceClient — thin wrapper around the api-server's
 * POST /api/voice/speak endpoint, returning a player-ready URI.
 *
 * Live-TTS fallback path. Pre-generated lines are served straight
 * from the bundled audioManifest and never hit this code.
 *
 * The api-server returns audio/mpeg bytes. We turn those bytes into
 * a base64 data: URL so expo-audio can play them on both web and
 * native without us depending on expo-file-system.
 */
import { Buffer } from "buffer";

import type { VoiceProfile } from "@/core/voiceProfiles";

const DEFAULT_BASE = "/api";

/**
 * Resolve the api-server base. On the device (Expo native build) we
 * need an absolute URL because there's no proxy in front of the app.
 * On the web preview, the api-server is mounted under `/api` of the
 * same domain and a relative URL works.
 *
 * `EXPO_PUBLIC_DOMAIN` is wired up by `scripts/dev.mjs` to the Replit
 * dev domain — the same domain the artifact preview is served from.
 */
function apiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}/api`;
  return DEFAULT_BASE;
}

interface SpeakArgs {
  profile: VoiceProfile;
  text: string;
  signal?: AbortSignal;
}

interface SpeakResult {
  /** A `data:audio/mpeg;base64,…` URL that expo-audio can play directly. */
  uri: string;
  /** "hit" if the api-server served from its disk cache, else "miss". */
  cache: "hit" | "miss" | "unknown";
}

/**
 * Synthesize `text` for the given voice profile and return a playable
 * data URI. Throws on non-2xx responses so the caller can decide
 * whether to retry, fall back, or simply log.
 */
export async function fetchVoiceClip(
  args: SpeakArgs,
): Promise<SpeakResult> {
  const url = `${apiBase()}/voice/speak`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: args.text,
      voiceId: args.profile.voiceId,
      modelId: args.profile.modelId,
      settings: args.profile.settings,
    }),
    signal: args.signal,
  });

  if (!res.ok) {
    // Pull the JSON error body for a useful exception message — handy
    // when chasing down voice-id typos in voiceProfiles.ts.
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = `${res.status} ${(body as { error?: string }).error ?? "?"}`;
    } catch {
      /* swallow — fall through to numeric status */
    }
    throw new Error(`voice/speak failed: ${detail}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const cacheHeader = res.headers.get("X-Voice-Cache");
  const cache: SpeakResult["cache"] =
    cacheHeader === "hit" || cacheHeader === "miss" ? cacheHeader : "unknown";

  return {
    uri: `data:audio/mpeg;base64,${buf.toString("base64")}`,
    cache,
  };
}
