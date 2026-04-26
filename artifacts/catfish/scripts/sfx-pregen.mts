/**
 * sfx-pregen — synthesize the bundled UI sound effects as 16-bit
 * mono WAV files. Deterministic; rerunning regenerates identical bytes.
 *
 * Output: artifacts/catfish/assets/audio/sfx/<name>.wav
 *
 * Why we generate at build time instead of shipping handcrafted MP3s:
 *   - Zero external dependencies — any contributor can rebuild.
 *   - Tiny payloads (sub-30KB each at 22050Hz mono).
 *   - Aesthetic match: chiptune blips suit the pixel-art noir tone.
 *
 * Run with: pnpm --filter @workspace/catfish run sfx:pregen
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "assets", "audio", "sfx");
const SR = 22050;

interface Voice {
  /** Hz */
  freq: (t: number) => number;
  /** 0..1 amplitude shape */
  amp: (t: number) => number;
  /** Waveform sample at phase ϕ ∈ [0,1) */
  shape?: (phase: number) => number;
}

function sineShape(phase: number): number {
  return Math.sin(phase * Math.PI * 2);
}

function squareShape(phase: number): number {
  return phase < 0.5 ? 1 : -1;
}

function triangleShape(phase: number): number {
  const p = (phase + 0.25) % 1;
  return Math.abs(p * 4 - 2) - 1;
}

function envADSR(
  t: number,
  duration: number,
  attack = 0.01,
  decay = 0.05,
  sustain = 0.7,
  release = 0.1,
): number {
  if (t < 0 || t > duration) return 0;
  if (t < attack) return t / attack;
  if (t < attack + decay) {
    return 1 - (1 - sustain) * ((t - attack) / decay);
  }
  const sustainEnd = duration - release;
  if (t < sustainEnd) return sustain;
  return sustain * (1 - (t - sustainEnd) / release);
}

function noise(seed: { s: number }): number {
  // xorshift32 — deterministic seeded white noise
  let x = seed.s | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  seed.s = x | 0;
  return (x >>> 0) / 0xffffffff * 2 - 1;
}

function render(samples: number, write: (t: number, i: number) => number): Int16Array {
  const out = new Int16Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const t = i / SR;
    const v = Math.max(-1, Math.min(1, write(t, i)));
    out[i] = Math.round(v * 32760);
  }
  return out;
}

function mix(...voices: Voice[]): (t: number) => number {
  return (t: number) => {
    let acc = 0;
    let n = 0;
    for (const v of voices) {
      const f = v.freq(t);
      const phase = (t * f) % 1;
      const shape = (v.shape ?? sineShape)(phase);
      acc += shape * v.amp(t);
      n += 1;
    }
    return n > 0 ? acc / n : 0;
  };
}

function writeWav(filename: string, samples: Int16Array): void {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24); // sample rate
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples.length; i += 1) {
    buf.writeInt16LE(samples[i] ?? 0, 44 + i * 2);
  }

  writeFileSync(filename, buf);
}

interface SfxRecipe {
  name: string;
  duration: number;
  build: (t: number, i: number, ns: { s: number }) => number;
}

function pitch(freq: number, semitones: number): number {
  return freq * Math.pow(2, semitones / 12);
}

