import assert from "node:assert/strict";
import { test } from "node:test";
import { createSpeaker, lineToSpeak, nextSpoken, type SpeechSynth } from "./voice.ts";

const history = [
  { id: 1, role: "system", text: "Demo data." },
  { id: 2, role: "pilot", text: "N123AB, request IFR clearance to KJFK." },
  { id: 3, role: "atc", text: "N123AB, cleared to KJFK." },
];

test("a controller line is spoken and other lines are not", () => {
  assert.equal(lineToSpeak("atc", "  N123AB, say again. ", true), "N123AB, say again.");
  assert.equal(lineToSpeak("pilot", "request taxi", true), null);
  assert.equal(lineToSpeak("system", "Speech recognition is not installed.", true), null);
  assert.equal(lineToSpeak("atc", "   ", true), null);
  assert.equal(lineToSpeak("atc", "Contact ground.", false), null);
});

test("lines already on screen stay quiet, and a later controller line is spoken", () => {
  const first = nextSpoken(history, null, true);
  assert.equal(first.say, null);
  assert.equal(first.seen, 3);

  const note = nextSpoken(
    [...history, { id: 4, role: "system", text: "The microphone was closed and nothing was saved." }],
    first.seen,
    true,
  );
  assert.equal(note.say, null);
  assert.equal(note.seen, 4);

  const reply = nextSpoken(
    [...history, { id: 4, role: "atc", text: " N123AB, negative, squawk 5427. Say again. " }],
    first.seen,
    true,
  );
  assert.equal(reply.say, "N123AB, negative, squawk 5427. Say again.");
  assert.equal(reply.seen, 4);
});

test("turning the voice off drops the line and does not read it later", () => {
  const seen = nextSpoken(history, null, true).seen;
  const muted = nextSpoken([...history, { id: 4, role: "atc", text: "Contact ground 121.800." }], seen, false);
  assert.equal(muted.say, null);
  assert.equal(muted.seen, 4);
  const again = nextSpoken([...history, { id: 4, role: "atc", text: "Contact ground 121.800." }], muted.seen, true);
  assert.equal(again.say, null);
});

test("a second line cancels the one still being spoken", () => {
  const calls: string[] = [];
  let endFirst: (() => void) | undefined;
  const speaker = createSpeaker(() => ({
    speak(utterance) {
      calls.push(`speak:${utterance.text}`);
      if (!endFirst) endFirst = utterance.onend;
    },
    cancel() {
      calls.push("cancel");
    },
  }));
  speaker.say("one");
  speaker.say("two");
  endFirst?.();
  assert.equal(speaker.current(), "two");
  speaker.stop();
  assert.equal(speaker.current(), null);
  assert.deepEqual(calls, ["cancel", "speak:one", "cancel", "speak:two", "cancel"]);
});

test("only the line still playing reports that it ended", () => {
  const ends: Array<(() => void) | undefined> = [];
  const speaker = createSpeaker(() => ({
    speak(utterance) {
      ends.push(utterance.onend);
    },
    cancel() {},
  }));
  let finished = 0;
  speaker.say("one", () => {
    finished += 1;
  });
  speaker.say("two", () => {
    finished += 1;
  });
  ends[0]?.();
  assert.equal(finished, 0);
  assert.equal(speaker.current(), "two");
  ends[1]?.();
  assert.equal(finished, 1);
  assert.equal(speaker.current(), null);
});

test("a missing speech engine is ignored", () => {
  const speaker = createSpeaker((): SpeechSynth | null => null);
  speaker.say("hello");
  assert.equal(speaker.current(), null);
  speaker.stop();
});
