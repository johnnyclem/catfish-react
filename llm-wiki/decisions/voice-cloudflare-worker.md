---
confidence: 0.9
sources: [README.md, catfish/Cloudflare/]
last-confirmed: 2026-04-26
status: active
---

# ADR-005: Voice Pipeline via Cloudflare Worker

## Decision

On-demand Eastworld TTS generated via a Cloudflare Worker, with pre-generation
for known lines.

## Rationale

- Avoids bundling hundreds of voice clips
- Known lines can be pre-generated at build time for zero-latency playback
- Dynamic Eastworld dialogue needs on-demand generation
- Cloudflare Workers provide low-latency edge compute

## Cost Guardrails

Documented in `Docs/voice_pipeline.md`.

## Status

Locked. Worker deployed, pre-generation scripts working, runtime integration
in progress.
