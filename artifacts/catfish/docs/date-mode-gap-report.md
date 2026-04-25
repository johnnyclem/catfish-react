# Date Mode PRD v0.2.1 — Gap Report

Audit date: 2026-04-25
PRD: `attached_assets/catfish_date_mode_prd_1777155257400.pdf` (965 lines, 9 epics)
Codebase: `artifacts/catfish/` (Expo / React Native) + `artifacts/api-server/` (Express)

The PRD is written for a hypothetical iOS Swift / SpriteKit / SwiftUI client backed
by a Cloudflare Worker proxy + FastAPI Eastworld + Redis. This report re-interprets
each component for the **Expo / React Native + Node-Express** stack we actually ship.
Status tags: ✅ READY / 🟡 PARTIAL / ❌ MISSING.

---

## A. Voice pipeline — ✅ READY (with one minor gap)

| PRD piece (Epic 2) | Stack equivalent | Status | Where |
| --- | --- | --- | --- |
| 2.1 Per-character ElevenLabs voice ids | same | ✅ | `core/voiceProfiles.ts` (5 killers + INNOCENT_POOL + NPC_VOICES for Dev/Morgan) |
| 2.2 Stable line-id manifest | same | ✅ | `assets/audioManifest.ts` — `<characterKey>_<beatKey>_<lineIndex>` |
| 2.3 Pre-gen script (idempotent) | same | ✅ | `scripts/voice-pregen.ts` — skips existing files, cleans orphans, regenerates manifest between markers |
| 2.4 Player wrapper w/ finished event | AVFoundation → `expo-audio` | ✅ | `features/voice/useDialogueVoice.ts` — serial queue, `voiceLineDidFinish`-equivalent |
| 2.5 Bundle audit / CI check | same | 🟡 | Pre-gen script has live-fallback to TTS proxy if a key is missing; no separate CI step that hard-fails on missing scripted line |
| 2.6 On-demand ElevenLabs proxy + cache | Cloudflare Worker → Express route | ✅ | `artifacts/api-server/src/routes/voice.ts` — SHA256 disk cache, rate-limited |
| 2.7 PreloadQueue (preload next ~10 lines) | same | 🟡 | Current player plays-then-fetches lazily; no "next-N preload on scene enter" |

**Date-Mode-specific add (when we get there):** rename id convention from
`<character>_<beatKey>_<idx>` to also encode date scene + variant
(`<character>_date_d2_coffee_intro_01` style); add a second cache namespace under
`Library/Caches` equivalent (`expo-file-system` cacheDirectory) with 7-day TTL for
*Eastworld-generated* lines, separate from bundled scripted lines.

## B. Chat / dialogue engine — 🟡 PARTIAL

| PRD piece | Status | Notes |
| --- | --- | --- |
| Linear `DialogueTurn[]` script per killer | ✅ | `core/identities.ts` — killerScript + INNOCENT_SCRIPT |
| `variants[].condition` pattern (one scene JSON, runtime variant resolution) | ❌ | Today each killer authors a separate script; no shared scene with conditional branches |
| `isKiller` flag accessible at variant-resolution time | ✅ underneath, ❌ surfaced | `CaseRun.killer` is set in `gameStore.buildRun` (line 152); only used today to swap script choice in `getScriptForCandidate` |
| `factReveal` hook on a Beat | ❌ | Captures are still manual long-press; no Beat says "firing this turn = log Fact `f.kai_d4_meeting_slip`" |
| Choice buttons only (no free-form) | ✅ | `ReplyPicker.tsx` already enforces this |
| Affinity / emotion dimension on a thread | ❌ | `MatchRelationship` only carries an `unmatched` boolean |
| Thread-level "leave the date" / cutShort outcome | ❌ | Unmatch is the closest analog |

