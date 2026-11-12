# Aurelia Radio — phase plan

Written 2026-11-11. Status: **P0.5 is in review. P1a is part done.**

One phase per thread. Each phase ends with its "done when" check, a `HANDOFF-<date>-PHASE-<n>.md`, and a stop. Times are agent time. Token figures are rough ranges, sized from the current code (about 1,500 lines for all of Phase 0) and how much new code and test iteration each phase needs.

| Phase | Name | Est. agent time | Est. tokens | Actual | Model | Status |
|---|---|---|---|---|---|---|
| P0.5 | Brand and polish | 40–60 min | 200–350k | not measured | Sonnet 5.5, medium | in review |
| P1a | Voice in | 60–90 min | 350–550k | not measured | Sonnet 5.5, medium | part done |
| P1b | Voice out | 45–75 min | 250–450k | | Sonnet 5.5, medium | not started |
| P2a | Taxi graph | 60–90 min | 350–550k | | Opus 5.5, medium | not started |
| P2b | Ground and tower flow | 45–75 min | 300–450k | | Sonnet 5.5, medium | not started |
| P3a | CIFP and route clearance | 60–90 min | 400–600k | | Opus 5.5, medium | not started |
| P3b | Airborne controllers | 75–120 min | 500–800k | | Opus 5.5, high | not started |
| P4 | Traffic injection | 60–90 min | 350–550k | | Sonnet 5.5, medium | not started |
| P5 | Sequencing | 75–120 min | 500–800k | | Opus 5.5, high | not started |
| P6 | Co-pilot | 45–75 min | 300–450k | | Sonnet 5.5, medium | not started |
| P7 | Windows and XP12 | 60–90 min | 350–550k | | Sonnet 5.5, medium | not started |
| | **Total (11 threads)** | **about 10–16 h** | **3.9–6.1M** | | | |

Sonnet is the default because most phases are well-specified plumbing with tests. Opus is used where a wrong design is expensive to undo: the taxi graph, the CIFP parser, the airborne state machine and the sequencer.

## Open points

- **Phase 0 gate is not confirmed in the sim.** "Plugin loads without an error in Log.txt" and "setting COM1 from the app changes the sim" need Jah in X-Plane. Agents never launch X-Plane.
- **Second airport.** The roadmap's Phase 2 gate asks for one; AGENTS.md rule 8 says KMCO's full flow must pass first. This plan moves the second airport to the end of P3b. ROADMAP.md gets updated to match in P0.5 if approved.
- **Windows.** P7 builds and runs the scripted suite on a GitHub Windows runner. "Clean install on Windows 11 with XP11 and XP12" needs a real PC.
- **Every gate has a flown part.** Each phase ends with scripted tests run by the agent, then a short fly-list for Jah.

## Phases

### P0.5 — Brand and polish
Goal: the app looks finished and carries none of the old logos.
- Chosen mark as `apps/desktop/branding/{logo,icon}.svg`, full Tauri icon set (icns, ico, PNG sizes), in-app mark replacing the "AR" tile. The old `icon.png` (the Aurelia Voice microphone) is deleted.
- `src/design/tokens.css` in the shape of CruiseControl's (`desktop/src/design/tokens.css`), with Radio's own accent. `App.tsx` split into components (sidebar, radio stack, strip header, transcript, composer) the way CruiseControl splits `ui/` and `pages/`.
- Dev panel: accent colour, density, transcript font size, radio-stack toggle.
- Done when: screenshots at 1280/1440/1920 score 9/10 or better (`ui-critique`, `nine-judge`); `grep` finds no old icon; `cargo test` and `npm run build` green.
- Needs: logo and accent choice.

### P1a — Voice in
Goal: hold a key, speak, and the core gets the right request.
- Push-to-talk (global key, later joystick), mic capture, local ASR (whisper.cpp `tiny.en`/`base.en` or sherpa-onnx; the 8 GB budget decides), ATC-vocabulary intent parser in `radio-core` (callsigns, numbers, phonetics).
- 20 recorded WAV fixtures run through ASR and parser in a test.
- Done when: the 20 scripted calls score ≥95% intent accuracy in `cargo test`; idle RSS < 150 MB measured.
- Needs: P0.5 (PTT button and transcript components).
- Part done: `parse_intent` classifies the 20 scripted lines, including ICAO phonetics. The typed box calls `submit_utterance`, which uses that parser. Microphone capture, the ASR model and the idle RSS measurement are still open.

### P1b — Voice out
Goal: the controller answers out loud and sounds like a radio.
- TTS (OS voice first, Piper/Kokoro if it fits the budget), radio FX chain (band-pass, compression, squelch, click), in-sim panel text in the plugin.
- Done when: first audio < 1.5 s and active RSS < 400 MB measured on the M1 Air; a wrong readback gets the correct spoken "say again"; Jah hears a clearance exchange.
- Needs: P1a.

### P2a — Taxi graph
Goal: real taxi routes instead of the hardcoded "via A".
- `apt.dat` parser (taxi network, runways, gates), shortest-path routing with hold-short points, runway assignment from wind.
- Done when: tests route from 5 KMCO gates to each runway and match the charted taxiway names; routing is deterministic.
- Needs: nothing from voice; can run on text.

### P2b — Ground and tower flow
Goal: cold-and-dark to airborne at KMCO with mistakes handled.
- Controller transitions for pushback, taxi, hold-short, line-up, takeoff, handoff; each with a correct and an incorrect readback test (AGENTS.md rule 7).
- Done when: a scripted departure passes including a wrong squawk, a missed hold-short and a "say again" recovery; Jah flies it once.
- Needs: P2a, P1b.

### P3a — CIFP and route clearance
Goal: clearances use the real SID and departure frequency.
- CIFP parser (SIDs, STARs, approaches), `atc.dat` frequencies (replaces the 124.800 placeholder), route validation.
- Done when: clearances for 5 KMCO routes name the right SID and transition, checked against the CIFP file in tests.
- Needs: P2b.

### P3b — Airborne controllers
Goal: gate-to-gate IFR.
- Departure, centre, descent, approach, ILS vectors, arrival tower and ground. Then the second airport.
- Done when: 10 scripted full flights produce no illegal clearance with the LLM disabled; Jah flies one.
- Needs: P3a. Likely to split into two threads; if so it is marked "part done".

### P4 — Traffic injection
Goal: other aircraft are visible and on TCAS.
- Seeded traffic generator from the timetable, plugin writes to `sim/multiplayer/position/planeN_*` (allowlist updated in `plugin/README.md`), cap of 20.
- Done when: a seeded run places 20 aircraft deterministically in tests; Jah confirms no glitches and frame-time delta ≤ 1 ms.
- Needs: P2a (ground paths), P3a (airborne paths).

### P5 — Sequencing
Goal: traffic and the player share runways safely.
- Runway slots and occupancy, final spacing, go-arounds, ground conflict resolution.
- Done when: a simulated hour replays from a seed with zero incursions, twice, with identical output.
- Needs: P4.

### P6 — Co-pilot
Goal: voice commands for the aircraft.
- COM, transponder, autopilot, heading, altitude, speed; each write shown first, confirmed and reversible (AGENTS.md rule 3).
- Done when: 30 scripted commands cause zero unintended writes in tests; Jah tries five.
- Needs: P1a, P1b.

### P7 — Windows and XP12
Goal: installs and runs outside this Mac.
- Windows and arm64/XP12 plugin builds, installer, audio device selection, crash recovery, CI matrix.
- Done when: the scripted suite passes on a GitHub Windows runner; a clean Windows 11 install is confirmed by a person.
- Needs: everything before it.
