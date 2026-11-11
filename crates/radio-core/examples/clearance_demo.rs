use radio_core::{generate_timetable, Controller, Phase, PilotRequest};

fn main() {
    let mut controller = Controller::kmco();

    let response = controller.handle(PilotRequest::Clearance {
        callsign: "N123AB".into(),
        destination: "KJFK".into(),
    });
    println!("ATC   > {}", response.transmission);

    let readback = controller.clearance().unwrap().readback();
    println!("Pilot > {readback}");
    let response = controller.handle(PilotRequest::Readback(readback));
    println!("ATC   > {}", response.transmission);

    let response = controller.handle(PilotRequest::RequestTaxi);
    println!("ATC   > {}", response.transmission);
    let response = controller.handle(PilotRequest::Readback(
        "N123AB taxi to runway 18L via A, hold short of runway 18L".into(),
    ));
    println!("ATC   > {}", response.transmission);

    let response = controller.handle(PilotRequest::RequestTakeoff);
    println!("ATC   > {}", response.transmission);
    let response = controller.handle(PilotRequest::Readback(
        "N123AB cleared for takeoff runway 18L".into(),
    ));
    println!("ATC   > {}", response.transmission);

    let response = controller.handle(PilotRequest::RequestDeparture);
    println!("ATC   > {}", response.transmission);
    assert_eq!(response.phase, Phase::Departure);

    println!("\nKMCO generated timetable (seed 42):");
    for flight in generate_timetable(42, 8) {
        println!(
            "  {:02}:{:02}  {:<8} {:<5} to {}  runway {}",
            flight.departure_minute / 60,
            flight.departure_minute % 60,
            flight.callsign,
            flight.aircraft,
            flight.destination,
            flight.runway
        );
    }
}