**Date Mode adds we'll need:**
`Beat` (extends `DialogueTurn`) with `variants: BeatVariant[]`, each variant
carrying `condition` (e.g. `"isKiller"`, `"isInnocent"`, `"always"`),
`expression`, optional `factReveal: FactId`, optional `focusShift: boolean`.
A `DateDirector` that walks beats, resolves variants against `CaseRun.killer`,
fires `commitFact` when a `factReveal` lands.

## C. Asset / portrait pipeline — 🟡 PARTIAL

| PRD piece | Status | Notes |
| --- | --- | --- |
| Per-character expression set | 🟡 | Miles/Kai/Jules/River/Sam have neutral/smile/flirty/curious/uneasy/sinister; Tessa/Ren/Delphine still placeholder A500 |
| 10 NPC decoy portraits (A085–A094) | ✅ | Just shipped — `decoyPool.ts` |
| Date scene backgrounds (cafe, bar, park, restaurant, apartment) | ✅ | A600–A606 already in manifest, currently unused |
| Day/night variants per scene | ✅ | `bg_cafe_day` vs `bg_cafe_night` already exist |
| `_neutral_saintmask` portrait variant per killer (Epic 9.2, "Layer 1") | ❌ | No retouched-portrait slot in the asset id convention yet |
| `catfish_gen.py` automated retouch pipeline (Epic 9.1–9.2) | ❌ | We have no LLM-driven asset gen — portraits are dropped in by hand from `attached_assets/` |

**Date Mode adds:** a new asset id band — e.g. `A1xx_<killer>_neutral_saintmask.png`
— and a switch in `AssetImage` / wherever `Candidate.portrait` is rendered to swap
to the `_saintmask` variant when `candidate.id === run.killer`. Five new portraits
(one per killer-eligible character).

## D. Date scene / cutscene rendering — ❌ MISSING

Nothing exists today that renders a static character sprite over a background scene
with dialogue + choice overlays. `A600–A606` and `A800–A803` (endings) are unused.

| PRD piece | Stack equivalent | Status |
| --- | --- | --- |
| SpriteKit + SwiftUI overlay | `react-native-skia` (or `Image` + `Reanimated` layers) + native View overlay | ❌ |
| Mouth-flap loop (2-frame) per character expression | sequenced `Image` swap on a Reanimated timer | ❌ |
| First-person eye-contact framing for high-tension lines | full-screen portrait swap with vignette | ❌ |
| `clue_discovered_flash` overlay (Epic 6.4) | new component | ❌ |
| Background desaturation cue (Epic 6.3) on Eastworld emotion spike | Skia color-matrix overlay or RN `tintColor` blend | ❌ |
| Brief 3kHz tone (Epic 6.3) | bundled `expo-audio` one-shot | ❌ |

This is the single largest greenfield piece in the PRD.

## E. Backend topology — ✅ READY for current scope

| PRD piece | Today |
| --- | --- |
| Cloudflare Worker proxy, app-only requests, killswitch | Express `artifacts/api-server` with rate-limit middleware. **No request-origin signing or remote killswitch yet** — fine for dev, would want a `FEATURE_VOICE_ENABLED` env flag and a request HMAC before Date Mode goes live. |
| Redis for per-run agent memory | Not present. We have AsyncStorage on-device only. **Pick one before Eastworld lands** — likely Replit's Postgres + a `case_run_memory` table (Redis is overkill for 100 DAU). |
| OpenAI/Anthropic LLM key proxy | Not present. Need a new `/api/agent/*` route group. |
| Secrets handling | `process.env` + Replit Connectors — already correct. |

## F. Eastworld equivalent (LLM agent runtime) — ❌ MISSING

There is no LLM/agent framework in the project today. The PRD assumes self-hosted
Eastworld (FastAPI + Redis). We have three realistic paths for an Expo/RN port:

1. **Skip Eastworld; route directly to OpenAI/Anthropic via Replit AI Integrations.**
   We have `ai-integrations-openai`, `ai-integrations-anthropic`, `ai-integrations-gemini`
   skills available — no API key on device, no extra hosting. Loses Eastworld's
   built-in emotion query, but Epic 6.3 already calls emotion "texture only,
   never clue authority" — so we can fake the emotion query with a second LLM
   call ("how nervous is {agent}?") behind the same flag.
