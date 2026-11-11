use crate::airport::{Airport, FrequencyKind};
use crate::clearance::IfrClearance;
use crate::frequency::Frequency;
use crate::{phraseology, readback};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    ClearanceDelivery,
    Ground,
    Tower,
    Departure,
}

#[derive(Debug, Clone)]
pub enum PilotRequest {
    Clearance {
        callsign: String,
        destination: String,
    },
    Readback(String),
    RequestTaxi,
    RequestTakeoff,
    RequestDeparture,
}

#[derive(Debug, Clone)]
pub struct ControllerResponse {
    pub transmission: String,
    pub accepted: bool,
    pub next_frequency: Option<Frequency>,
    pub phase: Phase,
}

/// The deterministic KMCO controller. One instance owns one flight.
pub struct Controller {
    airport: Airport,
    phase: Phase,
    clearance: Option<IfrClearance>,
    runway: String,
    taxi_route: String,
    wind_dir: u16,
    wind_kt: u16,
}

impl Controller {
    pub fn kmco() -> Self {
        Self {
            airport: Airport::kmco(),
            phase: Phase::ClearanceDelivery,
            clearance: None,
            runway: "18L".to_string(),
            taxi_route: "A, B".to_string(),
            wind_dir: 180,
            wind_kt: 8,
        }
    }

    pub fn phase(&self) -> Phase {
        self.phase
    }

    pub fn clearance(&self) -> Option<&IfrClearance> {
        self.clearance.as_ref()
    }

    pub fn airport(&self) -> &Airport {
        &self.airport
    }

    pub fn runway(&self) -> &str {
        &self.runway
    }

    pub fn handle(&mut self, request: PilotRequest) -> ControllerResponse {
        match request {
            PilotRequest::Clearance {
                callsign,
                destination,
            } if self.phase == Phase::ClearanceDelivery => {
                let clearance = IfrClearance::new(callsign, destination, &self.airport);
                let transmission = phraseology::clearance_issue(&clearance);
                self.clearance = Some(clearance);
                self.respond(transmission, true, None)
            }
            PilotRequest::Readback(text) => self.handle_readback(&text),
            PilotRequest::RequestTaxi if self.phase == Phase::Ground => {
                let callsign = self.callsign();
                let transmission =
                    phraseology::taxi_instruction(&callsign, &self.runway, &self.taxi_route);
                self.respond(transmission, true, None)
            }
            PilotRequest::RequestTakeoff if self.phase == Phase::Tower => {
                let callsign = self.callsign();
                let transmission = phraseology::takeoff_clearance(
                    &callsign,
                    &self.runway,
                    self.wind_dir,
                    self.wind_kt,
                );
                self.respond(transmission, true, None)
            }
            PilotRequest::RequestDeparture if self.phase == Phase::Departure => {
                let callsign = self.callsign();
                self.respond(
                    format!("{}, radar contact, good day.", callsign),
                    true,
                    None,
                )
            }
            _ => self.respond("Standby.".to_string(), false, None),
        }
    }

