# Architecture

```
X-Plane 11/12
  ├─ XPLM plugin (C)
  │    reads: position, altitude, heading, IAS, COM, transponder, flight plan
  │    writes: COM standby/active, transponder, AI traffic positions
  │    draws: in-sim radio panel
  │
  └─ UDP loopback (127.0.0.1:49020 telemetry, 49021 commands)
        │
Rust core (radio-core)
  ├─ world model: own ship + traffic + airport + flight plan
  ├─ controller: clearance delivery → ground → tower → departure → center
  ├─ phraseology: ICAO templates
  ├─ readback: deterministic validation
  ├─ timetable: generated traffic
  └─ sequencer: runway slots, spacing, go-arounds (Phase 5)
        │
  ├─ ASR (Phase 1): whisper.cpp / sherpa-onnx
  ├─ TTS (Phase 1): Piper / Kokoro / OS voice + radio FX
  └─ LLM (optional): intent parse + phrasing only
        │
Tauri 2 shell (stdin/stdout JSON lines)
  └─ React UI: settings, models, traffic, logs, replay, diagnostics

In-sim panel (XPLMDisplay): frequency, controller, transcript, readback, TX
```

## Authority and flow

1. The plugin samples X-Plane at 4 Hz and streams telemetry.
2. The core ticks its world model and decides the next controller action.
3. A pilot request enters from voice (Phase 1) or the UI (Phase 0).
4. The core returns a transmission, the next frequency and the new phase.
5. The plugin keys the radio and the app speaks; the panel shows the text.
6. A readback re-enters the core and is validated before the phase advances.

## Safety boundaries

- The plugin never decides. The core never writes datarefs directly.
- The LLM never decides separation or clearance validity.
- Traffic is generated and capped; no unbounded spawn.
- Every write is allowlisted and logged.

## Cross-platform

| Layer | macOS | Windows |
|---|---|---|
| Plugin | x86_64 for XP11 (Rosetta), arm64/x86_64 for XP12 | x64 |
| Core | Rust | Rust |
| Shell | Tauri/WKWebView | Tauri/WebView2 |
| ASR | whisper.cpp / sherpa-onnx / Apple Speech | whisper.cpp / sherpa-onnx |
| TTS | AVSpeech, Piper, Kokoro | SAPI, Piper, Kokoro |

The core and plugin are the portable parts. Voice backends are selected at runtime.
