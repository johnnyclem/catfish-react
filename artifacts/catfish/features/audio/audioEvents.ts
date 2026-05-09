/**
 * audioEvents — tiny pub-sub bus for code that needs to fire SFX from
 * places where React hooks are unavailable (the Zustand store, async
 * helpers, etc).
 *
 * Subscribers (typically the `AudioProvider`) own the actual playback.
 * The bus itself never plays anything — it just brokers the request,
 * which keeps the store free of any expo-audio dependency.
 */
import type { SfxName } from "./sfxManifest";

type Listener = (name: SfxName) => void;

const listeners = new Set<Listener>();

/** Fire-and-forget SFX request from anywhere in the app. */
export function emitSfx(name: SfxName): void {
  for (const l of listeners) {
    try {
      l(name);
    } catch {
      // A misbehaving listener must not strand the rest of the bus.
    }
  }
}

/** Fire-and-forget SFX by string key — skips gracefully if unknown. */
export function emitSfxByName(name: string): void {
  emitSfx(name as SfxName);
}

/** Subscribe to SFX requests. Returns an unsubscribe fn. */
export function subscribeSfx(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
