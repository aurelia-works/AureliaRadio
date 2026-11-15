import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { StripHeader } from "./components/StripHeader";
import { Transcript } from "./components/Transcript";
import { Composer } from "./components/Composer";
import { RadioCard } from "./components/RadioCard";
import { StatusBar } from "./components/StatusBar";
import { DevPanel } from "./dev/DevPanel";
import { useDevSettings } from "./dev/devSettings";
import {
  createTalkHolds,
  createTalkSession,
  isTypingTarget,
  joystickPressed,
  NOTHING_HEARD,
  requestBrowserMic,
  TALK_CODE,
  talkEdge,
  talkNote,
  type SpeechModelSlot,
} from "./radio/ptt";
import { browserClickGraph, createClicker, finishClick, nextClicks } from "./radio/click";
import { browserSynth, createSpeaker, nextSpoken } from "./radio/voice";
import { isTauri, useRadio } from "./radio/useRadio";
import { isDemo } from "./radio/demo";
import { PHASES } from "./radio/types";

export default function App() {
  const radio = useRadio();
  const dev = useDevSettings();
  const [devOpen, setDevOpen] = useState(false);
  const [callsign, setCallsign] = useState("N123AB");
  const [destination, setDestination] = useState("KJFK");
  const { sidebarOpen, micOnHold, controllerVoice } = dev.settings;
  const talk = useRef(createTalkSession(requestBrowserMic));
  const holds = useRef(createTalkHolds());
  const [talking, setTalking] = useState(false);
  const [speechModel, setSpeechModel] = useState<SpeechModelSlot>("missing");
  const applyHold = (kind: "press" | "release" | "ignore") => {
    if (kind === "ignore") return;
    if (kind === "press") {
      setTalking(true);
      if (micOnHold) void talk.current.press();
      return;
    }
    setTalking(false);
    const end = talk.current.release();
    const text = talkNote(end.outcome, micOnHold, speechModel);
    if (text) radio.note(text);
    else if (end.outcome === "captured" && end.heard && isTauri) void hear(end.heard);
  };
  /** Local recognition, then the same path as a typed call. The samples are dropped after the call. */
  const hear = async (samples: Float32Array) => {
    try {
      const { text } = await invoke<{ text: string }>("transcribe", new Uint8Array(samples.buffer));
      if (text) await radio.send("submit_utterance", { text }, text);
      else radio.note(NOTHING_HEARD);
    } catch (error) {
      radio.note(String(error));
    }
  };
  const applyRef = useRef(applyHold);
  applyRef.current = applyHold;
  const padWas = useRef(false);
  const joyRef = useRef({ on: dev.settings.joystickTalk, button: dev.settings.joystickButton });
  joyRef.current = { on: dev.settings.joystickTalk, button: dev.settings.joystickButton };
  const readJoy = () => {
    try {
      return joystickPressed(navigator.getGamepads?.() ?? [], joyRef.current.button, joyRef.current.on);
    } catch {
      return false;
    }
  };
  const readJoyRef = useRef(readJoy);
  readJoyRef.current = readJoy;
  const speaker = useRef(createSpeaker(() => browserSynth()));
  const clicker = useRef(createClicker(() => browserClickGraph()));
  const seenLine = useRef<number | null>(null);
  const air = useRef(false);
  const voiceGen = useRef(0);
  const expecting = useRef(false);
  const playClicks = (kinds: Array<"open" | "close">) => {
    for (const kind of kinds) clicker.current.play(kind);
  };
  const endClick = () => {
    const done = finishClick(air.current);
    air.current = done.air;
    playClicks(done.clicks);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("tauri", isTauri);
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    let live = true;
    let stop = () => {};
    void listen<number>("speak-done", (event) => {
      if (!live || !expecting.current) return;
      if (voiceGen.current !== 0 && event.payload !== voiceGen.current) return;
      expecting.current = false;
      endClick();
    }).then((unlisten) => {
      if (live) stop = unlisten;
      else unlisten();
    });
    return () => {
      live = false;
      stop();
    };
  }, []);

  useEffect(() => {
    const next = nextSpoken(radio.lines, seenLine.current, controllerVoice);
    seenLine.current = next.seen;
    const edge = nextClicks(air.current, next.say, controllerVoice);
    air.current = edge.air;
    playClicks(edge.clicks);
    if (!controllerVoice) {
      expecting.current = false;
      speaker.current.stop();
      if (isTauri) void invoke("speak_line", { text: "" }).catch(() => {});
      return;
    }
    if (!next.say) return;
    const text = next.say;
    if (isTauri) {
      expecting.current = true;
      void invoke<{ spoken: boolean; generation: number }>("speak_line", { text })
        .then((started) => {
          voiceGen.current = started.generation;
          if (!started.spoken) {
            expecting.current = false;
            speaker.current.say(text, endClick);
          }
        })
        .catch(() => {
          expecting.current = false;
          speaker.current.say(text, endClick);
        });
      return;
    }
    speaker.current.say(text, endClick);
  }, [radio.lines, controllerVoice]);

  useEffect(() => {
    if (!isTauri) return;
    let live = true;
    invoke<{ installed: boolean }>("speech_model")
      .then((found) => {
        if (live) setSpeechModel(found.installed ? "present" : "missing");
      })
      .catch(() => {
        if (live) setSpeechModel("missing");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === ".") {
        e.preventDefault();
        setDevOpen((v) => !v);
      } else if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        dev.update({ sidebarOpen: !sidebarOpen });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dev, sidebarOpen]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== TALK_CODE || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as { tagName?: string; isContentEditable?: boolean } | null;
      if (isTypingTarget(target)) return;
      e.preventDefault();
      applyRef.current(holds.current.keyDown());
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== TALK_CODE) return;
      applyRef.current(holds.current.keyUp());
    };
    const blur = () => {
      padWas.current = readJoyRef.current();
      applyRef.current(holds.current.dropAll());
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let loop = false;
    const step = () => {
      const down = readJoyRef.current();
      const edge = talkEdge(padWas.current, down);
      padWas.current = down;
      if (edge === "press") applyRef.current(holds.current.padDown());
      if (edge === "release") applyRef.current(holds.current.padUp());
      let connected = false;
      try {
        const pads = navigator.getGamepads?.() ?? [];
        for (let i = 0; i < pads.length; i += 1) if (pads[i]) connected = true;
      } catch {
        connected = false;
      }
      if (connected && !document.hidden) raf = requestAnimationFrame(step);
      else loop = false;
    };
    const start = () => {
      if (loop || document.hidden) return;
      loop = true;
      raf = requestAnimationFrame(step);
    };
    const onVis = () => {
      if (document.hidden) {
        padWas.current = readJoyRef.current();
        applyRef.current(holds.current.dropAll());
        cancelAnimationFrame(raf);
        loop = false;
        return;
      }
      start();
    };
    window.addEventListener("gamepadconnected", start);
    window.addEventListener("gamepaddisconnected", start);
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("gamepadconnected", start);
      window.removeEventListener("gamepaddisconnected", start);
      document.removeEventListener("visibilitychange", onVis);
      if (padWas.current) {
        padWas.current = false;
        applyRef.current(holds.current.padUp());
      }
    };
  }, []);

  const phaseKey = radio.snapshot?.phase.toLowerCase() ?? "clearance";
  const phaseLabel = PHASES.find(([id]) => id === phaseKey)?.[1] ?? "Clearance";

  return (
    <div className={`app ${sidebarOpen ? "" : "sidebar-closed"}`}>
      <TitleBar
        airport="KMCO"
        demo={isDemo}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => dev.update({ sidebarOpen: !sidebarOpen })}
      />

      {sidebarOpen && (
        <Sidebar
          snapshot={radio.snapshot}
          airport="KMCO"
          showPhaseRail={dev.settings.showPhaseRail}
          dither={dev.settings.navDither}
          accent={dev.settings.accent}
        />
      )}

      <main className="page">
        <StripHeader snapshot={radio.snapshot} callsign={callsign} />
        <div className={`page-body ${dev.settings.showRadioStack ? "" : "no-radio"}`}>
          <Transcript lines={radio.lines} />
          {dev.settings.showRadioStack && (
            <RadioCard
              snapshot={radio.snapshot}
              onSwap={radio.swapCom1}
              talking={talking}
              onTalkPressed={() => applyRef.current(holds.current.pointerDown())}
              onTalkReleased={() => applyRef.current(holds.current.pointerUp())}
            />
          )}
        </div>
        <Composer
          callsign={callsign}
          destination={destination}
          onCallsign={setCallsign}
          onDestination={setDestination}
          send={radio.send}
          correctReadback={radio.correctReadback}
        />
      </main>

      <StatusBar
        connected={!!radio.snapshot?.connected}
        phase={`${phaseLabel} · KMCO`}
        devOpen={devOpen}
        onToggleDev={() => setDevOpen((v) => !v)}
      />

      {devOpen && <DevPanel {...dev} speechModel={speechModel} onClose={() => setDevOpen(false)} />}
    </div>
  );
}