    fn handle_readback(&mut self, text: &str) -> ControllerResponse {
        match self.phase {
            Phase::ClearanceDelivery => {
                let Some(clearance) = self.clearance.clone() else {
                    return self.respond("Standby.".to_string(), false, None);
                };
                let check = readback::validate_clearance(&clearance, text);
                if !check.accepted {
                    return self.respond(
                        phraseology::negative_say_again(&clearance.callsign, &check),
                        false,
                        None,
                    );
                }
                let frequency = self.airport.frequency(FrequencyKind::Ground);
                self.phase = Phase::Ground;
                let transmission = match frequency {
                    Some(f) => phraseology::contact(&clearance.callsign, "ground", f),
                    None => phraseology::readback_correct(&clearance.callsign),
                };
                self.respond(transmission, true, frequency)
            }
            Phase::Ground => {
                let callsign = self.callsign();
                let check = readback::validate_taxi(&self.runway, text);
                if !check.accepted {
                    return self.respond(
                        phraseology::negative_say_again(&callsign, &check),
                        false,
                        None,
                    );
                }
                let frequency = self.airport.frequency(FrequencyKind::Tower);
                self.phase = Phase::Tower;
                let transmission = match frequency {
                    Some(f) => phraseology::contact(&callsign, "tower", f),
                    None => phraseology::readback_correct(&callsign),
                };
                self.respond(transmission, true, frequency)
            }
            Phase::Tower => {
                let callsign = self.callsign();
                let check = readback::validate_takeoff(&self.runway, &callsign, text);
                if !check.accepted {
                    return self.respond(
                        phraseology::negative_say_again(&callsign, &check),
                        false,
                        None,
                    );
                }
                let frequency = self
                    .airport
                    .frequency(FrequencyKind::Departure)
                    .or_else(|| Frequency::from_khz(124_800));
                self.phase = Phase::Departure;
                let transmission = match frequency {
                    Some(f) => phraseology::contact(&callsign, "departure", f),
                    None => phraseology::readback_correct(&callsign),
                };
                self.respond(transmission, true, frequency)
            }
            Phase::Departure => self.respond("Standby.".to_string(), false, None),
        }
    }

    fn callsign(&self) -> String {
        self.clearance
            .as_ref()
            .map(|c| c.callsign.clone())
            .unwrap_or_else(|| "Aircraft".to_string())
    }

    fn respond(
        &self,
        transmission: String,
        accepted: bool,
        next_frequency: Option<Frequency>,
    ) -> ControllerResponse {
        ControllerResponse {
            transmission,
            accepted,
            next_frequency,
            phase: self.phase,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn controller_with_clearance() -> Controller {
        let mut controller = Controller::kmco();
        controller.handle(PilotRequest::Clearance {
            callsign: "N123AB".into(),
            destination: "KJFK".into(),
        });
        controller
    }

    #[test]
    fn full_flow_reaches_departure() {
        let mut controller = controller_with_clearance();
        let readback = controller.clearance().unwrap().readback();
        let response = controller.handle(PilotRequest::Readback(readback));
        assert!(response.accepted);
        assert_eq!(response.phase, Phase::Ground);
        assert_eq!(response.next_frequency.unwrap().mhz(), "121.800");

        let response = controller.handle(PilotRequest::RequestTaxi);
        assert!(response.transmission.contains("hold short"));

        let response = controller.handle(PilotRequest::Readback(
            "N123AB taxi to runway 18L via A, hold short of runway 18L".into(),
        ));
        assert!(response.accepted);
        assert_eq!(response.phase, Phase::Tower);
        assert_eq!(response.next_frequency.unwrap().mhz(), "118.450");

        let response = controller.handle(PilotRequest::RequestTakeoff);
        assert!(response.transmission.contains("cleared for takeoff"));

        let response = controller.handle(PilotRequest::Readback(
            "N123AB cleared for takeoff runway 18L".into(),
        ));
        assert!(response.accepted);
        assert_eq!(response.phase, Phase::Departure);
    }

    #[test]
    fn wrong_squawk_keeps_the_phase() {
        let mut controller = controller_with_clearance();
        let mut readback = controller.clearance().unwrap().readback();
        let squawk = controller.clearance().unwrap().squawk.clone();
        readback = readback.replace(&squawk, "0000");
        let response = controller.handle(PilotRequest::Readback(readback));
        assert!(!response.accepted);
        assert_eq!(response.phase, Phase::ClearanceDelivery);
        assert!(response.transmission.contains("negative"));
    }

    #[test]
    fn taxi_before_clearance_is_standby() {
        let mut controller = Controller::kmco();
        let response = controller.handle(PilotRequest::RequestTaxi);
        assert!(!response.accepted);
        assert_eq!(response.transmission, "Standby.");
    }
}
