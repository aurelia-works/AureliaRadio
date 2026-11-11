# Roadmap

Each phase has an acceptance gate. A phase is not done because the code compiles; it is done when the gate passes.

## Phase 0 — Bridge and core (current)

Build the plugin skeleton, the KMCO data, the deterministic clearance/readback core and the Tauri shell.

**Gate**
- `cargo test` green.
- Plugin compiles x86_64 against the X-Plane 11 SDK and loads without an error in `Log.txt`.
- Panel shows live COM1, altitude, heading and IAS from X-Plane 11.
- Setting COM1 from the app changes the sim.
- Tauri shell starts and shows the same state.

## Phase 1 — Voice loop at KMCO

Push-to-talk, local ASR, deterministic controller, local TTS, radio FX, in-sim panel.

**Gate**
- 20 scripted calls (clearance, taxi, takeoff, readback) at ≥95% intent accuracy.
- First audio < 1.5 s on the M1 Air with X-Plane running.
- Wrong readback is rejected with the correct "say again".
- Idle RSS < 150 MB; active < 400 MB.

## Phase 2 — Clearance, ground, tower

Taxi graph from `apt.dat`, runway assignment, hold-short, takeoff clearance, handoffs.

**Gate**
- Cold-and-dark IFR departure at KMCO and one second airport.
- Includes a wrong squawk, a missed hold-short and a "say again" recovery.

## Phase 3 — Gate-to-gate IFR

CIFP parsing, route clearance, SID/STAR, center, descent, approach, ILS vectors.

**Gate**
- 10 full flights with no illegal clearance.
- The whole flow works with the LLM disabled (templates only).

## Phase 4 — Traffic injection

Visible ground and airborne AI via `sim/multiplayer/position/planeN_*`.

**Gate**
- 20 aircraft moving without visual glitches.
- Player TCAS sees them.
- No frame-time regression > 1 ms on the M1 Air.

## Phase 5 — Sequencing

Runway slots, runway occupancy, final spacing, go-arounds, ground conflict resolution.

**Gate**
- One hour of traffic with zero incursions.
- Deterministic replay from a seed.

## Phase 6 — Co-pilot

Voice commands for COM, transponder, autopilot, heading, altitude and speed.

**Gate**
- 30 commands with zero unintended state changes.
- Every write is confirmed and reversible.

## Phase 7 — Windows and XP11 hardening

Installer, audio devices, panel, models, crash recovery.

**Gate**
- Clean install on Windows 11 with XP11 and XP12.
- The same scripted suite passes.

## Later

- Live traffic adapters (OpenSky, ADS-B Exchange, FlightAware) behind a user-supplied key.
- VATSIM-style text/voice network integration is out of scope; VATSIM requires human controllers.
- Multiple airports and region packs.
- Custom airline schedules and liveries.