2. **Self-host Eastworld** as the PRD literally says — pin a commit, deploy on
   Replit Reserved-VM or Fly. Highest fidelity, highest ops cost.
3. **Hybrid:** ship path 1 for v1 (Phase A/B/C of the PRD), reserve Eastworld
   for Phase D content scaling if we need its memory primitives.

Recommendation when you greenlight this: **path 1**. Aligns with our
"no extra infra" posture and matches the PRD's actual hard requirements
(in-character ambient texture, never clue authority).

## G. CaseRun / state model — 🟡 PARTIAL (improving via in-flight Task #19)

| PRD piece | Status |
| --- | --- |
| Day system with `advanceDay` action | ✅ in `gameStore.ts` |
| `CaseRun.killer` set deterministically at run start | ✅ in `buildRun` |
| `Fact` model | ✅ in `models.ts` (has `id`, `body`, `kind` discriminator forthcoming) |
| Authored-fact universe with conditional-per-killer payloads | 🟡 **In flight — Task #19 (Clue graph schema) covers exactly this:** `static / variable / conditional` fact layers, `variableOverrides`, `conditionalFactIDs`, `solvingDeduction.requiredFactIDs`, pure `resolveAccusation()` |
| `Deduction.narrativeBeat` for hindsight ending text (Epic 6.5) | ❌ today — ✅ once Task #19 lands |
| Scheduled events (date scheduled for next day) (Epic 7.1) | ❌ |
| `MatchRelationship.affinity` (a number, not just a flag) | ❌ |
| Endings (A800–A803 art exists, no logic) | ❌ — `caughtThem`/`wrongful`/`metKiller`/`escaped` will arrive with Task #19's `resolveAccusation` |

**Bottom line:** Task #19 unblocks ~70% of the schema work the PRD demands.
Once it merges, the remaining state-model gaps for Date Mode are: scheduled
events, affinity, and a `DateOutcome` enum (`completed | cutShort | metKiller`).

## H. Friend NPCs (Dev + Morgan, "corgi cabal" Epic 7.7) — 🟡 PARTIAL

| PRD piece | Status |
| --- | --- |
| Friend portrait assets (A079–A084) | ✅ |
| Friend voice profiles | ✅ in `voiceProfiles.ts` (`NPC_VOICES`) |
| Group chat thread UI | ❌ — `ThreadView` is 1:1 only |
| DDA (dynamic difficulty hint) mechanism that posts tips into friend chat | ❌ |
| Pet-photo-caption-as-clue treatment | ❌ |

## I. Killer identity flag at runtime — ✅ READY

`CaseRun.killer` set on first match (`buildRun`). `Candidate.isKillerCandidate`
flag exposed. Currently only consumed by `getScriptForCandidate` to swap script
trees — Date Mode would consume the same value inside variant-condition resolution
without any new plumbing.

## J. Schemas / typed contracts

**Already exist** (`models.ts` + `identities.ts`):
`Candidate`, `MatchRelationship`, `CaseRun`, `IdentityModule`, `DialogueTurn`,
`Fact`, `FactId`, `VoiceProfile`, `KillerIdentity`.

**Arriving with Task #19:**
`Deduction` (a.k.a. `solvingDeduction`), `ConditionalFact`, `VariableOverrides`,
`AccusationResult`, `CaseEnding`.

**Net-new for Date Mode** (would land in this order):
1. `BeatVariant { condition, expression, factReveal?, focusShift?, voiceLineId }`
2. `Beat { id, variants: BeatVariant[] }` (extends/replaces `DialogueTurn`)
3. `DateScene { id, location, backgroundAssetId, beats: Beat[] }`
4. `VoiceLine { id, characterKey, text, emotion?, bundlePath?, ondemand?: boolean }`
5. `DateOutcome` enum + `ScheduledDate { matchId, location, dueOnDay }`
6. `MatchRelationship.affinity: number`

