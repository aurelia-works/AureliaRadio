# Decisions

## ADR-001 — Rust core, Tauri shell, C plugin

**Status:** accepted.

The core is Rust so macOS and Windows share one deterministic engine. Tauri keeps the shell light (no Electron). The plugin is C because XPLM is C and the same source can build for XP11 and XP12.

## ADR-002 — Deterministic rules own the flight; the LLM owns language

**Status:** accepted.

The controller state machine, clearance objects, separation and readback validation are deterministic. An optional local LLM parses unusual pilot intent and varies phrasing. If it is unavailable, templates still work. This is the only way to make a local controller predictable on 8 GB.

## ADR-003 — Generated timetable first

**Status:** accepted.

Phase 4 traffic comes from a seeded generator (airline, type, destination, runway, time). No live API is required. A live adapter (OpenSky, ADS-B Exchange, FlightAware) can be added behind a user key later. This avoids rate limits and licensing before the core works.

## ADR-004 — 8 GB is a design constraint

**Status:** accepted.

No always-on LLM. ASR/TTS are loaded on demand. Traffic is capped. The shell hides when idle. Features that break the budget are cut.

## ADR-005 — XP11 x86_64 first on this Mac

**Status:** accepted.

X-Plane 11 on the M1 Air is x86_64 under Rosetta, so the first plugin build is `x86_64`. XP12/arm64 is a separate build target and a Phase 7 gate. The source stays version-neutral.

## ADR-006 — ICAO phraseology

**Status:** accepted.

The first airport is in the US, but the owner chose ICAO. Templates use ICAO order and wording. An FAA pack can be added later.
