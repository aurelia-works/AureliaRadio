# Performance budget

Machine: MacBook Air (M1, 2020), 8 GB unified memory, 8 cores, 512 GB SSD. X-Plane 11 runs x86_64 under Rosetta. CruiseControl is expected to be open at the same time.

## Why this matters

8 GB shared between macOS, X-Plane, CruiseControl, the Tauri shell, ASR, TTS and any traffic model is tight. A 3 GB local LLM is not an option while flying. The design must be useful without one.

## Targets

| State | RSS | CPU | Notes |
|---|---:|---:|---|
| Shell hidden, X-Plane closed | < 80 MB | ~0% | Process suspended or exited |
| Idle, X-Plane running, panel hidden | < 150 MB | < 1% | Telemetry only, 4 Hz |
| Active, voice + panel | < 400 MB | < 8% burst | ASR + TTS loaded |
| Peak, 20 traffic aircraft | < 550 MB | < 12% | No model load during traffic |

## Rules

- **No always-on LLM.** The deterministic controller handles routine calls. A tiny model (≤ 500 MB quantized) is loaded on demand for unusual phrasing and unloaded after 60 s idle.
- **ASR:** `whisper.cpp` tiny/base int8 or `sherpa-onnx`; the model is memory-mapped and released when the radio is idle.
- **TTS:** prefer the OS voice for idle chatter; load Kokoro/Piper only for the active session.
- **Traffic:** 12–20 aircraft, one shared model, no per-aircraft threads.
- **UI:** Tauri WebView is hidden when not in use; React state is small.
- **Logs:** capped at 5 MB, no audio or transcript by default.
- **No background polling loops faster than 4 Hz** when idle.

## Measurement

Every phase gate records `footprint` (RSS), `%cpu`, and frame-time delta with X-Plane running. A regression of more than 10% blocks the phase.
