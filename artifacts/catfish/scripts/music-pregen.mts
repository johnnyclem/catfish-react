/**
 * music-pregen — synthesize a single loopable noir-pad backing track
 * as a 16-bit mono WAV. Deterministic; rerunning regenerates the same
 * bytes. The track is short and deliberately sparse so it can loop
 * without becoming grating during long play sessions.
 *
 * Output: artifacts/catfish/assets/audio/music/noir_loop.wav
 *
 * Run with: pnpm --filter @workspace/catfish run music:pregen
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "assets", "audio", "music");
const SR = 22050;

const BPM = 64;
const BEAT = 60 / BPM; // seconds per beat
const BARS = 4;
const BEATS_PER_BAR = 4;
const TOTAL_BEATS = BARS * BEATS_PER_BAR; // 16
const DURATION = TOTAL_BEATS * BEAT; // ~15s

// D natural minor: D F A C — moody, fits the noir tone.
const ROOT = 146.83; // D3
const ARP = [0, 3, 7, 10, 12, 10, 7, 3]; // semitone offsets — ascending+descending
const ARP_RATE = 2; // notes per beat

function semi(base: number, n: number): number {
  return base * Math.pow(2, n / 12);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function softclip(x: number): number {
  // gentle tanh-like saturation so layered voices don't clip hard
  if (x > 1) return 1;
  if (x < -1) return -1;
  return x - (x * x * x) / 3;
}

function pluckEnv(t: number, dur: number): number {
  if (t < 0 || t > dur) return 0;
  if (t < 0.005) return t / 0.005;
  return Math.pow(0.001, (t - 0.005) / dur); // exponential decay
}

function padEnv(t: number, dur: number): number {
  if (t < 0 || t > dur) return 0;
  const attack = 0.6;
  const release = 0.6;
  if (t < attack) return t / attack;
  if (t > dur - release) return Math.max(0, (dur - t) / release);
  return 1;
}

function writeWav(filename: string, samples: Int16Array): void {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i += 1) {
    buf.writeInt16LE(samples[i] ?? 0, 44 + i * 2);
  }
  writeFileSync(filename, buf);
}

const totalSamples = Math.floor(DURATION * SR);
const out = new Int16Array(totalSamples);

// ── 1. Slow drone pad: D + A (root + fifth) sustained the whole loop,
//      with a slight LFO on the A for movement.
function drone(t: number): number {
  const root = Math.sin(2 * Math.PI * ROOT * t) * 0.18;
  const fifth =
    Math.sin(2 * Math.PI * semi(ROOT, 7) * t * (1 + 0.0008 * Math.sin(2 * Math.PI * 0.13 * t))) *
    0.13;
  // sub-octave to give it some weight on a phone speaker
  const sub = Math.sin(2 * Math.PI * (ROOT * 0.5) * t) * 0.1;
  return (root + fifth + sub) * padEnv(t, DURATION);
}

// ── 2. Arpeggio voice — triangle-ish for a soft chiptune feel.
function arpAt(beatIdx: number, t: number): number {
  const semitone = ARP[beatIdx % ARP.length] ?? 0;
  const f = semi(ROOT * 2, semitone); // octave up so it sits over the drone
  const phase = (t * f) % 1;
  // triangle
  const tri = Math.abs(((phase + 0.25) % 1) * 4 - 2) - 1;
  // a touch of square underneath at half-volume
  const sq = phase < 0.5 ? 1 : -1;
  return tri * 0.7 + sq * 0.2;
}

const arpStep = BEAT / ARP_RATE; // seconds per arpeggio note
const arpDur = arpStep * 0.95;

for (let i = 0; i < totalSamples; i += 1) {
  const t = i / SR;

  let v = drone(t);

  // arpeggio: which note are we currently on?
  const noteIdx = Math.floor(t / arpStep);
  const noteT = t - noteIdx * arpStep;
  v += arpAt(noteIdx, noteT) * pluckEnv(noteT, arpDur) * 0.22;

  // ── 3. Bass pulse on beats 1 and 3 of each bar (the "heartbeat")
  const beatPos = (t / BEAT) % BEATS_PER_BAR;
  const beatNum = Math.floor(beatPos);
  if (beatNum === 0 || beatNum === 2) {
    const bt = beatPos - beatNum; // 0..1 within the beat
    const bAbs = bt * BEAT; // seconds since downbeat
    const bassF = beatNum === 0 ? ROOT * 0.5 : semi(ROOT * 0.5, 5); // D2 / G2
    v += Math.sin(2 * Math.PI * bassF * bAbs) * pluckEnv(bAbs, BEAT * 0.6) * 0.28;
  }

  // ── 4. Crossfade the loop boundary into itself so the WAV loops
  //      seamlessly: the last 0.4s fades out as the first 0.4s would
  //      fade in, summed to keep amplitude continuous.
  const xfade = 0.35;
  if (t > DURATION - xfade) {
    const k = (DURATION - t) / xfade; // 1→0
    const tHead = t - (DURATION - xfade) - xfade; // pull in the would-be wraparound
    const head = drone(tHead) * 0.7; // approximate — just enough to soften the seam
    v = lerp(head, v, k);
  }

  out[i] = Math.round(softclip(v) * 30000);
}

mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, "noir_loop.wav");
writeWav(outPath, out);
console.log(
  `Wrote noir_loop.wav  ${DURATION.toFixed(2)}s  ${((44 + out.length * 2) / 1024).toFixed(1)}KB`,
);
