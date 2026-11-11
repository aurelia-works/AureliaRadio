# KMCO — Orlando International

The first airport. Data comes from X-Plane 11's `apt.dat` so the sim and the controller agree.

## Runways

| Runway | Length | Width | Heading |
|---|---:|---:|---:|
| 17L / 35R | 3,048 m | 46 m | 175° |
| 17R / 35L | 3,048 m | 46 m | 175° |
| 18L / 36R | 3,659 m | 61 m | 180° |
| 18R / 36L | 3,659 m | 61 m | 180° |

Initial active runway for the first slice: **18L**, wind 180° at 8 kt. This is a deterministic default, not a live ATIS claim.

## Frequencies (from `apt.dat`)

| Service | MHz |
|---|---:|
| ATIS (Arrival) | 121.250 |
| ATIS (Departure) | 120.525 |
| Clearance Delivery | 134.700 |
| Ground | 121.800 |
| Ground | 126.400 |
| Tower | 118.450 |
| Tower | 124.300 |
| UNICOM | 122.950 |

Departure is not present in the sim's `apt.dat` for KMCO. The first slice uses **124.800** as a deterministic placeholder and labels it as such. Phase 3 replaces it with the CIFP/atc.dat value.

## Taxi routes

Phase 0 uses a named route, not a graph:

- Gate → runway 18L: `A, B, hold short 18L` (placeholder until the taxi graph is parsed).

Phase 2 parses the `apt.dat` taxiway network and computes the route. Until then, the controller says "taxi to runway 18L via A, hold short of runway 18L" and the readback validator only checks runway and hold-short.

## Sources

- `Resources/default scenery/default apt dat/Earth nav data/apt.dat` (runways, frequencies).
- `Resources/default data/CIFP/KMCO.dat` (SIDs/STARs, Phase 3).
- `Resources/default scenery/1200 atc data/Earth nav data/atc.dat` (Phase 3).