---

## Re-mapped phasing (PRD Section 8 → our stack)

The PRD's Phase A→E structure still works for us, with these substitutions:

- **Phase A (validation):** Build `BeatVariant` + `DateScene` schemas, hand-author
  one Kai date scene JSON, render it with a thin Reanimated-based scene view
  (no SpriteKit, no Eastworld, no killer tell). Reuse existing `useDialogueVoice`
  for line playback — should "just work" if we extend the manifest id convention.
- **Phase B (LLM integration):** Skip self-hosted Eastworld. Add `/api/agent/*` to
  `api-server` calling OpenAI via Replit AI Integrations. Per-run memory in
  Postgres (not Redis). Implement Saint Mask Layer 3 (`speech_register`) as the
  system-prompt suffix.
- **Phase C (the mechanic):** Killer-tell variants land on top of the Phase A
  beat schema. Saint Mask Layer 1 (`_neutral_saintmask` portrait variant) lands
  via a new asset id band + a swap in `AssetImage`. Layer 2 (caption rewrites)
  needs the social-feed view — which the swipe card already approximates;
  decide whether to graduate to a full feed surface here or wait.
- **Phase D (content):** Same as PRD — author the other 4 killers' date beats,
  build the corgi-cabal group chat UI, polish.
- **Phase E (Day 7 meet):** Same as PRD.

## Hard prerequisites that already gate Date Mode work

Per PRD Section 7:
- ✅ App Mode chat engine (we have it)
- ✅ Date environment art (A600–A606 in manifest, unused)
- 🟡 Character full-body sprites with ≥4 expression variants — we have **half-body
  portraits** with 6 expressions for 5/8 characters; Tessa/Ren/Delphine are
  still placeholder. The PRD's "full-body" assumption may need re-scoping for
  our portrait-style art, or we generate body assets in a separate batch.
- 🟡 Clue graph schema for at least Miles — **in flight, Task #19**, blocks
  Phase C of Date Mode.

## Cross-cutting concerns checklist

- Latency budget — ✅ scripted-line target (<200ms) is met today by
  `useDialogueVoice`'s preloaded queue. Eastworld text-to-voice budget (<2s)
  needs a real measurement once we pick the LLM path.
- Cost budget per CaseRun — PRD targets ~$2.00. With Replit AI Integrations
  pricing and ElevenLabs on-demand, 30 lines × 150 chars + ~50K tokens lands
  in the same ballpark; needs metering once it's wired.
- Persistence — ✅ Zustand+AsyncStorage already survives app force-quit for
  CaseRun; the Eastworld-equivalent memory layer needs a Postgres table
  (`case_run_agent_memory`).
- Observability — ❌ no structured event log today. Easy add: a single
  `dateEvent(type, payload)` helper that writes to `expo-file-system`.

---

## Summary

| Area | Status |
| --- | --- |
| A. Voice pipeline | ✅ READY (preload queue + CI bundle audit are minor adds) |
| B. Chat / dialogue engine | 🟡 needs `BeatVariant` + DateDirector |
| C. Asset / portrait pipeline | 🟡 has range, missing `_neutral_saintmask` slot |
| D. Date scene rendering | ❌ greenfield — biggest single piece |
| E. Backend topology | ✅ ready for next round (add HMAC + killswitch later) |
| F. Eastworld equivalent | ❌ missing — recommend Replit AI Integrations over self-host |
| G. CaseRun / state model | 🟡 → ✅ once Task #19 (Clue graph) merges |
| H. Friend NPCs (corgi cabal) | 🟡 art + voices exist, no UI/group-chat primitive |
| I. Killer identity flag | ✅ READY |
| J. Schemas / typed contracts | 🟡 → mostly resolved by Task #19 + Date-Mode-specific additions |

**One concrete gating recommendation:** let Task #19 land first. ~70% of the
schema work the PRD demands lives in that task; building Date Mode beats on top
of unmerged schema would force rework.