const recipes: SfxRecipe[] = [
  // ── swipe_pass — soft "tch", short noise burst through lowpass-ish env
  {
    name: "swipe_pass",
    duration: 0.12,
    build: (t, _i, ns) => {
      const env = envADSR(t, 0.12, 0.005, 0.04, 0.0, 0.07);
      // pitched downward sine under filtered noise gives a gentle "tch"
      const tone = Math.sin(2 * Math.PI * (300 - t * 600) * t) * 0.3;
      const n = noise(ns) * 0.5;
      return (tone + n) * env * 0.55;
    },
  },

  // ── swipe_like — rising sine chirp 600→1200Hz
  {
    name: "swipe_like",
    duration: 0.18,
    build: (t) => {
      const f0 = 620;
      const f1 = 1240;
      // linear chirp via instantaneous-phase integration
      const phase = 2 * Math.PI * (f0 * t + 0.5 * (f1 - f0) * t * t / 0.18);
      const env = envADSR(t, 0.18, 0.005, 0.05, 0.6, 0.12);
      return Math.sin(phase) * env * 0.75;
    },
  },

  // ── match — triumphant 3-note arpeggio C5–E5–G5, square+sine layer
  {
    name: "match",
    duration: 0.7,
    build: (t) => {
      const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
      const noteLen = 0.16;
      const idx = Math.min(notes.length - 1, Math.floor(t / noteLen));
      const noteT = t - idx * noteLen;
      const f = notes[idx] ?? 0;
      const env = envADSR(noteT, noteLen, 0.005, 0.05, 0.6, 0.08);
      const sq = squareShape((noteT * f) % 1) * 0.35;
      const sn = Math.sin(2 * Math.PI * f * noteT) * 0.55;
      // subtle held ring under final note
      let tail = 0;
      if (idx === notes.length - 1) {
        const tailT = t - (notes.length - 1) * noteLen;
        const tailEnv = envADSR(tailT, 0.7 - (notes.length - 1) * noteLen, 0.01, 0.1, 0.3, 0.25);
        tail = Math.sin(2 * Math.PI * 783.99 * tailT) * 0.25 * tailEnv;
      }
      return (sq + sn) * env * 0.6 + tail;
    },
  },

  // ── fact_filed — two-tone chirp 880→1320, super short
  {
    name: "fact_filed",
    duration: 0.16,
    build: (t) => {
      const a = t < 0.07;
      const f = a ? 880 : 1320;
      const localT = a ? t : t - 0.07;
      const localDur = a ? 0.07 : 0.09;
      const env = envADSR(localT, localDur, 0.003, 0.02, 0.7, 0.04);
      return Math.sin(2 * Math.PI * f * localT) * env * 0.7;
    },
  },

  // ── day_end — descending pad F5→C5→F4
  {
    name: "day_end",
    duration: 0.6,
    build: (t) => {
      const notes = [698.46, 523.25, 349.23]; // F5 C5 F4
      const noteLen = 0.2;
      const idx = Math.min(notes.length - 1, Math.floor(t / noteLen));
      const noteT = t - idx * noteLen;
      const f = notes[idx] ?? 0;
      const env = envADSR(noteT, noteLen, 0.04, 0.06, 0.7, 0.1);
      const a = Math.sin(2 * Math.PI * f * noteT);
      const b = Math.sin(2 * Math.PI * pitch(f, 7) * noteT) * 0.4; // perfect fifth
      return (a + b) * env * 0.45;
    },
  },

  // ── accuse — tense detuned dyad rising over half a sec
  {
    name: "accuse",
    duration: 0.5,
    build: (t) => {
      const f0 = 200;
      const f1 = 360;
      const f = f0 + (f1 - f0) * (t / 0.5);
      const a = Math.sin(2 * Math.PI * f * t);
      const b = Math.sin(2 * Math.PI * f * 1.06 * t); // detune up ~minor 2nd-ish
      const env = envADSR(t, 0.5, 0.06, 0.08, 0.85, 0.12);
      const sub = Math.sin(2 * Math.PI * f * 0.5 * t) * 0.3;
      return (a * 0.4 + b * 0.4 + sub) * env * 0.55;
    },
  },

  // ── win — major triad arpeggio + sustained high
  {
    name: "win",
    duration: 1.4,
    build: (t) => {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
      const noteLen = 0.18;
      const idx = Math.min(notes.length - 1, Math.floor(t / noteLen));
      const noteT = t - idx * noteLen;
      const f = notes[idx] ?? 0;
      const env = envADSR(noteT, noteLen, 0.005, 0.04, 0.65, 0.1);
      const sq = squareShape((noteT * f) % 1) * 0.3;
      const sn = Math.sin(2 * Math.PI * f * noteT) * 0.55;
      let tail = 0;
      if (t > notes.length * noteLen) {
        const tailT = t - notes.length * noteLen;
        const tailDur = 1.4 - notes.length * noteLen;
        if (tailT >= 0 && tailT <= tailDur) {
          const e = envADSR(tailT, tailDur, 0.02, 0.2, 0.4, 0.4);
          tail =
            (Math.sin(2 * Math.PI * 1046.5 * tailT) * 0.4 +
              Math.sin(2 * Math.PI * 1568 * tailT) * 0.25) *
            e;
        }
      }
      return (sq + sn) * env * 0.55 + tail;
    },
  },

  // ── lose — minor 6th descending sting (A4 → C4)
  {
    name: "lose",
    duration: 1.2,
    build: (t) => {
      const notes = [440, 349.23, 261.63]; // A4 F4 C4
      const noteLen = 0.22;
      const idx = Math.min(notes.length - 1, Math.floor(t / noteLen));
      const noteT = t - idx * noteLen;
      const f = notes[idx] ?? 0;
      const env = envADSR(noteT, noteLen, 0.01, 0.05, 0.7, 0.15);
      const sw = triangleShape((noteT * f) % 1) * 0.45;
      const sub = Math.sin(2 * Math.PI * f * 0.5 * t) * 0.2;
      let drone = 0;
      if (t > notes.length * noteLen) {
        const dt = t - notes.length * noteLen;
        const dDur = 1.2 - notes.length * noteLen;
        if (dt >= 0 && dt <= dDur) {
          const e = envADSR(dt, dDur, 0.03, 0.15, 0.4, 0.35);
          drone = Math.sin(2 * Math.PI * 130.81 * dt) * 0.45 * e;
        }
      }
      return (sw + sub) * env * 0.55 + drone;
    },
  },
];

mkdirSync(OUT_DIR, { recursive: true });

let totalBytes = 0;
for (const r of recipes) {
  const samples = Math.floor(r.duration * SR);
  const ns = { s: 0xc0ffee }; // deterministic noise seed per file
  const data = render(samples, (t, i) => r.build(t, i, ns));
  const path = join(OUT_DIR, `${r.name}.wav`);
  writeWav(path, data);
  totalBytes += 44 + data.length * 2;
  console.log(
    `  ${r.name.padEnd(12)} ${(r.duration * 1000).toFixed(0).padStart(5)}ms ${(
      (44 + data.length * 2) /
      1024
    ).toFixed(1).padStart(6)}KB`,
  );
}
console.log(`\nWrote ${recipes.length} SFX, ${(totalBytes / 1024).toFixed(1)}KB total`);
