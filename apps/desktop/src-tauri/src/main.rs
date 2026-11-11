#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use radio_core::{Controller, ControllerResponse, FrequencyKind, Phase, PilotRequest};
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

struct AppState {
    controller: Mutex<Controller>,
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
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Reply {
    snapshot: Snapshot,
    transmission: String,
    accepted: bool,
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

fn snapshot_of(controller: &Controller) -> Snapshot {
    let (com1, standby, hint) = match controller.phase() {
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
        Phase::Departure => (
            "124.800".to_string(),
            "—".to_string(),
            "Contact departure",
        ),
    };

    Snapshot {
        phase: phase_id(controller.phase()).to_string(),
        runway: controller.runway().to_string(),
        callsign: controller.clearance().map(|clearance| clearance.callsign.clone()),
        connected: false,
        com1,
        standby,
        next_hint: hint.to_string(),
    }
}

fn reply(controller: &Controller, response: ControllerResponse) -> Reply {
    Reply {
        snapshot: snapshot_of(controller),
        transmission: response.transmission,
        accepted: response.accepted,
    }
}

#[tauri::command]
fn snapshot(state: State<AppState>) -> Snapshot {
    let controller = state.controller.lock().expect("controller lock");
    snapshot_of(&controller)
}

#[tauri::command]
fn request_clearance(state: State<AppState>, callsign: String, destination: String) -> Reply {
    let mut controller = state.controller.lock().expect("controller lock");
    let response = controller.handle(PilotRequest::Clearance { callsign, destination });
    reply(&controller, response)
}

#[tauri::command]
fn clearance_readback(state: State<AppState>) -> Option<String> {
    let controller = state.controller.lock().expect("controller lock");
    controller.clearance().map(|clearance| clearance.readback())
}

#[tauri::command]
fn readback(state: State<AppState>, text: String) -> Reply {
    let mut controller = state.controller.lock().expect("controller lock");
    let response = controller.handle(PilotRequest::Readback(text));
    reply(&controller, response)
}

#[tauri::command]
fn request_taxi(state: State<AppState>) -> Reply {
    let mut controller = state.controller.lock().expect("controller lock");
    let response = controller.handle(PilotRequest::RequestTaxi);
    reply(&controller, response)
}

#[tauri::command]
fn request_takeoff(state: State<AppState>) -> Reply {
    let mut controller = state.controller.lock().expect("controller lock");
    let response = controller.handle(PilotRequest::RequestTakeoff);
    reply(&controller, response)
}

#[tauri::command]
fn request_departure(state: State<AppState>) -> Reply {
    let mut controller = state.controller.lock().expect("controller lock");
    let response = controller.handle(PilotRequest::RequestDeparture);
    reply(&controller, response)
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            controller: Mutex::new(Controller::kmco()),
        })
        .invoke_handler(tauri::generate_handler![
            snapshot,
            request_clearance,
            clearance_readback,
            readback,
            request_taxi,
            request_takeoff,
            request_departure
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aurelia Radio");
}
