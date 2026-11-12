import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createTalkHolds,
  createTalkSession,
  isTypingTarget,
  joystickPressed,
  TALK_CODE,
  talkEdge,
  talkNote,
  type MicStream,
} from "./ptt.ts";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("a hold that gets the mic is discarded and stopped once", async () => {
  let stops = 0;
  const session = createTalkSession(async () => ({
    stop() {
      stops += 1;
    },
  }));
  await session.press();
  const end = session.release();
  assert.equal(end.outcome, "discarded");
  assert.equal(end.heard, null);
  assert.equal(stops, 1);
  assert.equal(session.phase(), "idle");
  assert.equal(session.release().outcome, "idle");
  assert.equal(stops, 1);
});

test("letting go before the mic opens stops the late stream", async () => {
  const gate = deferred<MicStream>();
  let stops = 0;
  const session = createTalkSession(() => gate.promise);
  const opening = session.press();
  assert.equal(session.release().outcome, "cancelled");
  gate.resolve({
    stop() {
      stops += 1;
    },
  });
  await opening;
  assert.equal(stops, 1);
  assert.equal(session.phase(), "idle");
});

test("a second hold while the first open is still in flight keeps its own mic", async () => {
  const first = deferred<MicStream>();
  let calls = 0;
  let firstStops = 0;
  let secondStops = 0;
  const session = createTalkSession(() => {
    calls += 1;
    if (calls === 1) return first.promise;
    return Promise.resolve({
      stop() {
        secondStops += 1;
      },
    });
  });
  const opening = session.press();
  assert.equal(session.release().outcome, "cancelled");
  await session.press();
  assert.equal(session.phase(), "live");
  first.resolve({
    stop() {
      firstStops += 1;
    },
  });
  await opening;
  assert.equal(firstStops, 1);
  assert.equal(secondStops, 0);
  assert.equal(session.phase(), "live");
  assert.equal(session.release().outcome, "discarded");
  assert.equal(secondStops, 1);
});

test("a denied mic is reported once and can be tried again", async () => {
  let calls = 0;
  const session = createTalkSession(() => {
    calls += 1;
    if (calls === 1) return Promise.reject(new Error("denied"));
    return Promise.resolve({ stop() {} });
  });
  await session.press();
  assert.equal(session.phase(), "denied");
  assert.equal(session.release().outcome, "denied");
  assert.equal(session.release().heard, null);
  await session.press();
  assert.equal(session.phase(), "live");
});

test("the button and the key share one microphone", () => {
  const holds = createTalkHolds();
  assert.equal(holds.keyDown(), "press");
  assert.equal(holds.keyDown(), "ignore");
  assert.equal(holds.pointerDown(), "ignore");
  assert.equal(holds.keyUp(), "ignore");
  assert.equal(holds.held(), true);
  assert.equal(holds.pointerUp(), "release");
  assert.equal(holds.held(), false);
  assert.equal(holds.pointerUp(), "ignore");
});

test("leaving the window drops every hold", () => {
  const holds = createTalkHolds();
  holds.keyDown();
  holds.pointerDown();
  holds.padDown();
  assert.equal(holds.dropAll(), "release");
  assert.equal(holds.keyUp(), "ignore");
  assert.equal(holds.padUp(), "ignore");
  assert.equal(holds.dropAll(), "ignore");
});

test("a joystick trigger shares the microphone and ignores the other buttons", () => {
  const pads = [{ buttons: [{ pressed: false }, { pressed: true }] }];
  assert.equal(joystickPressed(pads, 0, true), false);
  assert.equal(joystickPressed(pads, 1, true), true);
  assert.equal(joystickPressed(pads, 0, false), false);
  assert.equal(joystickPressed(null, 0, true), false);
  assert.equal(talkEdge(false, true), "press");
  assert.equal(talkEdge(true, true), "same");
  assert.equal(talkEdge(true, false), "release");

  const holds = createTalkHolds();
  assert.equal(holds.padDown(), "press");
  assert.equal(holds.keyDown(), "ignore");
  assert.equal(holds.padUp(), "ignore");
  assert.equal(holds.held(), true);
  assert.equal(holds.keyUp(), "release");
});

test("the talk key is backtick, not Insert, and not a text field", () => {
  assert.equal(TALK_CODE, "Backquote");
  assert.notEqual(TALK_CODE, "Insert");
  assert.equal(isTypingTarget(null), false);
  assert.equal(isTypingTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isTypingTarget({ tagName: "input" }), true);
  assert.equal(isTypingTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: "BUTTON" }), false);
});

test("an idle release with the microphone switch off has a note", () => {
  assert.match(talkNote("idle", false) ?? "", /dev panel/);
  assert.equal(talkNote("cancelled", true), null);
  assert.match(talkNote("discarded", true) ?? "", /not installed/);
});

test("a denial that arrives after release does not stick", async () => {
  const gate = deferred<MicStream>();
  const session = createTalkSession(() => gate.promise);
  const opening = session.press();
  session.release();
  gate.reject(new Error("denied"));
  await opening;
  assert.equal(session.phase(), "idle");
  assert.equal(session.release().outcome, "idle");
});
