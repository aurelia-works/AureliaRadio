# Aurelia Radio XPLM bridge

Phase 0 bridge. It reads standard X-Plane datarefs, streams telemetry to the app over loopback UDP, and accepts COM commands.

## Ports

| Direction | Address |
|---|---|
| Plugin → app | `127.0.0.1:49020` |
| App → plugin | `127.0.0.1:49021` |

## Datarefs read

- `sim/cockpit2/radios/actuators/com1_frequency_hz_833` (preferred) and `com1_frequency_hz`
- `com1_standby_frequency_hz_833` and `com1_standby_frequency_hz`
- `sim/flightmodel/position/latitude`, `longitude`, `indicated_airspeed`, `psi`
- `sim/cockpit2/gauges/indicators/altitude_ft_pilot`
- `sim/cockpit2/radios/actuators/transponder_code`

## Datarefs written

Only COM1 active/standby. Nothing else in Phase 0. Every write is range-checked to 118.000–136.990 MHz.

`com1_frequency_hz_833` is in hertz (`118450`); the legacy `com1_frequency_hz` is in 10 kHz units (`11845`).

## Commands

```json
{"cmd":"set_com1","mhz":121.8}
{"cmd":"set_standby","mhz":118.45}
{"cmd":"swap_com1"}
```

## Build

X-Plane 11 on an M1 Mac runs x86_64 under Rosetta, so build `x86_64` for XP11:

```sh
XPLANE_SDK="$HOME/Developer/XPlaneSDK" ARCH=x86_64 ./build.sh
```

For XP12 on Apple silicon, build `arm64` into a separate folder.

## Install (XP11)

```sh
mkdir -p "$HOME/Library/Application Support/Steam/steamapps/common/X-Plane 11/Resources/plugins/AureliaRadioXPLM/mac_x64"
cp Dist/AureliaRadioXPLM/mac_x86_64/AureliaRadioXPLM.xpl \
   "$HOME/Library/Application Support/Steam/steamapps/common/X-Plane 11/Resources/plugins/AureliaRadioXPLM/mac_x64/"
```

Restart X-Plane and check `Log.txt` for `AureliaRadio: loaded`.
