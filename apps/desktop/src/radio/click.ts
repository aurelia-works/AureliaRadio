/** A short radio click around a controller transmission. No audio file is used.
 * The burst is limited to a radio band. The spoken voice is not filtered here.
 */

import { radioBand } from "./band.ts";

export type ClickKind = "open" | "close";

export function nextClicks(air: boolean, say: string | null, enabled: boolean): { air: boolean; clicks: ClickKind[] } {
  if (!enabled) return { air: false, clicks: air ? ["close"] : [] };
  if (!say) return { air, clicks: [] };
  return { air: true, clicks: air ? ["close", "open"] : ["open"] };
}

export function finishClick(air: boolean): { air: boolean; clicks: ClickKind[] } {
  return { air: false, clicks: air ? ["close"] : [] };
}

export type ClickBuffer = { getChannelData: (channel: number) => Float32Array };

export type ClickSource = {
  buffer: ClickBuffer | null;
  connect: (dest: unknown) => void;
  start: (when: number) => void;
};

export type ClickGraph = {
  sampleRate: number;
  currentTime: number;
  destination: unknown;
  createBuffer: (channels: number, length: number, sampleRate: number) => ClickBuffer;
  createBufferSource: () => ClickSource;
};

/** One burst of shaped noise. Returns how many frames were scheduled. */
export function scheduleClick(graph: ClickGraph, kind: ClickKind): number {
  const rate = graph.sampleRate > 0 ? graph.sampleRate : 44100;
  const frames = Math.max(1, Math.round(rate * (kind === "open" ? 0.028 : 0.04)));
  const buffer = graph.createBuffer(1, frames, rate);
  const data = buffer.getChannelData(0);
  const raw = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) raw[i] = Math.random() * 2 - 1;
  const filtered = radioBand(raw, rate);
  const decay = kind === "open" ? 90 : 160;
  for (let i = 0; i < frames; i += 1) data[i] = filtered[i] * Math.exp(-i / decay) * 0.4;
  const source = graph.createBufferSource();
  source.buffer = buffer;
  source.connect(graph.destination);
  source.start(graph.currentTime);
  return frames;
}

export function createClicker(getGraph: () => ClickGraph | null) {
  return {
    play(kind: ClickKind) {
      const graph = getGraph();
      if (!graph) return;
      try {
        scheduleClick(graph, kind);
      } catch {
        /* this browser has no audio graph */
      }
    },
  };
}

let shared: AudioContext | null = null;

/** The page audio graph, created on the first click. Looked up then, not at startup. */
export function browserClickGraph(): ClickGraph | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!shared) {
    try {
      shared = new Ctx();
    } catch {
      return null;
    }
  }
  void shared.resume();
  return shared as unknown as ClickGraph;
}
