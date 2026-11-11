use crate::{Frequency, IfrClearance, ReadbackCheck, ReadbackIssue};

pub fn clearance_issue(clearance: &IfrClearance) -> String {
    format!(
        "{}, cleared to {} via {}, climb initially {} feet, squawk {}. Departure frequency {}.",
        clearance.callsign,
        clearance.clearance_limit,
        clearance.route,
        clearance.initial_altitude_ft,
        clearance.squawk,
        clearance.departure_frequency.mhz()
    )
}

pub fn taxi_instruction(callsign: &str, runway: &str, route: &str) -> String {
    format!(
        "{}, taxi to runway {} via {}, hold short of runway {}.",
        callsign, runway, route, runway
    )
}

pub fn takeoff_clearance(callsign: &str, runway: &str, wind_dir: u16, wind_kt: u16) -> String {
    format!(
        "{}, runway {}, wind {:03} degrees at {} knots, cleared for takeoff.",
        callsign, runway, wind_dir, wind_kt
    )
}

pub fn contact(callsign: &str, unit: &str, frequency: Frequency) -> String {
    format!("{}, contact {} {}.", callsign, unit, frequency.mhz())
}

pub fn readback_correct(callsign: &str) -> String {
    format!("{}, readback correct.", callsign)
}

pub fn negative_say_again(callsign: &str, check: &ReadbackCheck) -> String {
    match check.issues.first() {
        Some(ReadbackIssue::MissingCallsign) => {
            format!("{}, negative, include your callsign. Say again.", callsign)
        }
        Some(ReadbackIssue::MissingAltitude) => {
            format!("{}, negative, include your altitude. Say again.", callsign)
        }
        Some(ReadbackIssue::WrongAltitude { expected, .. }) => {
            format!(
                "{}, negative, climb {} feet. Say again.",
                callsign, expected
            )
        }
        Some(ReadbackIssue::MissingSquawk) => {
            format!("{}, negative, include your squawk. Say again.", callsign)
        }
        Some(ReadbackIssue::WrongSquawk { expected, .. }) => {
            format!("{}, negative, squawk {}. Say again.", callsign, expected)
        }
        Some(ReadbackIssue::MissingRunway { expected }) => {
            format!("{}, negative, runway {}. Say again.", callsign, expected)
        }
        Some(ReadbackIssue::MissingHoldShort) => {
            format!("{}, negative, hold short. Say again.", callsign)
        }
        Some(ReadbackIssue::MissingTakeoff) => {
            format!(
                "{}, negative, include cleared for takeoff. Say again.",
                callsign
            )
        }
        None => format!("{}, say again.", callsign),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Airport;

    #[test]
    fn clearance_sounds_like_a_real_one() {
        let c = IfrClearance::new("N123AB", "KJFK", &Airport::kmco());
        let text = clearance_issue(&c);
        assert!(text.starts_with("N123AB, cleared to KJFK via"));
        assert!(text.contains("squawk"));
        assert!(text.contains("Departure frequency"));
    }

    #[test]
    fn taxi_instruction_includes_the_hold_short() {
        let text = taxi_instruction("N123AB", "18L", "A, B");
        assert!(text.contains("taxi to runway 18L via A, B"));
        assert!(text.contains("hold short of runway 18L"));
    }
}
