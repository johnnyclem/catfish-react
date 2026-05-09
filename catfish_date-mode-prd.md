Catfish — Date Mode PRD
Version: 0.2.1 (final draft for Phase A handoff) Status: Implemented (Phases 7-13) — awaiting Saint Mask (Epic 9) and live agent validation Owner: Johnny Clem Last updated: April 25, 2026
Changelog
v0.2 → v0.2.1:
New Section 4.1: Saint Mask three-layer flavor system (visual + social + writing)
Audio pitch-shift explicitly rejected in Section 4 decisions table
New Epic 9: Saint Mask asset & content production
Epic 5 biography template gains speech_register field
variableOverrides pattern extended to social-post captions
v0.1 → v0.2:
Beat JSON schema rewritten to use the variants[].condition pattern (Epic 4.1)
On-demand voice cache moved to Library/Caches with 7-day TTL (Epic 2.6)
Emotion-query mechanic clarified as texture-only, not clue authority (Epic 6.3)
Tell model locked: cumulative-under-the-hood, binary-in-UI (Section 4)
New Epic 7.7 — corgi-themed friend chat presentation
VBR M4A added to bundle-size mitigation (Epic 8.1)
1. Overview
Date Mode is the high-stakes, high-immersion gameplay surface of Catfish. Where App
Mode is the investigation (chat, swipe, journal), Date Mode is the confrontation — the player
meets a match in person, hears their voice for the first time, and either gathers the critical
clue that breaks the case or walks away unsettled.
Date Mode is where the killer tell most often lands. It is also where the tension between
Eastworld-driven ambient dialogue and ElevenLabs-voiced scripted beats becomes visible
to the player. The handoff between those two modes — what we call the Focus Shift — is
the signature interaction of the game.
The mystery’s core fiction is Whodunnit Among Five: five distinct, appealing matches, any
of whom could be the killer. The player’s job is to look closer at the person they’d never
suspect. Layered on top is the Saint Mask flavor system (Section 4.1) — subliminal cues
that the killer’s visual presentation, social feed, and conversational register all read as just
slightly too composed, rewarding observant players and replays.
2. Goals & non-goals
Goals
G1. A single date scene plays end-to-end as a 5–8 minute interactive vignette with
branching, voice, and at least one Focus Shift moment.
G2. Every spoken line is voiced via pre-generated ElevenLabs audio, cached on-device,
with sub-200ms playback latency from line trigger.
G3. Eastworld provides the texture of the conversation — improvisational small talk,
reactions to off-script player input — without ever revealing or inventing clue content.
G4. Killer tells delivered in dates feel earned, not telegraphed. When the player
rewatches a recorded run, the tell should be visible in hindsight without having been
obvious in real time.
G5. The visual presentation reads as “16-bit JRPG cutscene crossed with FaceTime
intimacy.” Static character sprite over scene background, with a first-person framing
mode for high-tension moments.
G6. The Saint Mask is detectable on a second playthrough without having been obvious
on the first. Players who replay should feel “the game was looking back at me the whole
time.”
Non-goals (this version)
NG1. Real-time animated character sprites. We use 2–3 expression states per character
+ a mouth-flap loop. No skeletal animation.
NG2. Player-typed free-form input. All player turns are choice-driven buttons.
(Eastworld supports free-form, but it widens the safety surface too far for a v1.)
NG3. Multi-character dates. One player, one match, no third parties walking up to the
table.
NG4. Date scene editor / authoring tool UI. Authors edit JSON directly this version.
NG5. Multiplayer or shared-date functionality.
NG6. Audio DSP processing on character voice (pitch-shift, reverb tweaks) to flag the
killer. Saint Mask lives in writing, not signal processing — see Section 4 decisions table.
3. Architecture overview
┌─────────────────────────────────────────────────────────────────┐
│ iOS Client (Swift) │
│ │
│ ┌────────────────────┐ ┌──────────────────────────┐ │
│ │ DateSceneView │ │ DateDirector │ │
│ │ (SpriteKit + UI) │◄───────►│ (Eastworld + scripted │ │
│ │ │ │ beat orchestrator) │ │
│ └────────────────────┘ └────────┬─────────────────┘ │
│ │ │ │
│ ▼ ▼ │
│ ┌────────────────────┐ ┌──────────────────────────┐ │
│ │ VoicePlayer │ │ EastworldClient │ │
│ │ (AVFoundation + │ │ (HTTP, Redis-cached) │ │
│ │ bundle + Caches) │ │ │ │
│ └────────────────────┘ └────────┬─────────────────┘ │
│ │ HTTP │
└──────────────────────────────────────────┼───────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend (Cloudflare Worker proxy) │
│ │
│ ┌──────────────────────┐ ┌─────────────────────────┐ │
│ │ Eastworld API │ │ ElevenLabs key proxy │ │
│ │ (Python, FastAPI) │ │ (on-demand voice gen) │ │
│ │ + Redis │ │ │ │
│ └──────────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
4. Critical design decisions (locked)
| Decision | Choice | Rationale |
|---|---|---|
| Visual format | Visual novel + first-person hybrid | Static sprite over background by default; first-person eye-contact framing for high-tension lines (the killer tell, the meet invitation). |
| Voice strategy | Voice on every line | Player-perceived production value depends on this; scripted lines pre-gen, Eastworld lines use on-demand ElevenLabs. |
| Eastworld scope | Included in MVP | The killer-tell ambiguity literally requires improvisational texture — pure scripted feels too on-rails. |
| Player input | Choice buttons only | Eastworld supports free-text but the safety surface (jailbreaks, anachronism, off-tone responses) is too wide for v1. |
| Clue authority | Scripted-only | Eastworld never owns clue content. State-Gated Context — agents have personality, never killer status. |
| Beat resolution | Conditional scripting via variants[].condition | Same scene structure reused across all 5 killers; the director resolves variants against CaseRun.killerID at runtime. |
| Tell model | Cumulative under the hood, binary in the UI | solvingDeduction.requiredFactIDs is a Set<String> — all required facts must be logged. Journal shows "3 of 5 connections found," never a confidence score. |
| Emotion query role | Texture only, never clue authority | Eastworld emotion outputs flavor the UI (subtle desaturation, audio cue) but never gate fact discovery. |
| Mystery premise | Whodunnit Among Five | Five distinct appealing archetypes; any could be the killer. Player looks closer, not "spots the imposter." |
| Killer flavor | Saint Mask (visual + social + writing) | Three subliminal layers — see Section 4.1. Free upgrade via existing variant-condition system. |
| Killer audio flavor | NO audio DSP | Pitch-shift / reverb on killer voice was rejected. (a) muddies the Focus Shift signal, (b) below conscious threshold = invisible, above threshold = reads as bug, (c) makes Kai-as-killer sound different from Kai-as-innocent across runs, breaking replay consistency, (d) writing-layer Saint Mask achieves the same effect at the right layer. |
4.1 The Saint Mask flavor system
The Saint Mask is the killer’s signature: subliminally too composed across every player-
facing surface. Not a spotlight. Not a giveaway. A texture that compounds across three
layers, none of which is obvious in isolation.
Why three layers (not one): A single subliminal cue isn’t reliably perceptible. Three
independent cues — visual, social, conversational — each below the threshold of conscious
detection, compound into the “something is off about them” instinct that makes the
eventual reveal land as “of course.” Hindsight ROI is the design goal.
Layer 1 — Visual: _neutral_saintmask portrait variant.
A retouched variant of each character’s neutral portrait. Same character, same outfit, same
composition. The deltas:
Symmetry: facial symmetry increased ~10-15%
Gaze: eye highlights slightly more static and reflective
Micro-smile: a 2-pixel lift at the corners of the mouth that doesn’t reach the eyes
(Duchenne smile violation)
Skin: very subtle smoothing, fewer “imperfection” pixels
Used in: swipe card, chat avatar, profile header, all date scene appearances. The player sees
this from first impression, throughout the entire run. They never see the killer’s “real”
_neutral portrait.
Layer 2 — Social: caption-and-metadata override.
The killer’s four social feed posts use the same images as the innocent version, but the
captions and post metadata flip to a “polished marketing account” register:
Surface Innocent register Killer register
Caption
voice
typos, lowercase, abandoned thoughts
(“ate way too much pizza last night lol…
anyway”)
grammatically perfect,
complete sentences, no typos
anywhere
Photo
composition
vibe
candid, slightly off-balance reads as “framed by someone
who knows photography”
Posting
cadence irregular — 11 days, then 3 in one weekend rhythmic, every 4–5 days like
clockwork
Friend
references nicknames, in-jokes, tagged friends
every post is about the
character, no genuine social
embedding
Visible
engagement uneven (3 likes / 80 likes) uniformly mid-range, ~20–30
likes each
Wired through the existing generation. Pure caption rewriting.
variableOverrides pattern. No new schema, no new image
Layer 3 — Writing: speech_register: "polished" for the Eastworld agent.
Each character’s Eastworld agent biography (Epic 5) gains a speech_register field.
Innocent agents use "natural" — filler words, occasional trailing sentences, casual
vocabulary, willingness to ramble. Killer agent uses "polished" — direct answers, no filler,
consistent vocabulary register, never trails off, never says “uh” or “like.”
Both agents speak in the same ElevenLabs voice (no audio processing delta). The difference
is what they say and how they construct it. This is the layer that makes the Focus Shift land
hardest: the killer’s ambient/Eastworld dialogue is too clean, and then the scripted slip
forces them into a clinical-detail lie that doesn’t fit even that unnaturally-clean register.
Cost summary (full Saint Mask system):
5 retouched portrait PNGs (~1 prompt per character through the pipeline you’ve already
built)
20 caption rewrites (5 chars × 4 posts)
5 speech_register: "polished" entries in agent biographies
~30 lines of code: ExpressionState enum entry, asset loader entry, caption resolution in
social feed view
5. Epics
EPIC 1 — Eastworld backend infrastructure
Stand up the Eastworld server, configure the five match agents, and proxy through a
Cloudflare Worker so the iOS client never holds API keys.
Tasks:
1.1 Provision a hosting environment for Eastworld (Fly.io or Railway — both fit the FastAPI
+ Redis topology). Document Dockerfile and deploy.
1.2 Configure the five match agents in the Eastworld dashboard. Each agent gets:
biography (no killer status), core beliefs, dialect notes, topic guardrails (no occupation
contradictions, no breaking the dating-app premise). Author 5 agent configs.
1.3 Author the five “Storyline” prompts that frame each date location (coffee shop
daytime, restaurant night, park, bar, apartment). Storylines contextualize the agent
without leaking plot.
1.4 Build the Cloudflare Worker proxy. Adds rate-limit headers, validates requests are
from the app, holds the OpenAI/Anthropic key for Eastworld’s LLM calls. No keys in
client binary. Killswitch capability so the Eastworld endpoint can be disabled without an
App Store update.
1.5 Set up Redis persistence for agent conversation memory. Per-run TTL (memory
expires when CaseRun ends). Wire runID into the Eastworld conversation context as a
session ID.
1.6 Smoke test: a Postman/curl flow that creates an agent, sends 5 turns of
conversation, queries an emotion, verifies state persists across calls.
1.7 Cost & rate-limit dashboard. Even at MVP, we want to see per-run token spend. Cap
per-session token budget; degrade gracefully on cap hit.
Acceptance: A test client can complete a full 30-turn conversation with the Kai agent,
query “how relaxed is Kai right now” between turns and get sensible answers, without any
backend secrets touching the iOS client.
Risks: Eastworld is at v0.x — expect API changes. Pin to a specific commit hash, don’t track
main.
EPIC 2 — Voice pipeline
Pre-generate scripted voice lines at build time, ship them in the bundle, and stream
Eastworld-generated lines on demand.
Tasks:
2.1 ElevenLabs voice selection. Cast 5 distinct voices (one per match)
2 friend voices + player narrator (if used). Document voice IDs. Voice ID does not
change between innocent and killer runs of the same character — the Saint Mask
lives in writing, not audio.
2.2 Voice line manifest schema. Each scripted line has a stable voiceLineID (e.g.
kai_d2_coffee_intro_01 ), text, target voice, emotion tag, and resolved bundle path.
2.3 Pre-generation script. Reads the manifest, calls ElevenLabs, writes .m4a files into
the bundle. Idempotent — skip lines already generated. Reuse the resumability pattern
from catfish_gen.py.
2.4 VoicePlayer Swift class. Wraps AVAudioPlayer . Handles preload, playback, pause-
on-interruption, mixed-with-others audio session config. Emits voiceLineDidFinish so
the director can advance.
2.5 Bundle audit script. Verifies every voiceLineID corresponding .m4a in the bundle. Run in CI.
referenced in scene JSON has a
2.6 On-demand voice gen for Eastworld lines. Cloudflare Worker endpoint: POST text →
returns audio. Client streams + caches per-session. Cache location:
Library/Caches/EastworldVoice/{lineHash}.m4a — iOS-purgeable under memory
pressure, which is correct: ambient-only, non-canonical for the mystery. TTL: 7 days
from last access. Cap per-line text length (200 chars) and fall back to text-only on cap
hit or network error.
2.7 PreloadQueue. On scene enter, preload the first ~10 voice lines for that scene into
memory. Stream the rest. Day 7 scenes don’t preload on Day 1.
Acceptance: A scripted line plays within 200ms of trigger. An Eastworld-generated line
plays within 2s of generation completing (caching means subsequent identical lines play
instantly).
Risks: ElevenLabs pricing on Eastworld lines. Cap budget per CaseRun and degrade to text-
only if exceeded.
EPIC 3 — DateScene rendering (SpriteKit + SwiftUI overlay)
Render the visual surface — character sprite over background, dialogue UI, choice buttons,
focus-shift transitions.
Tasks:
3.1 DateSceneView (SwiftUI). Hosts an SKView for the visual layer and overlays the
dialogue/choice UI. Owns the lifecycle.
3.2 DateScene (SKScene). Renders background environment + character sprite. Two
modes: .standard (3/4 view, character mid-frame) and .firstPerson (close-up,
character fills 70% of frame).
3.3 Character sprite system. SKSpriteNode with texture atlas of expression states:
neutral , neutral_saintmask, smile , flirty , curious , uneasy , sinister . Mouth-
flap loop driven by VoicePlayer audio amplitude (or simple time-based fallback).
3.4 Background system. Loads the 7 environment assets. Subtle parallax (1 layer is fine
for v1). Day/night tint variants.
3.5 Focus Shift transition. .standard ↔ .firstPerson with a 0.4s zoom + slight CRT-
glitch overlay (reuse fx_glitch_overlay ). Triggered by director on flagged scripted
beats.
3.6 Dialogue box (SwiftUI). Pixel-chrome bubble. Streaming text with per-character
animation synced to voice playback. “Press to advance” affordance after voice finishes.
3.7 Choice button grid (SwiftUI). 2–4 buttons per choice. Each shows player text +
optional emotion icon. Button selection triggers director.
3.8 Visual states for the killer-tell moment. The “uneasy” expression should be subtle —
a darkened upper-face overlay, micro-flicker on entry. The “sinister” expression is
reserved for the reveal cutscene only. The neutral_saintmask is the killer’s baseline
(per Section 4.1) — it’s what the player sees throughout the run, not just at tell moments.
Acceptance: A test scene with one character, one background, and 5 turns of scripted
dialogue plays through cleanly with voiced lines and working choice buttons. Focus Shift
transitions between standard and first-person without visual hitches. Killer-run uses
neutral_saintmask ; innocent-run of same character uses neutral.
Risks: Mouth-flap timing — amplitude-driven is more authentic but fragile. Time-based (“3
mouth states cycled every 100ms”) is uglier but bulletproof. Recommend shipping time-
based, upgrading later.
EPIC 4 — DateDirector (the orchestrator)
The state machine that decides what happens next: scripted line, Eastworld turn, choice,
focus shift, or scene end.
4.1 Beat JSON schema (CONDITIONAL SCRIPTING)
The scene file is the single source of truth for what plays out on a date. Beats use a
variants[].condition pattern so one scene file supports all five possible killers.
{
"sceneID": "kai_date_01_coffee_shop_day",
"partner": "kai",
"environment": "env_coffee_shop_day",
"openingNarration": {
"voiceLineID": "narrator_kai_d1_intro",
"text": "You walk into Cafe Quartz. Kai's already there, sketching."
},
"beats": [
{
"beatID": "kai_coffee_01_greeting",
"type": "scripted",
"actor": "CURRENT_MATCH",
"focusShift": false,
"variants": [
{
"condition": "isKiller == true",
"voiceLineID": "kai_coffee_greeting_warm",
"expression": "neutral_saintmask"
},
{
"condition": "default",
"voiceLineID": "kai_coffee_greeting_warm",
"expression": "smile"
}
]
},
{
"beatID": "kai_coffee_02_smalltalk",
"type": "eastworld",
"actor": "CURRENT_MATCH",
"fallbackVoiceLineID": "kai_coffee_ambient_safe_01"
},
{
"beatID": "kai_coffee_03_player_choice",
"type": "choice",
"choices": [
{ "id": "ask_about_work", "label": "What do you do for work?",
"affinityDelta": 1, "tellEligible": false, "nextBeatID": "kai_coffee_04a" },
{ "id": "ask_where_last_night", "label": "Where were you last night?",
"affinityDelta": -1, "tellEligible": true, "nextBeatID": "kai_coffee_04b" }
]
},
{
"beatID": "kai_coffee_04b_alibi",
"type": "scripted",
"actor": "CURRENT_MATCH",
"focusShift": true,
"variants": [
{
"condition": "isKiller == true",
"voiceLineID": "kai_killer_alibi_shaky",
"expression": "uneasy",
"factReveal": "alibi_contradiction_primary"
},
{
"condition": "isKiller == false",
"voiceLineID": "kai_innocent_alibi_firm",
"expression": "neutral",
"factReveal": null
}
]
}
]
}
Schema rules:
actor resolves dynamically. CURRENT_MATCH = whoever the date is with. PLAYER =
silent protagonist. NARRATOR = third-person framing voice.
variants is evaluated top-down; first matching condition wins. default always
matches if reached.
Conditions reference CaseRun state. v1 supports isKiller , affinity , dayNumber ,
and factDiscovered("factID").
factReveal writes the named Fact ID into the player’s discovered set. Logging to
journal still requires the player commit action in the UI.
focusShift: true duration.
triggers the standard→firstPerson camera transition for that beat’s
tellEligible: true on a choice means: a clue can be revealed by the next beat.
Choices without this flag never trigger emotion-tell UI cues.
- `focusShift: true` triggers the standard→firstPerson camera transition for that beat's duration.
- `tellEligible: true` on a choice means: a clue can be revealed by the next beat. Choices without this flag never trigger emotion-tell UI cues.
- `fallbackVoiceLineID` on Eastworld beats plays if the LLM call fails or exceeds latency budget — keeps the date moving.
- `expression: "neutral_saintmask"` is the killer's baseline expression for non-tell scripted beats — see Section 4.1.
4.2 DateDirector Swift class
State machine stepping through beats. On .scripted → resolve variant against CaseRun ,
play voice line, advance. On .eastworld → query Eastworld for next agent line, gen voice,
play, advance. On .choice → surface buttons, await selection, branch via nextBeatID . On
.factReveal transition.
→ mark Fact as discovered in SwiftData. On .focusShift → tell scene to
4.3 Eastworld turn integration
When director hits an .eastworld beat, send the player’s most recent choice (or a system
“small talk” prompt) to the agent and consume the response. Caps turn count so a date
can’t spiral indefinitely. If the response exceeds latency budget, abort and play
fallbackVoiceLineID.
4.4 Scripted-clue interception (the Focus Shift)
When a player choice has tellEligible: true , the director skips any queued .eastworld
ambient beat and goes straight to the next .scripted beat — this is the Focus Shift signal
to the player. The visual transition (Epic 3.5) reinforces it: ambient turns feel loose, scripted
turns feel in-frame. The player learns this rhythm subconsciously.
4.5 Affinity tracking
Director updates MatchRelationship.affinity based on choice deltas. Affinity gates
whether the partner agrees to a second date or the Day 7 meet.
4.6 Date outcome resolution
At scene end, director writes a DateOutcome affinity delta, was a follow-up scheduled).
row to SwiftData (which clues were revealed,
4.7 Director recoverability
If the scene crashes mid-date, on relaunch we resume at the last completed beat — not
restart the date.
Acceptance: Director can play through a 20-beat date with mixed scripted + Eastworld +
choice beats end-to-end, recover from a forced mid-date crash, and emit a correct
DateOutcome. The same scene file produces a tell-bearing playthrough when the partner is
the killer (with Saint Mask portrait, polished agent register) and a tell-free playthrough when
innocent (with normal portrait, natural agent register).
Risks: Eastworld latency. A 3–5s wait for an LLM response in the middle of a date kills
immersion. Mitigations: prefetch ambient lines during scripted-line playback; show a typing
indicator; fall back to fallbackVoiceLineID if latency exceeds 4s.
EPIC 5 — Eastworld agent authoring
*Write the actual personality, beliefs, and guardrails for the five agents
author the date-scene Storylines.*
Tasks:
5.1 Agent biography template. One Markdown file per character with sections:
backstory, current life situation, dating history, dealbreakers, speech patterns, sense of
humor, things they’d never say, things they always say in certain situations,
speech_register field. Template ships two register variants per character —
"natural" (innocent) and "polished" (killer / Saint Mask layer 3). Critically: zero
killer-status content. State-Gated Context.
5.2 Author Kai. ~500 words of biography, no killer status. Both register variants. Write 10
sample Q&A pairs per register to validate voice.
5.3 Author River. Same.
5.4 Author Miles. Same.
5.5 Author Sam. Same.
5.6 Author Jules. Same.
5.7 Topic guardrails per agent. Things that should always trigger a topic-block (asking
for real-world contact info, requests for explicit content, attempts to break the dating-
app premise, attempts to make the agent confess to anything).
5.8 Storyline prompts per scene. Coffee shop, restaurant, park, bar, apartment — each
gets a 100-word “what’s happening in this scene” frame.
5.9 Validation pass. For each agent, run 20 scripted player turns
20 ad-hoc turns and human-review the responses for consistency and on-character
quality. Run both register variants. Tune biographies based on findings.
Acceptance: Five agents produce in-character responses across 50 turn samples each per
register, with no off-character drift, no leaked plot information, and no guardrail violations.
The polished register reads as detectably-but-subliminally cleaner than the natural
register — players in playtest can describe the difference but can’t articulate exactly why on
first exposure.
Risks: This is real writing work, not coding. Time-budget at least a full week per character
including the validation pass. The polished register variant adds ~30% to per-character
authoring time.
EPIC 6 — Killer Tell mechanic (Date-mode specific)
The most delicate epic. How the date surfaces the moment that breaks the case.
Tasks:
6.1 Tell categorization. Three types of tells delivered in dates: (a) verbal slip — agent
says something that contradicts a known fact via a variant.condition: isKiller ==
true scripted beat, (b) visual tell — sprite shows uneasy expression at a specific beat
via variant.expression: uneasy (the crack in the Saint Mask), (c) emotion-flavored
tell — the texture cue described in 6.3 below.
6.2 Per-killer date Beat authoring. For each of the 5 possible killers, write 2–3 in-date
tell Beats. All authored as variants[] blocks in the shared scene JSON, gated on
isKiller == true . The same scene reused across all 5 killers. Wire factReveal IDs
into each killer’s solvingDeduction.requiredFactIDs.
6.3 Emotion-query tell as TEXTURE ONLY (not clue authority).
Eastworld emotion queries don’t gate fact discovery — the scripted variant resolution
already decided whether a tell is happening. What the emotion query does is flavor the
moment: when a tellEligible player choice fires and the partner is the killer and the
next beat has focusShift: true , the director can additionally:
Send Eastworld an emotion query (“how nervous is {agent}?”)
If the query returns elevated values, fire a subtle UI cue: audio-side, a brief high-
frequency tone (~3kHz, -20dB, 200ms); visual-side, momentary background
desaturation (~30%, 150ms).
If the query is unavailable or returns baseline, the scripted tell still lands — the player
just doesn’t get the extra texture cue.
Why not statistical baselines: Eastworld’s emotion outputs aren’t gaussian and a 3-
sample baseline doesn’t converge meaningfully across a 5-minute date. Clue authority
is scripted, so “false positive” emotion responses on innocent partners can’t reveal a
fake tell because no variant.condition: isKiller == false ever has a non-null
factReveal . The risk is solved at the schema level, not via statistics.
6.4 Tell-discovery feedback. When a tell lands, fire clue_discovered_flash overlay
subtly (less prominent than chat-discovered clues — this should feel internal, not
announced). The Epic 6.3 audio/desaturation cue is separate and additive.
6.5 Replay / hindsight pass. Write the post-game beat description for each tell so on a
wrong-accusation ending, the player can see “here’s what you missed.” Reuses the
existing Deduction.narrativeBeat field.
Acceptance: For all 5 killer scenarios, a player can complete the killer’s date and the in-
date tell is logged as a Fact with a discoverable narrative beat. Innocent versions of the
same date do not produce a tell on that fact. The emotion-flavor cue fires only when the
scripted tell is also firing (never on innocent partners).
Risks: Subtlety calibration. Playtest with non-mystery-savvy players — mystery designers
always make their own tells too obvious or too obscure.
EPIC 7 — Date entry & exit flows
How dates start (chat invitation, accept/decline) and how they end (return to App mode
with state changes visible).
Tasks:
7.1 Date invitation Beat type for chat engine. A scripted chat message can offer a date
(location, time-of-day). Player accepts/declines via inline choice buttons. Accept →
schedules date for next day-advance.
7.2 “Date scheduled” Match state UI. Match list shows calendar icon + countdown.
Clicking enters a “preparing for date” preamble.
7.3 Date scene loader. On day-advance, if a scheduled date is due, RootView routes into
DateSceneView before returning to the Swipe/Match tabs.
7.4 Post-date return flow. After scene end, return to App mode with:
new chat messages from the partner (scripted follow-up)
new Facts in journal (discovered during date)
updated affinity reflected in chat options going forward
7.5 Skip/cancel handling. Player can tap “leave the date” any time. Records outcome. Affinity drops sharply.
.cutShort
7.6 Day 7 meet flow. Special variant. Killer’s invitation is the meet-in-person scene that
ends the run if accepted ( metKiller ending).
7.7 Friends chat presentation — the Corgi vibe. The friend NPC chat thread (Dev +
Morgan) is themed as a corgi-fan group chat. UI treatments:
Group chat name: “ corgi cabal”
Friend avatars frame their portraits with a small corgi sticker overlay
Friend tip messages are sometimes delivered as faux pet-photo captions (“look what
mochi did today” + a clue hidden in the description)
Reuses the existing friend_* portrait assets — no new character sprites needed
Tonal anchor: keeps Catfish from drifting too grim-dark, lands the “tongue-in-cheek
but cares about you” voice the friends need to have for the DDA hint mechanic to
feel natural
Acceptance: From swipe → match → chat → date invitation → date scene → post-date chat
works end-to-end as a single user flow. State persists through app backgrounding. Friend
chat reads as a real group thread that happens to have actual intel buried in the corgi pics.
Risks: The Day 7 meet has unique stakes — needs its own visual treatment that signals “this
is different” without spoiling the outcome.
EPIC 8 — Performance, polish, and playtesting
Everything that makes Date Mode feel like a finished feature instead of a prototype.
Tasks:
8.1 Memory + bundle profile.
Target: < 250MB RAM during a date scene.
Bundle audio: encode all scripted M4A as VBR (Variable Bit Rate) rather than CBR
— material gain in compression at equal perceived quality. Stay above 64kbps
minimum for voice.
If 200MB cellular limit pressure persists after VBR pass: consider on-demand
background download for Day 4-7 voice lines (lazy fetch from the Cloudflare Worker
on Day N-1 advancement).
Do not lower sample rate to compress. Voice quality is the brand.
8.2 Background audio handling. Pause voice on interruption (call, Siri, route change).
Resume on return.
8.3 Accessibility. VoiceOver labels on all choice buttons. Captions toggle for spoken
lines (especially needed if Eastworld latency spikes).
8.4 Haptics. Subtle haptic on choice tap, stronger on Focus Shift, distinct on tell-
discovered.
8.5 Skip line / fast forward affordance. Long-press to skip current voice line. Useful for
replays.
8.6 Internal playtesting kit. Debug menu to: jump to any scene with any killer active,
replay last 5 director beats, dump Eastworld conversation log, force-trigger any tell,
toggle Saint Mask preview side-by-side with neutral.
8.7 First external playtest with 3 non-team players. Specifically test whether the killer
tell is too subtle or too obvious and whether the Saint Mask layers register subliminally.
Iterate.
Acceptance: A non-team player can complete a full Day 7 mystery with 3 scheduled dates
without crashes, and on a debrief identifies the killer tell with appropriate level of “ohhhh”
reaction. On a second playthrough, the Saint Mask reads as visible-in-hindsight without
having been a giveaway in playthrough 1.
EPIC 9 — Saint Mask asset & content production
The three-layer flavor system from Section 4.1, broken out as its own epic so it can be
tracked independently and shipped before Phase D content scaling.
Tasks:
9.1 Visual layer: retouch prompt spec for _neutral_saintmask . Document the
symmetry/gaze/micro-smile/skin-smoothing modifiers as a reusable prompt suffix. Add
to the asset gen pipeline as a new named batch (Batch 14).
9.2 Visual layer: generate the 5 portraits via the existing catfish_gen.py pipeline, using
each character’s approved _neutral as the reference image plus the retouch prompt
suffix. Hand-curate for “subliminally too composed” feel. Iterate.
9.3 Visual layer: Add ExpressionState.neutralSaintmask to the SpriteKit sprite system (Epic 3.3) and the SwiftData asset loader.
9.4 Social layer: caption-rewrite prompt spec. Document the “polished marketing
account” voice guidelines (no typos, complete sentences, no in-jokes, mid-range
engagement, rhythmic cadence) as a writer brief.
9.5 Social layer: write 20 killer-variant captions (5 chars × 4 posts) using the brief from
9.4. Each one paired with the existing innocent caption for diff review.
9.6 Social layer: extend variableOverrides in each KillerImplementations.swift file
with the killer-variant captions. Verify the social feed view resolves the override at
render time.
9.7 Writing layer: extend the Epic 5.1 biography template with a `speech_register` field. Document the natural vs polished voice guidelines (filler words, sentence completion, vocabulary register, trail-off frequency).
9.8 Writing layer: for each character, author both register variants in the agent biography
(this overlaps with Epic 5.2-5.6, scope as +30% time per character).
9.9 Validation: playtest the three layers in isolation and combined. Specifically: does the
portrait-only delta register? The caption-only delta? Combined? Hindsight test: replay a
known-killer run after the reveal and confirm the layers feel “obvious now” without
having been obvious before.
Acceptance: All three Saint Mask layers ship as a unified flavor system. On a first
playthrough, players cannot reliably identify the killer just from the Saint Mask cues (the
mystery is still mystery). On a second playthrough or post-reveal, the cues are visible-in-
hindsight across all three layers.
Risks:
Over-tuning the visual. If _neutral_saintmask slides into “obviously creepy,” the
mystery breaks for any visually attentive player. Better to err undertuned and rely on the
layer-stacking effect.
Caption voice consistency. The polished caption register has to read as the killer’s
voice, not as “the writer’s voice for all killers.” Each character’s polished register should
still feel character-specific.
6. Cross-cutting concerns
Latency budget
Source Target Failure mode
Scripted voice line trigger →
playback
< 200ms Playback drift, breaks lipsync
illusion
Eastworld text response < 3s Player perceives “stalling,” tap-
out risk
Eastworld response → voice
playback
< 2s after text
returned Adds to perceived latency
Focus Shift transition < 500ms Visual jank, breaks tension
Cost budget per CaseRun
Eastworld LLM tokens: ~50K tokens estimated across 3 dates × ~15 Eastworld beats × 2
model calls per beat. At GPT-4-Turbo prices: ~$0.50/run.
ElevenLabs on-demand voice: ~30 lines × ~150 chars = 4500 chars. At ElevenLabs pro
rates: ~$1.50/run.
Total budget per CaseRun: ~$2.00. Cap and gracefully degrade beyond it.
State persistence
Dates are resumable mid-scene. Director state pushes to SwiftData every beat.
Eastworld conversation state lives in Redis, keyed on runID + agentID . Survives app
force-quit. TTL = 14 days from last activity.
On-demand voice cache: Library/Caches/EastworldVoice/{lineHash}.m4a , iOS-
purgeable, 7-day TTL from last access. Loss is recoverable — ambient lines only.
Observability
Every date scene emits a structured event log to local file: scene start, beat advance,
choice selection, voice trigger, Eastworld request/response, tell discovery, scene end.
Player can opt-in to share this log on bug report.
7. Dependencies
Hard prerequisites (block start of Date Mode work)
App Mode chat engine (Pass 2 of game engine) — date invitations live in chat threads.
Asset gen complete for date environments — coffee shop, restaurant, park,
apartment, bar (Batch 12 in the asset gen pipeline).
Character full-body sprites with at least 4 expression variants (Batches 4-8).
Clue graph schema authored end-to-end for at least one killer (Miles is fleshed out;
needs to be playable on paper before code).
Soft dependencies (parallelizable but ideally done first)
ElevenLabs voice cast finalized (Epic 2.1).
Eastworld hosting environment chosen and deployed (Epic 1.1).
Saint Mask portrait variants generated (Epic 9.2) — needed before any UI surface
displays a killer character.
8. Phasing recommendation
Don’t build all 9 epics in parallel. Suggested order:
Phase A (validation): Epic 1 + Epic 2.1-2.4 + a single hand-authored DateScene JSON. Get
one date working with one character end-to-end, no killer tell, no Eastworld — just to prove
the visual + voice + director plumbing.
Phase B (Eastworld integration): Epic 5.1-5.3 (author Kai) + Epic 1.5 (Redis persistence) +
Epic 4.3 (Eastworld turn integration). Validate that agent dialogue feels right, latency is
acceptable, costs are bounded. Includes shipping Kai’s polished agent register variant for
Saint Mask layer 3 testing.
Phase C (the mechanic): Epic 6 (killer tell) + Epic 9.1-9.3 (Saint Mask visual layer). This is
when the system goes from “interactive cutscene” to “mystery game.” Don’t write more
content until the mechanic works.
Phase D (content scaling): Author the remaining 4 agents (Epic 5), write the rest of the
date scenes, complete Saint Mask layers (Epic 9.4-9.9), polish (Epic 8).
Phase E (Day 7 meet): Epic 7.6. Treat this as its own mini-feature.
9. Open questions
1. 2. 3. 4. Eastworld hosting cost at scale. Free tier won’t fit a beta launch. Need a real estimate
of monthly run cost at 100 DAU.
Voice line bundle size. 5 characters × ~50 scripted lines × ~150KB per .m4a = ~37MB
just for date scripts. Plus chat scripts. Plus app intro lines. VBR pass should help. If still
over 200MB cellular limit, the on-demand background download path in Epic 8.1 is the
fallback.
Eastworld jailbreak resistance. Needs adversarial playtesting. Players will try to make
Sam confess to murder mid-date for laughs. The agent should refuse plausibly without
breaking character.
First-person framing intensity. Does the eye-contact close-up cross into uncanny
valley with pixel art? Test before committing to the dual framing system.
5. Day 7 meet — does the player know it’s the killer? Currently spec’d as ambiguous-
until-too-late. Validate with playtesters whether that feels mysterious or unfair.
6. Saint Mask undertune calibration. Where exactly is the line between “subliminally off”
and “obviously creepy”? Needs side-by-side playtest of each layer in isolation before
the combined system locks.
10. Out of scope (explicitly)
Multi-character dates (one agent at a time).
Free-text player input (choice-driven only).
Player customization affecting date dialogue (player is silent protag).
Real-time Eastworld voice (text → on-demand voice gen is the path).
Cross-run agent memory (Sam doesn’t remember last week’s run).
Player-recordable dates / shareable replays (post-launch maybe).
Audio DSP processing on character voice to flag the killer (rejected; Saint Mask achieves
the same effect at the writing layer).
Tether NPC / control-group character (the Whodunnit Among Five premise doesn’t need
it; the friends already serve the tonal anchor role).