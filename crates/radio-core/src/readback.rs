use crate::IfrClearance;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReadbackIssue {
    MissingCallsign,
    MissingAltitude,
    WrongAltitude {
        expected: u32,
        heard: Option<u32>,
    },
    MissingSquawk,
    WrongSquawk {
        expected: String,
        heard: Option<String>,
    },
    MissingRunway {
        expected: String,
    },
    MissingHoldShort,
    MissingTakeoff,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReadbackCheck {
    pub accepted: bool,
    pub issues: Vec<ReadbackIssue>,
}

impl ReadbackCheck {
    fn new(issues: Vec<ReadbackIssue>) -> Self {
        Self {
            accepted: issues.is_empty(),
            issues,
        }
    }
}

/// Checks callsign, altitude and squawk. Frequency and route are accepted
/// implicitly in Phase 0; Phase 2 adds them.
pub fn validate_clearance(clearance: &IfrClearance, text: &str) -> ReadbackCheck {
    let tokens = tokens(text);
    let squashed = compact(text);
    let mut issues = Vec::new();

    if !squashed.contains(&compact(&clearance.callsign)) {
        issues.push(ReadbackIssue::MissingCallsign);
    }

    match number_after(&tokens, &["CLIMB", "ALTITUDE"]) {
        None => issues.push(ReadbackIssue::MissingAltitude),
        Some(heard) if heard != clearance.initial_altitude_ft => {
            issues.push(ReadbackIssue::WrongAltitude {
                expected: clearance.initial_altitude_ft,
                heard: Some(heard),
            })
        }
        Some(_) => {}
    }

    match number_after(&tokens, &["SQUAWK"]) {
        None => issues.push(ReadbackIssue::MissingSquawk),
        Some(heard) => {
            let heard = format!("{heard:04}");
            if heard != clearance.squawk {
                issues.push(ReadbackIssue::WrongSquawk {
                    expected: clearance.squawk.clone(),
                    heard: Some(heard),
                });
            }
        }
    }

    ReadbackCheck::new(issues)
}

pub fn validate_taxi(runway: &str, text: &str) -> ReadbackCheck {
    let squashed = compact(text);
    let mut issues = Vec::new();
    if !squashed.contains(&compact(runway)) {
        issues.push(ReadbackIssue::MissingRunway {
            expected: runway.to_string(),
        });
    }
    if !squashed.contains("HOLDSHORT") {
        issues.push(ReadbackIssue::MissingHoldShort);
    }
    ReadbackCheck::new(issues)
}

pub fn validate_takeoff(runway: &str, callsign: &str, text: &str) -> ReadbackCheck {
    let squashed = compact(text);
    let mut issues = Vec::new();
    if !squashed.contains(&compact(callsign)) {
        issues.push(ReadbackIssue::MissingCallsign);
    }
    if !squashed.contains(&compact(runway)) {
        issues.push(ReadbackIssue::MissingRunway {
            expected: runway.to_string(),
        });
    }
    if !squashed.contains("TAKEOFF") {
        issues.push(ReadbackIssue::MissingTakeoff);
    }
    ReadbackCheck::new(issues)
}

fn tokens(text: &str) -> Vec<String> {
    text.to_uppercase()
        .replace([',', ';', ':', '.', '?', '!'], " ")
        .split_whitespace()
        .map(str::to_string)
        .collect()
}

fn compact(text: &str) -> String {
    text.to_uppercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect()
}

fn number_after(tokens: &[String], keys: &[&str]) -> Option<u32> {
    let index = keys
        .iter()
        .find_map(|key| tokens.iter().position(|t| t == key))?;
    let end = (index + 7).min(tokens.len());
    for start in index + 1..end {
        if let Some(value) = digit_run_at(tokens, start) {
            return Some(value);
        }
    }
    None
}

fn digit_run_at(tokens: &[String], start: usize) -> Option<u32> {
    if !is_digit_token(&tokens[start]) {
        return None;
    }
    let mut digits = String::new();
    let mut index = start;
    while index < tokens.len() {
        let token = &tokens[index];
        if let Some(digit) = word_digit(token) {
            digits.push(digit);
        } else if !token.is_empty() && token.chars().all(|c| c.is_ascii_digit()) {
            digits.push_str(token);
        } else if token == "THOUSAND" && !digits.is_empty() {
            digits.push_str("000");
        } else if token == "HUNDRED" && !digits.is_empty() {
            digits.push_str("00");
        } else {
            break;
        }
        index += 1;
    }
    digits.parse().ok()
}

fn is_digit_token(token: &str) -> bool {
    word_digit(token).is_some() || (!token.is_empty() && token.chars().all(|c| c.is_ascii_digit()))
}

fn word_digit(token: &str) -> Option<char> {
    match token {
        "ZERO" | "OH" => Some('0'),
        "ONE" => Some('1'),
        "TWO" => Some('2'),
        "THREE" => Some('3'),
        "FOUR" => Some('4'),
        "FIVE" => Some('5'),
        "SIX" => Some('6'),
        "SEVEN" => Some('7'),
        "EIGHT" => Some('8'),
        "NINER" | "NINE" => Some('9'),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Airport;

    fn clearance() -> IfrClearance {
        IfrClearance::new("N123AB", "KJFK", &Airport::kmco())
    }

    #[test]
    fn accepts_a_clean_readback() {
        let c = clearance();
        let check = validate_clearance(&c, &c.readback());
        assert!(check.accepted, "{:?}", check.issues);
    }

    #[test]
    fn accepts_spoken_digits() {
        let c = clearance();
        let text = format!(
            "N123AB cleared to KJFK via radar vectors, climb one zero thousand feet, squawk {}.",
            c.squawk
                .chars()
                .map(|d| match d {
                    '0' => "zero ",
                    '1' => "one ",
                    '2' => "two ",
                    '3' => "three ",
                    '4' => "four ",
                    '5' => "five ",
                    '6' => "six ",
                    '7' => "seven ",
                    '8' => "eight ",
                    _ => "niner ",
                })
                .collect::<String>()
        );
        let check = validate_clearance(&c, &text);
        assert!(check.accepted, "{:?}", check.issues);
    }

    #[test]
    fn rejects_a_wrong_squawk() {
        let c = clearance();
        let text = c.readback().replace(&c.squawk, "0000");
        let check = validate_clearance(&c, &text);
        assert!(!check.accepted);
        assert!(check
            .issues
            .iter()
            .any(|i| matches!(i, ReadbackIssue::WrongSquawk { .. })));
    }

    #[test]
    fn rejects_a_missing_hold_short() {
        let check = validate_taxi("18L", "N123AB taxi to runway 18L via A");
        assert!(!check.accepted);
        assert!(check.issues.contains(&ReadbackIssue::MissingHoldShort));
    }
}
