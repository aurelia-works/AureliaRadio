//! Turns a pilot utterance into a [`PilotRequest`](crate::PilotRequest).
//!
//! This is the text half of voice-in. A later slice feeds it from the microphone.
//! The same words the composer buttons send are accepted, including ICAO phonetics.

use crate::PilotRequest;

/// What the pilot asked for. `None` means the core should not invent a request.
pub fn parse_intent(text: &str) -> Option<PilotRequest> {
    let folded = fold_phonetics(text);
    let tokens = tokenize(&folded);
    if tokens.is_empty() {
        return None;
    }
    let flat = tokens.join(" ");

    if is_clearance_request(&flat) {
        let callsign = callsign_before_request(&tokens)?;
        let destination = destination_after(&tokens)?;
        return Some(PilotRequest::Clearance {
            callsign,
            destination,
        });
    }
    if flat.contains("REQUEST TAXI") {
        return Some(PilotRequest::RequestTaxi);
    }
    if flat.contains("READY FOR DEPARTURE")
        || flat.contains("READY FOR TAKEOFF")
        || flat.contains("REQUEST TAKEOFF")
    {
        return Some(PilotRequest::RequestTakeoff);
    }
    if flat.contains("SWITCHING TO DEPARTURE") || flat.contains("WITH DEPARTURE") {
        return Some(PilotRequest::RequestDeparture);
    }
    if is_readback(&flat) {
        return Some(PilotRequest::Readback(folded));
    }
    None
}

fn is_clearance_request(flat: &str) -> bool {
    flat.contains("REQUEST IFR")
        || flat.contains("REQUEST CLEARANCE")
        || flat.contains("IFR CLEARANCE TO")
        || flat.contains("READY TO COPY")
}

fn is_readback(flat: &str) -> bool {
    flat.contains("CLEARED TO")
        || flat.contains("SQUAWK")
        || flat.contains("HOLD SHORT")
        || flat.contains("CLIMB")
        || flat.contains("TAXI TO RUNWAY")
        || (flat.contains("RUNWAY") && flat.contains("CLEARED"))
}

fn callsign_before_request(tokens: &[String]) -> Option<String> {
    let end = tokens
        .iter()
        .position(|t| t == "REQUEST" || t == "READY" || t == "IFR")
        .unwrap_or(tokens.len());
    glue_ident(&tokens[..end])
}

fn destination_after(tokens: &[String]) -> Option<String> {
    let to = tokens.iter().rposition(|t| t == "TO")?;
    glue_ident(&tokens[to + 1..])
}

/// Joins a run of letters and digits into one ident (`N` `1` `2` `3` `A` `B` -> `N123AB`).
fn glue_ident(tokens: &[String]) -> Option<String> {
    let mut ident = String::new();
    for token in tokens {
        if token.len() == 1 || token.chars().all(|c| c.is_ascii_digit()) {
            ident.push_str(token);
        } else if ident.is_empty() && looks_like_ident(token) {
            ident = token.clone();
        } else if !ident.is_empty() {
            break;
        }
    }
    if looks_like_ident(&ident) {
        Some(ident)
    } else {
        None
    }
}

fn looks_like_ident(token: &str) -> bool {
    let len = token.len();
    (3..=8).contains(&len) && token.chars().all(|c| c.is_ascii_alphanumeric())
}

fn tokenize(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|t| !t.is_empty())
        .map(|t| t.to_ascii_uppercase())
        .collect()
}

fn fold_phonetics(text: &str) -> String {
    tokenize(text)
        .into_iter()
        .map(|token| phonetic(&token).unwrap_or(token))
        .collect::<Vec<_>>()
        .join(" ")
}

