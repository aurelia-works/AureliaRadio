/** Hold-to-talk microphone session.
 *
 * Samples are not buffered. Speech recognition is not installed, so a hold only
 * opens the mic and closes it again. Nothing is written to disk.
 */

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

export function requestBrowserMic(): Promise<MicStream> {
  const media = navigator.mediaDevices;
  if (!media?.getUserMedia) return Promise.reject(new Error("no microphone"));
  return media.getUserMedia({ audio: true, video: false }).then((opened) => ({
    stop() {
      for (const track of opened.getTracks()) track.stop();
    },
  }));
}
