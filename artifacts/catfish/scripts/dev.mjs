#!/usr/bin/env node
/**
 * Replit dev wrapper for the Expo dev server.
 *
 * This wrapper is intentionally tiny — it just shells out to the standard
 * `expo start` command with the Replit-specific environment variables wired
 * up. We keep it as its own script (instead of inlining the env into the
 * package.json `dev` script) so that subsequent platform fixes can be
 * applied here without touching package.json.
 */
import { spawn } from "node:child_process";

const PORT = process.env.PORT || "21328";

const env = {
  ...process.env,
  EXPO_PACKAGER_PROXY_URL: process.env.REPLIT_EXPO_DEV_DOMAIN
    ? `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`
    : process.env.EXPO_PACKAGER_PROXY_URL,
  EXPO_PUBLIC_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
  EXPO_PUBLIC_REPL_ID: process.env.REPL_ID,
  REACT_NATIVE_PACKAGER_HOSTNAME: process.env.REPLIT_DEV_DOMAIN,
};

const child = spawn(
  "pnpm",
  ["exec", "expo", "start", "--localhost", "--port", PORT],
  { stdio: "inherit", env },
);
child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
