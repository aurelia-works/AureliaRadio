/** A 300–3000 Hz band, narrowed when the sample rate cannot hold 3000 Hz. */

export type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

export function radioBandEdges(sampleRate: number): { lowHz: number; highHz: number } {
  const rate = sampleRate > 0 ? sampleRate : 44100;
  const highHz = Math.min(3000, rate * 0.45);
  const lowHz = Math.min(300, highHz / 4);
  return { lowHz, highHz };
}

/** Constant 0 dB peak gain. A tone at the center stays near its input level. */
export function bandpassCoeffs(sampleRate: number, lowHz: number, highHz: number): Biquad {
  const low = Math.max(1, lowHz);
  const high = Math.max(low + 1, highHz);
  const center = Math.sqrt(low * high);
  const q = center / (high - low);
  const w0 = (2 * Math.PI * center) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b1: 0,
    b2: -alpha / a0,
    a1: (-2 * Math.cos(w0)) / a0,
    a2: (1 - alpha) / a0,
  };
}

export function applyBiquad(input: Float32Array, coeffs: Biquad): Float32Array {
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const { b0, b1, b2, a1, a2 } = coeffs;
  for (let i = 0; i < input.length; i += 1) {
    const x0 = input[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

export function radioBand(input: Float32Array, sampleRate: number): Float32Array {
  const rate = sampleRate > 0 ? sampleRate : 44100;
  const { lowHz, highHz } = radioBandEdges(rate);
  return applyBiquad(input, bandpassCoeffs(rate, lowHz, highHz));
}

export function toneRms(samples: Float32Array, skip: number): number {
  let sum = 0;
  let count = 0;
  for (let i = skip; i < samples.length; i += 1) {
    sum += samples[i] * samples[i];
    count += 1;
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}
