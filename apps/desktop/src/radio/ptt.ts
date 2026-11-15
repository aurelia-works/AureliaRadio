/** Hold-to-talk microphone session.
 *
 * A hold opens the mic and keeps its samples in memory until release (capture.ts caps the length).
 * On release they are resampled to 16 kHz and handed back once; nothing is written to disk.
 * Recognition runs in the desktop app (the `transcribe` command), not here.
 */

import { type Captured, openAudioContext, resample, tapMicrophone } from "./capture.ts";

/** Whisper tiny English weights, loaded by the desktop app on the first transmission. */
export const SPEECH_MODEL_FILE = "ggml-tiny.en.bin";

export type SpeechModelSlot = "missing" | "present";

/** An open mic. `captured` is absent when the stream cannot hand back samples. */
export type MicStream = { stop: () => void; captured?: () => Captured };

/** `heard` holds 16 kHz mono samples only for a "captured" hold. */
export type TalkEnd = {
  outcome: "captured" | "discarded" | "cancelled" | "denied" | "idle";
  heard: Float32Array | null;
};

type Phase = "idle" | "opening" | "live" | "denied";

export function createTalkSession(requestMic: () => Promise<MicStream>) {
  let phase: Phase = "idle";
  let stream: MicStream | null = null;
  let generation = 0;
  let pending: Promise<void> | null = null;

  return {
    phase(): Phase {
      return phase;
    },
    press(): Promise<void> {
      if (phase === "opening" || phase === "live") return pending ?? Promise.resolve();
      const ticket = ++generation;
      phase = "opening";
      pending = requestMic()
        .then((next) => {
          if (ticket !== generation) {
            next.stop();
            return;
          }
          stream = next;
          phase = "live";
        })
        .catch(() => {
          if (ticket !== generation) return;
          phase = "denied";
        })
        .finally(() => {
          if (ticket === generation) pending = null;
        });
      return pending;
    },
    release(): TalkEnd {
      if (phase === "opening") {
        generation += 1;
        phase = "idle";
        pending = null;
        return { outcome: "cancelled", heard: null };
      }
      if (phase === "live") {
        generation += 1;
        const got = stream?.captured?.();
        stream?.stop();
        stream = null;
        phase = "idle";
        if (got) return { outcome: "captured", heard: resample(got.samples, got.rate) };
        return { outcome: "discarded", heard: null };
      }
      if (phase === "denied") {
        generation += 1;
        phase = "idle";
        return { outcome: "denied", heard: null };
      }
      return { outcome: "idle", heard: null };
    },
  };
}

/** The key left of 1 on a US keyboard. Insert belongs to Aurelia Voice and is not used. */
export const TALK_CODE = "Backquote";

export function isTypingTarget(target: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!target?.tagName) return false;
  const tag = target.tagName.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable === true;
}

/** The on-screen button, the focused-window key, and a joystick button can be down together. The mic opens on the first and closes on the last. */
export function createTalkHolds() {
  let pointer = false;
  let key = false;
  let pad = false;
  const held = () => pointer || key || pad;

  const raise = (already: boolean, mark: () => void): "press" | "ignore" => {
    const was = held();
    if (already) return "ignore";
    mark();
    return was ? "ignore" : "press";
  };

  return {
    held,
    pointerDown(): "press" | "ignore" {
      return raise(pointer, () => {
        pointer = true;
      });
    },
    pointerUp(): "release" | "ignore" {
      if (!pointer) return "ignore";
      pointer = false;
      return held() ? "ignore" : "release";
    },
    keyDown(): "press" | "ignore" {
      return raise(key, () => {
        key = true;
      });
    },
    keyUp(): "release" | "ignore" {
      if (!key) return "ignore";
      key = false;
      return held() ? "ignore" : "release";
    },
    padDown(): "press" | "ignore" {
      return raise(pad, () => {
        pad = true;
      });
    },
    padUp(): "release" | "ignore" {
      if (!pad) return "ignore";
      pad = false;
      return held() ? "ignore" : "release";
    },
    dropAll(): "release" | "ignore" {
      const was = held();
      pointer = false;
      key = false;
      pad = false;
      return was ? "release" : "ignore";
    },
  };
}

export type PadLike = { buttons?: ArrayLike<{ pressed: boolean }> | null } | null;

/** True when the chosen joystick button is down. Button 0 is the usual trigger. */
export function joystickPressed(
  pads: ArrayLike<PadLike> | null,
  button: number,
  enabled: boolean,
): boolean {
  if (!enabled || !pads || !Number.isInteger(button) || button < 0) return false;
  for (let i = 0; i < pads.length; i += 1) {
    if (pads[i]?.buttons?.[button]?.pressed) return true;
  }
  return false;
}

export function talkEdge(wasDown: boolean, isDown: boolean): "press" | "release" | "same" {
  if (isDown && !wasDown) return "press";
  if (!isDown && wasDown) return "release";
  return "same";
}

export function talkNote(
  outcome: TalkEnd["outcome"],
  micOnHold: boolean,
  model: SpeechModelSlot = "missing",
): string | null {
  if (!micOnHold && outcome === "idle") {
    return "Hold to talk is not opening the microphone. The switch is in the dev panel.";
  }
  if (outcome === "captured") {
    if (model === "present") return null;
    return "Speech recognition is not installed. The microphone was closed and nothing was saved. Type what you would say in the box below.";
  }
  if (outcome === "discarded") {
    if (model === "present") {
      return "The speech model file is on disk, but recognition is not running yet. The microphone was closed and nothing was saved.";
    }
    return "Speech recognition is not installed. The microphone was closed and nothing was saved. Type what you would say in the box below.";
  }
  if (outcome === "denied") {
    return "The microphone is not available. Type what you would say in the box below.";
  }
  return null;
}

export function requestBrowserMic(): Promise<MicStream> {
  const media = navigator.mediaDevices;
  if (!media?.getUserMedia) return Promise.reject(new Error("no microphone"));
  const context = openAudioContext();
  const release = () => void context?.close().catch(() => {});
  return media.getUserMedia({ audio: true, video: false }).then(
    (opened) => {
      let tap: ReturnType<typeof tapMicrophone> | null = null;
      try {
        tap = context ? tapMicrophone(opened, context) : null;
      } catch {
        tap = null;
      }
      return {
        captured: tap?.captured,
        stop() {
          tap?.close();
          release();
          for (const track of opened.getTracks()) track.stop();
        },
      };
    },
    (error) => {
      release();
      throw error;
    },
  );
}

/** Shown when a hold was recognized as silence or was too short to decode. */
export const NOTHING_HEARD = "Nothing was heard. Hold the button for the whole call and speak after it lights.";
