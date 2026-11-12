import assert from "node:assert/strict";
import { test } from "node:test";
import { radioBand, radioBandEdges, toneRms } from "./band.ts";

function tone(hz: number, rate: number, seconds: number): Float32Array {
  const frames = Math.floor(rate * seconds);
  const data = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) data[i] = Math.sin((2 * Math.PI * hz * i) / rate);
  return data;
}

test("the radio band is 300 to 3000 Hz, and it stays under half the sample rate", () => {
  assert.deepEqual(radioBandEdges(44100), { lowHz: 300, highHz: 3000 });
  const narrow = radioBandEdges(1000);
  assert.ok(narrow.highHz < 500);
  assert.ok(narrow.lowHz < narrow.highHz);
});

test("a voice-band tone passes and tones outside it are quieter", () => {
  const rate = 16000;
  const skip = Math.floor(rate * 0.05);
  const mid = toneRms(radioBand(tone(1000, rate, 0.3), rate), skip);
  const low = toneRms(radioBand(tone(40, rate, 0.3), rate), skip);
  const high = toneRms(radioBand(tone(7000, rate, 0.3), rate), skip);
  assert.ok(mid > 0.2, `mid ${mid}`);
  assert.ok(mid > low * 4, `mid ${mid} low ${low}`);
  assert.ok(mid > high * 4, `mid ${mid} high ${high}`);
});

test("a flat signal is removed", () => {
  const flat = new Float32Array(4000);
  flat.fill(1);
  const level = toneRms(radioBand(flat, 16000), 800);
  assert.ok(level < 0.02, `level ${level}`);
});
