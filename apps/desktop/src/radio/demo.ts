import type { Role, Snapshot } from "./types";

/**
 * Browser-only demo data for UI review (`npm run dev`, then open /?demo). Never active inside the Tauri app or a
 * production build. The console labels it "Demo data" so it is never mistaken for live core state.
 */
export const isDemo =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  !("__TAURI_INTERNALS__" in window) &&
  new URLSearchParams(window.location.search).has("demo");

export const DEMO_SNAPSHOT: Snapshot = {
  phase: "ground",
  runway: "18L",
  callsign: "N123AB",
  connected: true,
  com1: "121.800",
  standby: "118.450",
  nextHint: "Read back the taxi clearance",
  altitudeFt: 96,
  ias: 0,
  heading: 178,
  transponder: 5427,
};

export const DEMO_LINES: [Role, string, boolean?][] = [
  ["system", "Demo data. Start the desktop app for the live core."],
  ["pilot", "N123AB, request IFR clearance to KJFK."],
  ["atc", "N123AB, cleared to KJFK via radar vectors, then as filed, climb initially 10000 feet, squawk 5427. Departure frequency 124.800."],
  ["pilot", "N123AB cleared to KJFK via radar vectors, then as filed, climb 10000 feet, squawk 5472."],
  ["atc", "N123AB, negative, squawk 5427. Say again.", true],
  ["pilot", "N123AB cleared to KJFK via radar vectors, then as filed, climb 10000 feet, squawk 5427."],
  ["atc", "N123AB, contact ground 121.800."],
  ["pilot", "N123AB, request taxi."],
  ["atc", "N123AB, taxi to runway 18L via A, B, hold short of runway 18L."],
];
