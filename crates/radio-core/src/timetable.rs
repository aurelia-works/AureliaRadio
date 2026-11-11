/// One generated flight in the KMCO timetable. Real schedules and live data
/// come later; this is deterministic, seeded and offline.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Flight {
    pub callsign: String,
    pub airline: &'static str,
    pub aircraft: &'static str,
    pub destination: &'static str,
    pub departure_minute: u32,
    pub runway: &'static str,
}

const AIRLINES: &[(&str, &str)] = &[
    ("SWA", "Southwest"),
    ("DAL", "Delta"),
    ("JBU", "JetBlue"),
    ("AAL", "American"),
    ("UAL", "United"),
    ("FFT", "Frontier"),
    ("NKS", "Spirit"),
    ("SIL", "Silver"),
];

const AIRCRAFT: &[&str] = &["B737", "B738", "A320", "A321", "E190"];
const DESTINATIONS: &[&str] = &[
    "KATL", "KJFK", "KBOS", "KEWR", "KORD", "KDFW", "KDEN", "KLAX", "KMIA", "KTPA", "KPHL", "KBWI",
];
const RUNWAYS: &[&str] = &["18L", "18R", "17L", "17R"];

pub fn generate(seed: u64, count: usize) -> Vec<Flight> {
    let mut state = seed.max(1);
    let mut flights = Vec::with_capacity(count);

    for index in 0..count {
        let (code, airline) = AIRLINES[(next(&mut state) as usize) % AIRLINES.len()];
        let aircraft = AIRCRAFT[(next(&mut state) as usize) % AIRCRAFT.len()];
        let destination = DESTINATIONS[(next(&mut state) as usize) % DESTINATIONS.len()];
        let runway = RUNWAYS[(next(&mut state) as usize) % RUNWAYS.len()];
        let number = 100 + (next(&mut state) % 900) as u32;
        let jitter = (next(&mut state) % 5) as u32;
        flights.push(Flight {
            callsign: format!("{code}{number}"),
            airline,
            aircraft,
            destination,
            departure_minute: 360 + index as u32 * 7 + jitter,
            runway,
        });
    }

    flights
}

fn next(state: &mut u64) -> u64 {
    let mut value = *state;
    value ^= value << 13;
    value ^= value >> 7;
    value ^= value << 17;
    *state = value;
    value
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_same_schedule() {
        assert_eq!(generate(42, 12), generate(42, 12));
    }

    #[test]
    fn different_seed_changes_the_schedule() {
        assert_ne!(generate(42, 12), generate(7, 12));
    }

    #[test]
    fn every_flight_is_filled_in() {
        for flight in generate(99, 20) {
            assert!(!flight.callsign.is_empty());
            assert!(flight.departure_minute >= 360);
            assert!(RUNWAYS.contains(&flight.runway));
        }
    }
}
