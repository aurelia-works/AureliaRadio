use serde::Deserialize;

use crate::frequency::Frequency;

#[derive(Debug, Clone, Deserialize)]
pub struct Airport {
    pub icao: String,
    pub name: String,
    pub runways: Vec<Runway>,
    pub frequencies: Vec<AirportFrequency>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Runway {
    pub ident: String,
    pub length_m: u32,
    pub width_m: u32,
    pub heading_deg: u16,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FrequencyKind {
    Atis,
    Clearance,
    Ground,
    Tower,
    Departure,
    Approach,
    Unicom,
}

impl FrequencyKind {
    pub fn label(self) -> &'static str {
        match self {
            Self::Atis => "ATIS",
            Self::Clearance => "Clearance Delivery",
            Self::Ground => "Ground",
            Self::Tower => "Tower",
            Self::Departure => "Departure",
            Self::Approach => "Approach",
            Self::Unicom => "UNICOM",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct AirportFrequency {
    pub kind: FrequencyKind,
    pub frequency: Frequency,
    #[serde(default)]
    pub label: String,
}

impl Airport {
    /// The first airport. Data comes from X-Plane 11's `apt.dat`.
    pub fn kmco() -> Self {
        serde_json::from_str(include_str!("../data/kmco.json"))
            .expect("KMCO airport data is valid JSON")
    }

    pub fn frequency(&self, kind: FrequencyKind) -> Option<Frequency> {
        self.frequencies
            .iter()
            .find(|f| f.kind == kind)
            .map(|f| f.frequency)
    }

    pub fn runway(&self, ident: &str) -> Option<&Runway> {
        self.runways.iter().find(|r| r.ident == ident)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kmco_has_the_sim_frequencies() {
        let kmco = Airport::kmco();
        assert_eq!(kmco.icao, "KMCO");
        assert_eq!(
            kmco.frequency(FrequencyKind::Clearance).unwrap().mhz(),
            "134.700"
        );
        assert_eq!(
            kmco.frequency(FrequencyKind::Ground).unwrap().mhz(),
            "121.800"
        );
        assert_eq!(
            kmco.frequency(FrequencyKind::Tower).unwrap().mhz(),
            "118.450"
        );
    }

    #[test]
    fn kmco_has_four_runways() {
        let kmco = Airport::kmco();
        assert_eq!(kmco.runways.len(), 4);
        assert!(kmco.runway("18L").is_some());
        assert!(kmco.runway("17R").is_some());
    }
}