fn phonetic(token: &str) -> Option<String> {
    let letter = match token {
        "ALPHA" => "A",
        "BRAVO" => "B",
        "CHARLIE" => "C",
        "DELTA" => "D",
        "ECHO" => "E",
        "FOXTROT" => "F",
        "GOLF" => "G",
        "HOTEL" => "H",
        "INDIA" => "I",
        "JULIET" => "J",
        "KILO" => "K",
        "LIMA" => "L",
        "MIKE" => "M",
        "NOVEMBER" => "N",
        "OSCAR" => "O",
        "PAPA" => "P",
        "QUEBEC" => "Q",
        "ROMEO" => "R",
        "SIERRA" => "S",
        "TANGO" => "T",
        "UNIFORM" => "U",
        "VICTOR" => "V",
        "WHISKEY" => "W",
        "XRAY" => "X",
        "YANKEE" => "Y",
        "ZULU" => "Z",
        "ZERO" | "OH" => "0",
        "ONE" | "WUN" => "1",
        "TWO" | "TOO" => "2",
        "THREE" | "TREE" => "3",
        "FOUR" | "FOWER" => "4",
        "FIVE" | "FIFE" => "5",
        "SIX" => "6",
        "SEVEN" => "7",
        "EIGHT" => "8",
        "NINE" | "NINER" => "9",
        _ => return None,
    };
    Some(letter.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kind(text: &str) -> &'static str {
        match parse_intent(text) {
            Some(PilotRequest::Clearance { .. }) => "clearance",
            Some(PilotRequest::Readback(_)) => "readback",
            Some(PilotRequest::RequestTaxi) => "taxi",
            Some(PilotRequest::RequestTakeoff) => "takeoff",
            Some(PilotRequest::RequestDeparture) => "departure",
            None => "none",
        }
    }

    #[test]
    fn twenty_scripted_calls_clear_the_accuracy_bar() {
        let calls = [
            ("N123AB, request IFR clearance to KJFK.", "clearance"),
            ("November one two three alpha bravo, request IFR clearance to kilo juliet foxtrot kilo.", "clearance"),
            ("N456CD request clearance to KMIA.", "clearance"),
            ("Skyhawk N17G, ready to copy IFR to KTPA.", "clearance"),
            ("N123AB, request taxi.", "taxi"),
            ("November one two three alpha bravo, request taxi.", "taxi"),
            ("N456CD request taxi.", "taxi"),
            ("N123AB, ready for departure.", "takeoff"),
            ("N123AB, ready for takeoff.", "takeoff"),
            ("November one two three alpha bravo, request takeoff.", "takeoff"),
            ("N123AB, switching to departure.", "departure"),
            ("N123AB with departure.", "departure"),
            ("N123AB cleared to KJFK via radar vectors, climb 10000, squawk 5427.", "readback"),
            ("November one two three alpha bravo, climb one zero thousand, squawk five four two seven.", "readback"),
            ("N123AB, taxi to runway 18L via A, B, hold short of runway 18L.", "readback"),
            ("N123AB, hold short runway 18L.", "readback"),
            ("N123AB cleared for takeoff runway 18L.", "readback"),
            ("cleared to KMIA, climb 5000 feet, squawk 1200.", "readback"),
            ("N123AB, runway 18L, cleared for takeoff.", "readback"),
            ("say again, we are at the ramp.", "none"),
        ];
        assert_eq!(calls.len(), 20);
        let hits = calls.iter().filter(|(text, expect)| kind(text) == *expect).count();
        assert!(
            hits * 100 / calls.len() >= 95,
            "{hits}/{} intent matches",
            calls.len()
        );
    }

    #[test]
    fn phonetic_clearance_keeps_the_idents() {
        let intent = parse_intent(
            "November one two three alpha bravo, request IFR clearance to kilo juliet foxtrot kilo.",
        );
        match intent {
            Some(PilotRequest::Clearance {
                callsign,
                destination,
            }) => {
                assert_eq!(callsign, "N123AB");
                assert_eq!(destination, "KJFK");
            }
            other => panic!("expected a clearance, got {other:?}"),
        }
    }

    #[test]
    fn a_parsed_clearance_is_what_the_controller_issues() {
        let Some(PilotRequest::Clearance {
            callsign,
            destination,
        }) = parse_intent("N123AB, request IFR clearance to KJFK.")
        else {
            panic!("parser missed the clearance request");
        };
        let mut controller = crate::Controller::kmco();
        let response = controller.handle(PilotRequest::Clearance {
            callsign,
            destination,
        });
        assert!(response.accepted);
        assert!(response.transmission.contains("KJFK"));
    }
}
