//! Deterministic air traffic control core for Aurelia Radio.
//!
//! No UI, no simulator, no network. Everything here is testable with
//! `cargo test`. The simulator talks to this crate through the Tauri shell;
//! the LLM never owns a clearance or a separation decision.

pub mod airport;
pub mod clearance;
pub mod controller;
pub mod frequency;
pub mod phraseology;
pub mod readback;
pub mod timetable;

pub use airport::{Airport, AirportFrequency, FrequencyKind, Runway};
pub use clearance::IfrClearance;
pub use controller::{Controller, ControllerResponse, Phase, PilotRequest};
pub use frequency::Frequency;
pub use readback::{ReadbackCheck, ReadbackIssue};
pub use timetable::{generate as generate_timetable, Flight};
