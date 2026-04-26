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
import type { VoiceProfile } from "@/core/voiceProfiles";

/**
 * Convert an ArrayBuffer to a base64 string without pulling in the
 * Node-only `buffer` polyfill. `btoa` is available in Hermes since
 * RN 0.71 and on the web. We chunk the byte array because
 * `String.fromCharCode.apply` blows the JS arg-stack on large buffers.
 */
function arrayBufferToBase64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(
      null,
      slice as unknown as number[],
    );
  }
  return btoa(binary);
}

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

  const base64 = arrayBufferToBase64(await res.arrayBuffer());
  const cacheHeader = res.headers.get("X-Voice-Cache");
  const cache: SpeakResult["cache"] =
    cacheHeader === "hit" || cacheHeader === "miss" ? cacheHeader : "unknown";

  return {
    uri: `data:audio/mpeg;base64,${base64}`,
    cache,
  };
}
