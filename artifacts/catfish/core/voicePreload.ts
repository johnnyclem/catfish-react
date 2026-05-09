/**
 * VoicePreloadQueue — preloads first N voice lines for a date scene into
 * an in-memory cache so playback starts instantly without a network round-
 * trip on the first beats.
 *
 * Per PRD Epic 2.7: On scene enter, preload the first ~10 voice lines
 * for that scene into memory. Stream the rest. Day 7 scenes don't preload
 * on Day 1.
 *
 * Cache uses a Map of lineId → Audio URI. 7-day TTL per PRD Epic 2.6.
 * Cache is in-memory only (lost on cold start — that's fine, ambient
 * lines are non-canonical for the mystery per PRD).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { fetchVoiceClip } from "@/features/voice/voiceClient";
import type { VoiceProfile } from "@/core/voiceProfiles";

/* ─────────────── TTL constant ─────────────── */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PRELOAD_COUNT = 10;

/* ─────────────── In-memory cache ─────────────── */

interface CacheEntry {
  uri: string;
  expiresAt: number;
}

const voiceCache = new Map<string, CacheEntry>();

/* ─────────────── async cache (persistent) ─────────────── */

/** AsyncStorage key for the per-run voice cache manifest. */
const VOICE_CACHE_KEY = "catfish/voice-cache/v1";

interface CacheManifest {
  entries: Record<string, { uri: string; expiresAt: number }>;
}

async function loadManifest(): Promise<CacheManifest> {
  try {
    const raw = await AsyncStorage.getItem(VOICE_CACHE_KEY);
    if (!raw) return { entries: {} };
    return JSON.parse(raw) as CacheManifest;
  } catch {
    return { entries: {} };
  }
}

async function saveManifest(manifest: CacheManifest): Promise<void> {
  try {
    await AsyncStorage.setItem(VOICE_CACHE_KEY, JSON.stringify(manifest));
  } catch {
    // Non-fatal — cache will rebuild from network.
  }
}

/** Prune expired entries and persist the cleaned manifest. */
async function pruneCache(): Promise<void> {
  const manifest = await loadManifest();
  const now = Date.now();
  const before = Object.keys(manifest.entries).length;
  manifest.entries = Object.fromEntries(
    Object.entries(manifest.entries).filter(([, entry]) => entry.expiresAt > now),
  );
  const after = Object.keys(manifest.entries).length;
  if (before !== after) {
    await saveManifest(manifest);
  }
}

/* ─────────────── fetch + cache ─────────────── */

/**
 * Fetch a voice clip and cache it. Returns immediately if the entry
 * is already in the in-memory cache and not expired. Otherwise,
 * calls fetchVoiceClip and stores the result.
 *
 * Falls back to `null` on failure so the caller can play a fallback
 * voice line without blocking the date.
 */
export async function getCachedVoiceClip(
  lineId: string,
  text: string,
  profile: VoiceProfile,
  signal?: AbortSignal,
): Promise<string | null> {
  const now = Date.now();

  // Hot path: in-memory cache hit and not expired.
  const mem = voiceCache.get(lineId);
  if (mem && mem.expiresAt > now) {
    return mem.uri;
  }

  // Check persisted manifest for a still-valid entry.
  const manifest = await loadManifest();
  const persisted = manifest.entries[lineId];
  if (persisted && persisted.expiresAt > now) {
    const entry: CacheEntry = { uri: persisted.uri, expiresAt: persisted.expiresAt };
    voiceCache.set(lineId, entry);
    return persisted.uri;
  }

  // Cache miss or expired — fetch from network.
  try {
    const result = await fetchVoiceClip({ profile, text, signal });
    const entry: CacheEntry = { uri: result.uri, expiresAt: now + CACHE_TTL_MS };
    voiceCache.set(lineId, entry);
    manifest.entries[lineId] = entry;
    await saveManifest(manifest);
    return result.uri;
  } catch (err) {
    console.warn(`[VoicePreload] failed to fetch voice clip ${lineId}:`, err);
    return null;
  }
}

/* ─────────────── PreloadQueue ─────────────── */

interface PreloadItem {
  lineId: string;
  text: string;
  profile: VoiceProfile;
}

interface PreloadQueue {
  queue: PreloadItem[];
  loaded: Set<string>;
  prefetched: Set<string>;
}

export function createPreloadQueue(items: PreloadItem[]): PreloadQueue {
  return {
    queue: items.slice(0, PRELOAD_COUNT),
    loaded: new Set(),
    prefetched: new Set(),
  };
}

/**
 * Call periodically to prefetch the next batch of lines in the background.
 * Returns how many items were queued for loading this tick.
 */
export async function prefetchNext(
  queue: PreloadQueue,
  signal?: AbortSignal,
  onLoaded?: (lineId: string, uri: string) => void,
): Promise<number> {
  let fetched = 0;
  while (queue.queue.length > 0) {
    const item = queue.queue.shift()!;
    if (queue.prefetched.has(item.lineId) || queue.loaded.has(item.lineId)) {
      continue;
    }
    const uri = await getCachedVoiceClip(item.lineId, item.text, item.profile, signal);
    if (uri) {
      queue.loaded.add(item.lineId);
      onLoaded?.(item.lineId, uri);
      fetched++;
    }
    queue.prefetched.add(item.lineId);
  }
  return fetched;
}

/** Check if a line is already cached and ready for instant playback. */
export function isCached(lineId: string): boolean {
  const mem = voiceCache.get(lineId);
  if (mem && mem.expiresAt > Date.now()) return true;
  return false;
}

/** Clear all in-memory cache. Called on scene exit. */
export function clearInMemoryCache(): void {
  voiceCache.clear();
}

/** Prune expired entries once at startup. Safe to call multiple times. */
const prunePromise = pruneCache();
void prunePromise;