/** Microphone samples for one hold of the talk button.
 *
 * Samples live in memory only, for one hold, and are capped at {@link MAX_SECONDS}.
 * Nothing is written to disk. The recognizer wants 16 kHz mono, so the capture is resampled on release.
 */

export const WHISPER_RATE = 16_000;
export const MAX_SECONDS = 30;

/** Collects mono chunks up to a fixed length; anything past the cap is dropped. */
export function createSampleBuffer(rate: number, maxSeconds = MAX_SECONDS) {
  const cap = Math.max(0, Math.floor(rate * maxSeconds));
  const chunks: Float32Array[] = [];
  let length = 0;
  return {
    push(chunk: ArrayLike<number>) {
      const room = cap - length;
      if (room <= 0 || chunk.length === 0) return;
      const take = Math.min(room, chunk.length);
      const copy = new Float32Array(take);
      for (let i = 0; i < take; i += 1) copy[i] = chunk[i];
      chunks.push(copy);
      length += take;
    },
    length: () => length,
    joined(): Float32Array {
      const out = new Float32Array(length);
      let at = 0;
      for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.length;
      }
      return out;
    },
  };
}

/** Resamples by averaging each output sample's input window, which also low-passes when going down. */
export function resample(input: Float32Array, from: number, to = WHISPER_RATE): Float32Array {
  if (!(from > 0) || !(to > 0) || input.length === 0) return new Float32Array(0);
  if (from === to) return input.slice();
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i += 1) {
    const start = i * ratio;
    const end = Math.min(input.length, start + ratio);
    let first = Math.floor(start);
    let sum = 0;
    let weight = 0;
    while (first < end) {
      const next = Math.min(first + 1, end);
      const part = next - Math.max(first, start);
      sum += input[first] * part;
      weight += part;
      first += 1;
    }
    out[i] = weight > 0 ? sum / weight : 0;
  }
  return out;
}

/** What the browser mic stream hands back on release: raw samples at the device rate. */
export type Captured = { samples: Float32Array; rate: number };

/** A new audio context, or null without Web Audio. Create it inside the press so WebKit lets it run. */
export function openAudioContext(): AudioContext | null {
  const AudioCtx: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    return new AudioCtx();
  } catch {
    return null;
  }
}

/**
 * Taps an open microphone track with a script processor and keeps its first channel.
 * The processor's output is silent, so nothing plays back. `close` stops the tap and frees the context.
 */
export function tapMicrophone(opened: MediaStream, context: AudioContext) {
  const buffer = createSampleBuffer(context.sampleRate);
  const source = context.createMediaStreamSource(opened);
  const tap = context.createScriptProcessor(4096, 1, 1);
  tap.onaudioprocess = (event) => buffer.push(event.inputBuffer.getChannelData(0));
  source.connect(tap);
  tap.connect(context.destination);
  void context.resume().catch(() => {});
  return {
    captured: (): Captured => ({ samples: buffer.joined(), rate: context.sampleRate }),
    close() {
      tap.onaudioprocess = null;
      source.disconnect();
      tap.disconnect();
    },
  };
}
