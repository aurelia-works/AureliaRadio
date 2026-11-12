/** Mirrors `Snapshot` and `Reply` in src-tauri/src/main.rs (serde camelCase). */
export type Snapshot = {
  phase: string;
  runway: string;
  callsign: string | null;
  connected: boolean;
  com1: string;
  standby: string;
  nextHint: string;
  altitudeFt: number;
  ias: number;
  heading: number;
  transponder: number;
};

export type Reply = {
  snapshot: Snapshot;
  transmission: string;
  accepted: boolean;
  nextFrequency: string | null;
};

export type Role = "atc" | "pilot" | "system";
export type Line = { id: number; role: Role; text: string; rejected?: boolean };

export const PHASES = [
  ["clearance", "Clearance"],
  ["ground", "Ground"],
  ["tower", "Tower"],
  ["departure", "Departure"],
] as const;
