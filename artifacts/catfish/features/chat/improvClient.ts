/**
 * improvClient — POST /improv/chat wrapper.
 *
 * Task #58. Once an innocent thread runs out of scripted turns, the
 * mobile app calls this to ask the api-server (which calls Gemini)
 * for the next suspect beat plus three reply options. The shape is
 * deliberately tiny so the gameStore can drive the request from a
 * single action and treat the result as if it came from the static
 * tree.
 *
 * Mirrors the base-URL resolution from `voiceClient.ts` so we behave
 * identically across the web preview (relative `/api`) and the
 * Expo native build (absolute `https://${EXPO_PUBLIC_DOMAIN}/api`).
 */

const DEFAULT_BASE = "/api";

let warnedUnreachableDomain = false;
function apiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) {
    const bare = domain.split(":")[0].toLowerCase();
    if (
      !warnedUnreachableDomain &&
      (bare === "localhost" || bare === "127.0.0.1" || bare === "0.0.0.0")
    ) {
      warnedUnreachableDomain = true;
      console.warn(
        `[improv] EXPO_PUBLIC_DOMAIN was baked as "${domain}" — unreachable from a real device. Rebuild with REPLIT_INTERNAL_APP_DOMAIN set.`,
      );
    }
    return `https://${domain}/api`;
  }
  return DEFAULT_BASE;
}

export interface ImprovTranscriptEntry {
  sender: "suspect" | "player";
  text: string;
}

export interface ImprovChatArgs {
  suspect: { name: string; bio: string };
  transcript: ImprovTranscriptEntry[];
  signal?: AbortSignal;
}

export interface ImprovChatResult {
  suspectMessages: string[];
  replyOptions: string[];
}

/**
 * Ask the api-server for the next improv suspect turn. Throws on any
 * non-2xx response so the gameStore can flip `improvError = true` and
 * surface a retry affordance.
 */
export async function fetchImprovTurn(
  args: ImprovChatArgs,
): Promise<ImprovChatResult> {
  const url = `${apiBase()}/improv/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      suspect: args.suspect,
      transcript: args.transcript,
    }),
    signal: args.signal,
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; detail?: string };
      detail = `${res.status} ${body.error ?? body.detail ?? "?"}`;
    } catch {
      /* swallow — fall through to numeric status */
    }
    throw new Error(`improv/chat failed: ${detail}`);
  }

  const body = (await res.json()) as Partial<ImprovChatResult>;
  // Defence-in-depth — the server validates Gemini already, but a
  // bad deploy or a transient proxy error could still return junk.
  // We keep the JSON contract narrow rather than letting an
  // unexpected shape blow up the chat surface.
  const suspectMessages =
    Array.isArray(body.suspectMessages) &&
    body.suspectMessages.every((s) => typeof s === "string")
      ? body.suspectMessages.filter((s) => s.trim().length > 0)
      : [];
  const replyOptions =
    Array.isArray(body.replyOptions) &&
    body.replyOptions.every((s) => typeof s === "string")
      ? body.replyOptions.filter((s) => s.trim().length > 0)
      : [];

  if (suspectMessages.length === 0 || replyOptions.length !== 3) {
    throw new Error(
      `improv/chat returned an unexpected payload (suspect=${suspectMessages.length}, replies=${replyOptions.length})`,
    );
  }

  return { suspectMessages, replyOptions };
}
