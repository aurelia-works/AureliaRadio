/** Hold-to-talk microphone session.
 *
 * Samples are not buffered. A hold only opens the mic and closes it.
 * Nothing is written to disk, and this module does not run recognition.
 */

/** Whisper tiny English weights. The app only checks whether this file exists. */
export const SPEECH_MODEL_FILE = "ggml-tiny.en.bin";

export type SpeechModelSlot = "missing" | "present";

export type MicStream = { stop: () => void };

export type TalkEnd = {
  outcome: "discarded" | "cancelled" | "denied" | "idle";
  heard: null;
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
        stream?.stop();
        stream = null;
        phase = "idle";
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
  return media.getUserMedia({ audio: true, video: false }).then((opened) => ({
    stop() {
      for (const track of opened.getTracks()) track.stop();
    },
  }));
}
