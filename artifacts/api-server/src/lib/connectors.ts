/**
 * Lazy, never-cached accessor for the Replit Connectors SDK client.
 *
 * Per the integrations skill: "Never cache the client object the
 * snippet creates — tokens expire." We construct the SDK fresh on
 * every call. Construction is cheap (no network) — only the proxy
 * call does I/O.
 *
 * The `elevenlabs` connection is wired to this project at the
 * platform level (see `.replit` `[agent].integrations`); the SDK
 * uses `REPL_IDENTITY` + `REPLIT_CONNECTORS_HOSTNAME` from the
 * environment to authenticate the proxy call.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";

export function getConnectorsClient(): ReplitConnectors {
  return new ReplitConnectors();
}
