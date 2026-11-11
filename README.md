# Aurelia Radio

An AI air traffic controller for X-Plane. Local-first, lightweight, ICAO phraseology, starting at Orlando International (KMCO).

**Status: Phase 0.** The deterministic clearance/readback core and the XPLM bridge skeleton exist. The Tauri shell and voice loop are next. Not flyable yet.

## Why this exists

X-Plane's built-in ATC is scripted. VATSIM needs a human controller. SayIntentions and BeyondATC are cloud-first and Windows-only. Aurelia Radio is a local controller that runs beside X-Plane on an 8 GB M1 Air, alongside CruiseControl, without turning the machine into a space heater.

## How you talk to ATC

1. **Tune COM1** to the airport's clearance, ground or tower frequency. You can type it, click it in the panel, or let the app set the standby frequency.
2. **Hold push-to-talk** (a key or joystick button). The panel shows `TX`.
3. **Speak.** Local ASR turns the audio into text; the deterministic controller parses the request.
4. **The controller replies** through local TTS with radio filtering: band-pass, compression, squelch and a click. The same text appears in the in-sim panel.
5. **Read it back.** The readback validator checks callsign, altitude, squawk, runway and "hold short". Wrong or missing items get `negative, say again`.
6. **The next frequency is offered** when you are handed off (`contact ground 121.800`). The app can put it in the standby box; you swap it on the A320 RMP or the 737 tuning panel.

This is a local controller, not the VATSIM network. It uses the same phraseology and radio feel; it does not connect to VATSIM.

## Stack

- **Plugin:** C + XPLM, one universal plugin for X-Plane 11/12. Reads and writes standard COM/transponder/telemetry datarefs, draws the in-sim panel, moves traffic planes.
- **Core:** Rust (`crates/radio-core`). Deterministic world model, clearance objects, phraseology, readback validation, timetable, sequencer. No LLM in any separation or clearance decision.
- **Shell:** Tauri 2 + React. Settings, models, airport data, logs, replay, diagnostics. Inspired by CruiseControl's console.
- **Voice (Phase 1):** whisper.cpp or sherpa-onnx for ASR; Piper/Kokoro or the OS voice for TTS. The 8 GB budget decides which.

## Repository map

```
crates/radio-core/   deterministic ATC core + tests
plugin/              XPLM bridge (C)
apps/desktop/        Tauri shell (Phase 0)
docs/                architecture, rules, roadmap, KMCO data
```

## Build and test

```sh
cargo test
cargo run -p radio-core --example clearance_demo
```

Plugin (X-Plane 11 on this Mac is x86_64 under Rosetta):

```sh
cd plugin/AureliaRadioXPLM
XPLANE_SDK="$HOME/Developer/XPlaneSDK" ./build.sh
```

## Performance budget

On an 8 GB M1 Air with X-Plane and CruiseControl running:

| State | Target |
|---|---|
| Idle (panel hidden) | < 150 MB RSS, < 1% CPU |
| Active (voice + panel) | < 400 MB RSS |
| Traffic | 12–20 aircraft, never unbounded |
| LLM | Off by default; tiny model on demand only |

See `docs/PERFORMANCE_BUDGET.md`.

## Roadmap

Phase 0 bridge and core → Phase 1 voice loop at KMCO → Phase 2 clearance/ground/tower → Phase 3 gate-to-gate IFR → Phase 4 traffic injection → Phase 5 sequencing → Phase 6 co-pilot → Phase 7 Windows/XP11.

See `docs/ROADMAP.md` for the acceptance gates.
