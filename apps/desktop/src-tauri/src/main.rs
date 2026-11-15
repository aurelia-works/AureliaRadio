#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use radio_core::{Controller, ControllerResponse, FrequencyKind, Phase, PilotRequest};
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::net::UdpSocket;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager, State};

const TELEMETRY_STALE: Duration = Duration::from_secs(2);
const PLUGIN_COMMAND_ADDR: &str = "127.0.0.1:49021";
const SPEECH_MODEL_FILE: &str = "ggml-tiny.en.bin";

#[derive(Debug, Clone, Default, Deserialize)]
struct Telemetry {
    com1: f64,
    standby: f64,
    #[allow(dead_code)]
    lat: f64,
    #[allow(dead_code)]
    lon: f64,
    alt_ft: f64,
    ias: f64,
    hdg: f64,
    xpdr: i32,
}

struct AppState {
    controller: Mutex<Controller>,
    telemetry: Arc<Mutex<Option<Telemetry>>>,
    last_seen: Arc<Mutex<Option<Instant>>>,
    speaker: Mutex<LiveSpeaker>,
}

struct LiveSpeaker {
    child: Option<Child>,
    generation: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    phase: String,
    runway: String,
    callsign: Option<String>,
    connected: bool,
    com1: String,
    standby: String,
    next_hint: String,
    altitude_ft: f64,
    ias: f64,
    heading: f64,
    transponder: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Reply {
    snapshot: Snapshot,
    transmission: String,
    accepted: bool,
    next_frequency: Option<String>,
}

fn phase_id(phase: Phase) -> &'static str {
    match phase {
        Phase::ClearanceDelivery => "clearance",
        Phase::Ground => "ground",
        Phase::Tower => "tower",
        Phase::Departure => "departure",
    }
}

fn frequency(controller: &Controller, kind: FrequencyKind, fallback: &str) -> String {
    controller
        .airport()
        .frequency(kind)
        .map(|value| value.mhz())
        .unwrap_or_else(|| fallback.to_string())
}

fn is_fresh(state: &AppState) -> bool {
    state
        .last_seen
        .lock()
        .ok()
        .and_then(|value| *value)
        .map(|seen| seen.elapsed() < TELEMETRY_STALE)
        .unwrap_or(false)
}

fn live_telemetry(state: &AppState) -> Option<Telemetry> {
    if !is_fresh(state) {
        return None;
    }
    state.telemetry.lock().ok().and_then(|value| value.clone())
}

fn snapshot_of(controller: &Controller, telemetry: Option<&Telemetry>) -> Snapshot {
    let (fallback_com1, fallback_standby, hint) = match controller.phase() {
        Phase::ClearanceDelivery => (
            frequency(controller, FrequencyKind::Clearance, "134.700"),
            frequency(controller, FrequencyKind::Ground, "121.800"),
            "Request clearance, then read it back",
        ),
        Phase::Ground => (
            frequency(controller, FrequencyKind::Ground, "121.800"),
            frequency(controller, FrequencyKind::Tower, "118.450"),
            "Request taxi, then read it back",
        ),
        Phase::Tower => (
            frequency(controller, FrequencyKind::Tower, "118.450"),
            "124.800".to_string(),
            "Request takeoff, then read it back",
        ),
        Phase::Departure => ("124.800".to_string(), "—".to_string(), "Contact departure"),
    };

    let (com1, standby, altitude_ft, ias, heading, transponder) = match telemetry {
        Some(value) => (
            format!("{:.3}", value.com1),
            format!("{:.3}", value.standby),
            value.alt_ft,
            value.ias,
            value.hdg,
            value.xpdr,
        ),
        None => (fallback_com1, fallback_standby, 0.0, 0.0, 0.0, 0),
    };

    Snapshot {
        phase: phase_id(controller.phase()).to_string(),
        runway: controller.runway().to_string(),
        callsign: controller
            .clearance()
            .map(|clearance| clearance.callsign.clone()),
        connected: telemetry.is_some(),
        com1,
        standby,
        next_hint: hint.to_string(),
        altitude_ft,
        ias,
        heading,
        transponder,
    }
}

fn reply(
    controller: &Controller,
    telemetry: Option<&Telemetry>,
    response: ControllerResponse,
) -> Reply {
    Reply {
        snapshot: snapshot_of(controller, telemetry),
        transmission: response.transmission,
        accepted: response.accepted,
        next_frequency: response.next_frequency.map(|frequency| frequency.mhz()),
    }
}

