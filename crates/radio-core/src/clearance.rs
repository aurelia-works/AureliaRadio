use crate::{Airport, Frequency, FrequencyKind};

/// A deterministic IFR clearance. The controller owns this object; the LLM
/// never creates or edits one.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IfrClearance {
    pub callsign: String,
    pub destination: String,
    pub route: String,
    pub initial_altitude_ft: u32,
    pub squawk: String,
    pub departure_frequency: Frequency,
    pub clearance_limit: String,
}

impl IfrClearance {
    pub fn new(
        callsign: impl Into<String>,
        destination: impl Into<String>,
        airport: &Airport,
    ) -> Self {
        let callsign = callsign.into().trim().to_uppercase();
        let destination = destination.into().trim().to_uppercase();
        let departure_frequency = airport
            .frequency(FrequencyKind::Departure)
            .or_else(|| Frequency::from_khz(124_800))
            .expect("124.800 is a valid frequency");
        let squawk = squawk_for(&callsign);
        Self {
            callsign,
            destination: destination.clone(),
            route: "radar vectors, then as filed".to_string(),
            initial_altitude_ft: 10_000,
            squawk,
            departure_frequency,
            clearance_limit: destination,
        }
    }

    /// A clean readback the tests and the demo can speak.
    pub fn readback(&self) -> String {
        format!(
            "{} cleared to {} via {}, climb {} feet, squawk {}.",
            self.callsign, self.clearance_limit, self.route, self.initial_altitude_ft, self.squawk
        )
    }
}

fn squawk_for(callsign: &str) -> String {
    let hash = callsign
        .bytes()
        .fold(0u32, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u32));
    format!("{:04}", 1000 + (hash % 6678))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn squawk_is_stable_and_four_digits() {
        let airport = Airport::kmco();
        let a = IfrClearance::new("N123AB", "KJFK", &airport);
        let b = IfrClearance::new("N123AB", "KJFK", &airport);
        assert_eq!(a.squawk, b.squawk);
        assert_eq!(a.squawk.len(), 4);
        assert!(a.squawk.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn readback_contains_the_clearance() {
        let airport = Airport::kmco();
        let c = IfrClearance::new("N123AB", "KJFK", &airport);
        let r = c.readback();
        assert!(r.contains("N123AB"));
        assert!(r.contains("KJFK"));
        assert!(r.contains("10000"));
        assert!(r.contains(&c.squawk));
    }
}
