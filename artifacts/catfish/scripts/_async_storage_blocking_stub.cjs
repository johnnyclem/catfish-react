"use strict";
/**
 * AsyncStorage stub with a controllable per-key gate. Tests that need
 * to assert write serialization can pause `setItem` for a chosen key,
 * fire several writes, then release them and inspect the resolution
 * order. When no gate is installed the stub behaves like the
 * always-immediate variant in `_async_storage_stub.cjs`.
 */
const storage = new Map();
/** key -> array of pending { release, settled } controllers. */
const gates = new Map();
/** key -> array of values written to that key, in setItem-call order. */
const writeLog = new Map();

const impl = {
  async getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  async setItem(key, value) {
    if (!writeLog.has(key)) writeLog.set(key, []);
    writeLog.get(key).push(value);
    if (gates.has(key)) {
      const pending = gates.get(key);
      let release;
      const settled = new Promise((resolve) => {
        release = resolve;
      });
      pending.push({ release, settled });
      await settled;
    }
    storage.set(key, value);
  },
  async removeItem(key) {
    storage.delete(key);
  },
};

module.exports = {
  __esModule: true,
  default: impl,
  /** Install a gate so future setItem(key, …) calls block until released. */
  __installGate(key) {
    if (!gates.has(key)) gates.set(key, []);
  },
  /** Remove the gate; any further setItem calls resolve immediately. */
  __removeGate(key) {
    gates.delete(key);
  },
  /** Number of currently-blocked setItem calls waiting on the gate. */
  __pendingCount(key) {
    return (gates.get(key) || []).filter((p) => !p.released).length;
  },
  /** Release the next blocked setItem call (oldest first). */
  __releaseOne(key) {
    const pending = gates.get(key);
    if (!pending || pending.length === 0) return false;
    const next = pending.shift();
    next.released = true;
    next.release();
    return true;
  },
  /** Snapshot of every value written to a key, in call order. */
  __writeLog(key) {
    return [...(writeLog.get(key) || [])];
  },
  /** Reset the entire stub between tests. */
  __reset() {
    storage.clear();
    gates.clear();
    writeLog.clear();
  },
  __getStored(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
};
