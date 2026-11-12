/** Which new transcript line, if any, the system voice should read.
 *
 * Lines already on screen when the window opens stay quiet. Pilot lines and
 * system notes stay quiet. Only a controller line added after that is spoken.
 */

export type TranscriptLine = { id: number; role: string; text: string };

export function lineToSpeak(role: string, text: string, enabled: boolean): string | null {
  if (!enabled || role !== "atc") return null;
  const spoken = text.trim();
  return spoken.length > 0 ? spoken : null;
}

export function nextSpoken<T extends TranscriptLine>(
  lines: readonly T[],
  seen: number | null,
  enabled: boolean,
): { say: string | null; seen: number | null } {
  const lastId = lines.length > 0 ? lines[lines.length - 1].id : 0;
  if (!enabled || seen === null) return { say: null, seen: lastId };
  let say: string | null = null;
  for (const line of lines) {
    if (line.id <= seen) continue;
    const text = lineToSpeak(line.role, line.text, true);
    if (text) say = text;
  }
  return { say, seen: lastId };
}

export type SpeechSynth = {
  speak: (utterance: { text: string; onend?: () => void }) => void;
  cancel: () => void;
};

export function createSpeaker(getSynth: () => SpeechSynth | null) {
  let current: string | null = null;
  return {
    current: () => current,
    say(text: string) {
      const synth = getSynth();
      if (!synth) {
        current = null;
        return;
      }
      try {
        synth.cancel();
        current = text;
        synth.speak({
          text,
          onend: () => {
            if (current === text) current = null;
          },
        });
      } catch {
        current = null;
      }
    },
    stop() {
      current = null;
      try {
        getSynth()?.cancel();
      } catch {
        /* the engine is already gone */
      }
    },
  };
}

/** The browser's own speech engine, looked up at the moment of speaking. */
export function browserSynth(): SpeechSynth | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const synth = window.speechSynthesis;
  return {
    speak(utterance) {
      const item = new SpeechSynthesisUtterance(utterance.text);
      item.onend = () => utterance.onend?.();
      synth.speak(item);
    },
    cancel() {
      synth.cancel();
    },
  };
}