fn send_to_plugin(payload: String) {
    if let Ok(socket) = UdpSocket::bind("127.0.0.1:0") {
        let _ = socket.send_to(payload.as_bytes(), PLUGIN_COMMAND_ADDR);
    }
}

fn spawn_telemetry_listener(
    telemetry: Arc<Mutex<Option<Telemetry>>>,
    last_seen: Arc<Mutex<Option<Instant>>>,
) {
    std::thread::spawn(move || {
        let Ok(socket) = UdpSocket::bind("127.0.0.1:49020") else {
            eprintln!("Aurelia Radio: could not bind telemetry port 49020");
            return;
        };
        let _ = socket.set_read_timeout(Some(Duration::from_millis(500)));
        let mut buffer = [0u8; 2048];
        loop {
            if let Ok((length, _)) = socket.recv_from(&mut buffer) {
                if let Ok(parsed) = serde_json::from_slice::<Telemetry>(&buffer[..length]) {
                    *telemetry.lock().expect("telemetry lock") = Some(parsed);
                    *last_seen.lock().expect("last seen lock") = Some(Instant::now());
                }
            }
        }
    });
}

#[tauri::command]
fn snapshot(state: State<AppState>) -> Snapshot {
    let controller = state.controller.lock().expect("controller lock");
    let telemetry = live_telemetry(state.inner());
    snapshot_of(&controller, telemetry.as_ref())
}

#[tauri::command]
fn request_clearance(state: State<AppState>, callsign: String, destination: String) -> Reply {
    let mut controller = state.controller.lock().expect("controller lock");
    let response = controller.handle(PilotRequest::Clearance {
        callsign,
        destination,
    });
    let telemetry = live_telemetry(state.inner());
    reply(&controller, telemetry.as_ref(), response)
}

#[tauri::command]
fn clearance_readback(state: State<AppState>) -> Option<String> {
    let controller = state.controller.lock().expect("controller lock");
    controller.clearance().map(|clearance| clearance.readback())
}

#[tauri::command]
fn submit_utterance(state: State<AppState>, text: String) -> Reply {
    let mut controller = state.controller.lock().expect("controller lock");
    let response = controller.apply_utterance(&text);
    let telemetry = live_telemetry(state.inner());
    reply(&controller, telemetry.as_ref(), response)
}

#[tauri::command]
fn readback(state: State<AppState>, text: String) -> Reply {
    let mut controller = state.controller.lock().expect("controller lock");
    let response = controller.handle(PilotRequest::Readback(text));
    let telemetry = live_telemetry(state.inner());
    reply(&controller, telemetry.as_ref(), response)
}

#[tauri::command]
fn request_taxi(state: State<AppState>) -> Reply {
    let mut controller = state.controller.lock().expect("controller lock");
    let response = controller.handle(PilotRequest::RequestTaxi);
    let telemetry = live_telemetry(state.inner());
    reply(&controller, telemetry.as_ref(), response)
}

#[tauri::command]
fn request_takeoff(state: State<AppState>) -> Reply {
    let mut controller = state.controller.lock().expect("controller lock");
    let response = controller.handle(PilotRequest::RequestTakeoff);
    let telemetry = live_telemetry(state.inner());
    reply(&controller, telemetry.as_ref(), response)
}

#[tauri::command]
fn request_departure(state: State<AppState>) -> Reply {
    let mut controller = state.controller.lock().expect("controller lock");
    let response = controller.handle(PilotRequest::RequestDeparture);
    let telemetry = live_telemetry(state.inner());
    reply(&controller, telemetry.as_ref(), response)
}

#[tauri::command]
fn set_com1(mhz: f64) {
    send_to_plugin(format!("{{\"cmd\":\"set_com1\",\"mhz\":{mhz:.3}}}"));
}

#[tauri::command]
fn set_standby(mhz: f64) {
    send_to_plugin(format!("{{\"cmd\":\"set_standby\",\"mhz\":{mhz:.3}}}"));
}

#[tauri::command]
fn swap_com1() {
    send_to_plugin("{\"cmd\":\"swap_com1\"}".to_string());
}

#[derive(Serialize)]
struct SpeechModel {
    installed: bool,
}

/// True only when `models/ggml-tiny.en.bin` is a file under the app data directory.
/// Does not create that directory and does not read the file.
fn speech_model_installed(app_data: &Path) -> bool {
    app_data.join("models").join(SPEECH_MODEL_FILE).is_file()
}

#[tauri::command]
fn speech_model(app: tauri::AppHandle) -> SpeechModel {
    let installed = app
        .path()
        .app_data_dir()
        .map(|dir| speech_model_installed(&dir))
        .unwrap_or(false);
    SpeechModel { installed }
}

