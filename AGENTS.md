# Aurelia Radio — engineering rules

These are durable rules, not suggestions. If a change violates one, stop and change the design.

## 1. One authority

- The Rust core owns the world model, the clearance state and the traffic sequence.
- The plugin only reads and writes X-Plane datarefs/commands. It never decides.
- The Tauri UI renders. It never invents state.
- The LLM never owns separation, runway assignment, clearance validity or readback acceptance.

## 2. Deterministic first

- Every routine exchange must work with the LLM disabled.
- Given the same input and seed, the core produces the same output.
- No wall-clock time inside the core; pass time in.

## 3. Bounded writes

- Only write datarefs that are explicitly allowlisted in `plugin/README.md`.
- Never write outside the X-Plane installation or the app's Application Support folder.
- Every write is reversible or confirmed. COM/transponder changes are shown before they are applied.

## 4. Voice is local by default

- Audio never leaves the machine unless the user explicitly enables a cloud voice.
- Recordings are deleted at the end of a session unless the user opts into debug retention.
- No transcript or audio in logs by default.

## 5. 8 GB is a hard constraint

- No always-on LLM.
- No model larger than 500 MB loaded during flight.
- Traffic capped at 20 aircraft.
- The UI hides/suspends when X-Plane is not running.
- Any feature that breaks the performance budget is cut, not tuned.

## 6. Phraseology is ICAO

- Use ICAO phraseology, not FAA shortcuts, unless an airport pack says otherwise.
- Callsigns, levels, headings, squawks and frequencies are read back.
- "Unable" and "say again" are first-class outcomes.

## 7. Tests before flight

- `cargo test` must pass before any plugin install.
- Every new controller transition needs a test with a correct and an incorrect readback.
- A simulator run is evidence, not a substitute for a unit test.

## 8. One aircraft, one airport at a time

- Do not add aircraft-specific hacks. Standard X-Plane datarefs only.
- KMCO is the first airport. Add a second only when KMCO's full flow passes.
