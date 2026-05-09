# Catfish — Date Mode PRD (DEPRECATED)

> **DEPRECATED** — Superseded by `catfish_date-mode-prd.md` v0.2.1

- **Version:** 0.1 (initial draft)
- **Status:** Pre-implementation — awaiting paper-prototype validation of clue graph
- **Owner:** Johnny Clem
- **Last updated:** April 24, 2026

## 1. Overview

Date Mode is the high-stakes, high-immersion gameplay surface of Catfish.
Where App Mode is the investigation (chat, swipe, journal), Date Mode is the confrontation — the player meets a match in person, hears their voice for the first time, and either gathers the critical clue that breaks the case or walks away unsettled.

Date Mode is where the killer tell most often lands. It is also where the tension between Eastworld-driven ambient dialogue and ElevenLabs-voiced scripted beats becomes visible to the player. The handoff between those two modes — the **Focus Shift** — is the signature interaction of the game.

## 2. Goals & non-goals

### Goals

- **G1.** A single date scene plays end-to-end as a 5–8 minute interactive vignette with branching, voice, and at least one Focus Shift moment.
- **G2.** Every spoken line is voiced via pre-generated ElevenLabs audio, cached on-device, with sub-200ms playback latency from line trigger.
- **G3.** Eastworld provides the texture of the conversation — improvisational small talk, reactions to off-script player input — without ever revealing or inventing clue content.
- **G4.** Killer tells delivered in dates feel earned, not telegraphed. When the player rewatches a recorded run, the tell should be visible in hindsight without having been obvious in real time.
- **G5.** The visual presentation reads as “16-bit JRPG cutscene crossed with FaceTime intimacy.” Static character sprite over scene background, with a first-person framing mode for high-tension moments.

### Non-goals (this version)

- **NG1.** Real-time animated character sprites. Use 2–3 expression states per character + a mouth-flap loop. No skeletal animation.
- **NG2.** Player-typed free-form input. All player turns are choice-driven buttons.
- **NG3.** Multi-character dates.
- **NG4.** Date scene editor / authoring tool UI. Authors edit JSON directly in this version.
- **NG5.** Multiplayer or shared-date functionality.

## 3. Architecture overview

- **iOS Client (Swift)**
  - `DateSceneView` (SpriteKit + UI)
  - `DateDirector` (Eastworld + scripted beat orchestrator)
  - `VoicePlayer` (AVFoundation + bundle cache)
  - `EastworldClient` (HTTP, Redis-cached)
- **Backend (Cloudflare Worker proxy)**
  - Eastworld API (Python + FastAPI + Redis)
  - ElevenLabs key proxy (on-demand voice generation)

> Net-new scope: three client subsystems and one backend service.

## 4. Critical design decisions (locked)

- **Visual format:** Visual novel + first-person hybrid.
- **Voice strategy:** Voice on every line.
- **Eastworld scope:** Included in MVP.
- **Player input:** Choice buttons only.
- **Clue authority:** Scripted-only for clue truth; Eastworld can add personality but never killer status.

## 5. EPIC 8 — Performance, polish, and playtesting

Everything that makes Date Mode feel like a finished feature instead of a prototype.

### Tasks

- **8.1 Memory profile:** Target `< 250MB` RAM during date scene.
- **8.2 Background audio handling:** Pause/resume on interruption.
- **8.3 Accessibility:** VoiceOver labels + captions toggle.
- **8.4 Haptics:** Subtle tap, stronger Focus Shift, distinct tell-discovered feedback.
- **8.5 Skip/fast forward:** Long-press to skip current voice line.
- **8.6 Internal playtesting kit:** Jump to scene/killer, replay last five beats, dump Eastworld log, force-trigger tell.
- **8.7 External playtest:** 3 non-team players; calibrate tell subtlety.

### Acceptance

A non-team player can complete a full Day 7 mystery with 3 scheduled dates without crashes, and in debrief identifies the killer tell with an appropriate “ohhhh” reaction.

## 6. Cross-cutting concerns

### Latency budget

- Scripted voice trigger → playback: **< 200ms**
- Eastworld text response: **< 3s**
- Eastworld response text → voice playback: **< 2s after text return**
- Focus Shift transition: **< 500ms**

### Cost budget per CaseRun

- Eastworld LLM tokens: ~50K across 3 dates × ~15 Eastworld beats × 2 calls/beat (estimate in draft: ~$0.50/run at then-current GPT-4-Turbo pricing assumptions).
- ElevenLabs on-demand voice: ~30 lines × ~150 chars (~4,500 chars; estimate in draft: ~$1.50/run).
- **Total target budget:** ~$2.00/run; cap and gracefully degrade above budget.

### State persistence

- Dates resumable mid-scene.
- Director state writes to SwiftData every beat.
- Eastworld conversation state in Redis keyed by `runID + agentID`.
- Redis TTL: **14 days** from last activity.

### Observability

Each date scene emits structured local logs for:
- scene start/end
- beat advance
- choice selection
- voice trigger
- Eastworld request/response
- tell discovery

Player can opt in to share logs with bug reports.

## 7. Dependencies

### Hard prerequisites

- App Mode chat engine (Pass 2) for invitations.
- Date environment assets complete (coffee shop, restaurant, park, apartment, bar).
- Full-body character sprites with at least 4 expression variants.
- End-to-end clue graph schema for at least one killer (Miles currently paper-ready target).

### Soft dependencies

- ElevenLabs voice cast finalized (Epic 2.1).
- Eastworld hosting selected and deployed (Epic 1.1).

## 8. Phasing recommendation

- **Phase A (validation):** Epic 1 + Epic 2.1–2.4 + one hand-authored DateScene JSON. No killer tell, no Eastworld.
- **Phase B (Eastworld integration):** Epic 5.1–5.3 + Epic 1.5 + Epic 4.3.
- **Phase C (mechanic):** Epic 6 (killer tell).
- **Phase D (content scaling):** Remaining agents/scenes + Epic 8 polish.
- **Phase E (Day 7 meet):** Epic 7.6 as mini-feature.

## 9. Open questions

- Eastworld hosting cost at 100 DAU.
- Voice bundle size vs 200MB cellular download limit.
- Eastworld jailbreak resistance under adversarial player prompts.
- First-person framing intensity and uncanny-valley risk in pixel art.
- Day 7 ambiguity fairness: mysterious vs unfair.

## 10. Explicitly out of scope

- Multi-character dates.
- Free-text player input.
- Player customization affecting date dialogue.
- Real-time Eastworld voice streaming.
- Cross-run agent memory.
- Shareable replays / recordable dates.
