import assert from "node:assert/strict";
import { test } from "node:test";
import { createSampleBuffer, MAX_SECONDS, resample, WHISPER_RATE } from "./capture.ts";

test("the buffer keeps chunks in order and stops at the cap", () => {
  const buffer = createSampleBuffer(4, 1);
  buffer.push([0.1, 0.2]);
  buffer.push([]);
  buffer.push([0.3, 0.4, 0.5]);
  buffer.push([0.9]);
  assert.equal(buffer.length(), 4);
  assert.deepEqual(Array.from(buffer.joined()), [0.1, 0.2, 0.3, 0.4].map(Math.fround));
});

test("a pushed chunk is copied, so a reused audio buffer cannot change it", () => {
  const buffer = createSampleBuffer(10, 1);
  const reused = new Float32Array([0.5, 0.5]);
  buffer.push(reused);
  reused.fill(0);
  assert.deepEqual(Array.from(buffer.joined()), [0.5, 0.5]);
});

test("the default cap is thirty seconds", () => {
  assert.equal(MAX_SECONDS, 30);
  const buffer = createSampleBuffer(100);
  buffer.push(new Float32Array(100 * 31));
  assert.equal(buffer.length(), 3000);
});

test("48 kHz becomes 16 kHz at a third of the length and keeps a slow wave", () => {
  const from = 48_000;
  const input = new Float32Array(from);
  for (let i = 0; i < input.length; i += 1) input[i] = Math.sin((2 * Math.PI * 200 * i) / from);
  const out = resample(input, from);
  assert.equal(out.length, WHISPER_RATE);
  for (let i = 0; i < out.length; i += 97) {
    const expected = Math.sin((2 * Math.PI * 200 * (i * 3 + 1)) / from);
    assert.ok(Math.abs(out[i] - expected) < 0.01, `sample ${i}`);
  }
});

test("44.1 kHz averages its uneven windows and a tone near Nyquist mostly cancels", () => {
  const from = 44_100;
  const steady = resample(new Float32Array(from).fill(0.25), from);
  assert.equal(steady.length, WHISPER_RATE);
  assert.ok(steady.every((s) => Math.abs(s - 0.25) < 1e-6));
  const buzz = new Float32Array(from);
  for (let i = 0; i < buzz.length; i += 1) buzz[i] = i % 2 === 0 ? 1 : -1;
  const peak = resample(buzz, from).reduce((m, s) => Math.max(m, Math.abs(s)), 0);
  assert.ok(peak < 0.5, `peak ${peak}`);
});

test("16 kHz is copied, and empty or bad rates give nothing", () => {
  const input = new Float32Array([0.1, 0.2]);
  const same = resample(input, WHISPER_RATE);
  assert.deepEqual(Array.from(same), Array.from(input));
  assert.notEqual(same, input);
  assert.equal(resample(new Float32Array(0), 48_000).length, 0);
  assert.equal(resample(input, 0).length, 0);
});