/// Text worth handing to the system voice. Empty lines are not spoken.
/// The cap keeps one reply from turning into a long monologue.
fn spoken_text(text: &str) -> Option<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.chars().take(2_000).collect())
}

fn stop_speaker(child: &mut Option<Child>) {
    if let Some(mut running) = child.take() {
        let _ = running.kill();
        let _ = running.wait();
    }
}

#[derive(Serialize)]
struct SpeakStarted {
    spoken: bool,
    generation: u64,
}

/// Wait until this generation's `say` process exits, then tell the window.
/// A newer line bumps the generation, and this wait ends without an event.
fn wait_until_quiet(app: tauri::AppHandle, generation: u64) {
    loop {
        std::thread::sleep(Duration::from_millis(40));
        let finished = {
            let state = app.state::<AppState>();
            let mut slot = state.speaker.lock().expect("speaker lock");
            if slot.generation != generation {
                return;
            }
            let done = match slot.child.as_mut() {
                Some(child) => matches!(child.try_wait(), Ok(Some(_))),
                None => true,
            };
            if !done {
                false
            } else {
                slot.child = None;
                true
            }
        };
        if finished {
            let _ = app.emit("speak-done", generation);
            return;
        }
    }
}

/// Speak one controller line with the macOS `say` command.
/// The line is written to stdin so it cannot be read as a flag (`--network-send` included).
/// An empty line stops whatever is still speaking.
/// `spoken` is false when this system did not speak, so the webview can use its own voice.
#[tauri::command]
fn speak_line(app: tauri::AppHandle, text: String, state: State<AppState>) -> SpeakStarted {
    let mut slot = state.speaker.lock().expect("speaker lock");
    slot.generation = slot.generation.wrapping_add(1);
    let generation = slot.generation;
    stop_speaker(&mut slot.child);
    let Some(spoken) = spoken_text(&text) else {
        return SpeakStarted {
            spoken: true,
            generation,
        };
    };
    #[cfg(target_os = "macos")]
    {
        let Ok(mut child) = Command::new("/usr/bin/say")
            .arg("--input-file=-")
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
        else {
            return SpeakStarted {
                spoken: false,
                generation,
            };
        };
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(spoken.as_bytes());
        }
        slot.child = Some(child);
        drop(slot);
        let handle = app.clone();
        std::thread::spawn(move || wait_until_quiet(handle, generation));
        return SpeakStarted {
            spoken: true,
            generation,
        };
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (spoken, app);
        SpeakStarted {
            spoken: false,
            generation,
        }
    }
}

fn main() {
    let telemetry = Arc::new(Mutex::new(None));
    let last_seen = Arc::new(Mutex::new(None));
    spawn_telemetry_listener(Arc::clone(&telemetry), Arc::clone(&last_seen));

    tauri::Builder::default()
        .manage(AppState {
            controller: Mutex::new(Controller::kmco()),
            telemetry,
            last_seen,
            speaker: Mutex::new(LiveSpeaker {
                child: None,
                generation: 0,
            }),
        })
        .invoke_handler(tauri::generate_handler![
            snapshot,
            request_clearance,
            clearance_readback,
            submit_utterance,
            readback,
            request_taxi,
            request_takeoff,
            request_departure,
            set_com1,
            set_standby,
            swap_com1,
            speech_model,
            speak_line
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aurelia Radio");
}

#[cfg(test)]
mod tests {
    use super::{speech_model_installed, spoken_text};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn a_missing_weights_file_is_not_installed() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aurelia-radio-model-{stamp}"));
        assert!(!speech_model_installed(&root));
        assert!(
            !root.exists(),
            "the lookup must not create the app data directory"
        );
        fs::create_dir_all(root.join("models")).expect("models dir");
        assert!(!speech_model_installed(&root));
        let weights = root.join("models").join(super::SPEECH_MODEL_FILE);
        fs::write(&weights, b"not a model").expect("weights");
        assert!(speech_model_installed(&root));
        fs::remove_file(&weights).expect("remove weights");
        fs::create_dir(&weights).expect("weights name as a directory");
        assert!(!speech_model_installed(&root));
        fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn blank_text_is_not_spoken_and_a_line_is_clipped() {
        assert_eq!(spoken_text("  "), None);
        assert_eq!(
            spoken_text("N123AB, say again.").as_deref(),
            Some("N123AB, say again.")
        );
        let long = "a".repeat(2_050);
        assert_eq!(spoken_text(&long).expect("clipped").chars().count(), 2_000);
    }
}
