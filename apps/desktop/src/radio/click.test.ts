import assert from "node:assert/strict";
import { test } from "node:test";
import { createClicker, finishClick, nextClicks, scheduleClick, type ClickGraph } from "./click.ts";

test("a controller line opens the radio and the next line clicks twice", () => {
  const first = nextClicks(false, "N123AB, say again.", true);
  assert.deepEqual(first.clicks, ["open"]);
  assert.equal(first.air, true);
  const quiet = nextClicks(first.air, null, true);
  assert.deepEqual(quiet.clicks, []);
  assert.equal(quiet.air, true);
  const second = nextClicks(quiet.air, "Contact ground.", true);
  assert.deepEqual(second.clicks, ["close", "open"]);
  const done = finishClick(second.air);
  assert.deepEqual(done.clicks, ["close"]);
  assert.equal(done.air, false);
  assert.deepEqual(finishClick(false).clicks, []);
});

test("turning the voice off closes the radio once", () => {
  const off = nextClicks(true, "still talking", false);
  assert.deepEqual(off.clicks, ["close"]);
  assert.equal(off.air, false);
  assert.deepEqual(nextClicks(false, "later", false).clicks, []);
});

test("a click schedules a short noise burst and a missing graph is ignored", () => {
  const started: number[] = [];
  let channels = 0;
  const graph: ClickGraph = {
    sampleRate: 8000,
    currentTime: 1.5,
    destination: "out",
    createBuffer(count, length) {
      channels = count;
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    },
    createBufferSource() {
      return {
        buffer: null,
        connect(dest) {
          assert.equal(dest, "out");
        },
        start(when) {
          started.push(when);
        },
      };
    },
  };
  const frames = scheduleClick(graph, "open");
  assert.equal(channels, 1);
  assert.equal(frames, 224);
  assert.deepEqual(started, [1.5]);
  const clicker = createClicker(() => null);
  clicker.play("close");
});
