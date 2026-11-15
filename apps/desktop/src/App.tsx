import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { StripHeader } from "./components/StripHeader";
import { Transcript } from "./components/Transcript";
import { Composer } from "./components/Composer";
import { DevPanel } from "./dev/DevPanel";
import { useDevSettings } from "./dev/devSettings";
import {
  createTalkHolds,
  createTalkSession,
  isTypingTarget,
  joystickPressed,
  requestBrowserMic,
  TALK_CODE,
  talkEdge,
  talkNote,
  type SpeechModelSlot,
} from "./radio/ptt";
import { isTauri, useRadio } from "./radio/useRadio";
import { isDemo } from "./radio/demo";

export default function App() {
  const radio = useRadio();
  const dev = useDevSettings();
  const [devOpen, setDevOpen] = useState(false);
  const [callsign, setCallsign] = useState("N123AB");
  const [destination, setDestination] = useState("KJFK");
  const { sidebarOpen, micOnHold } = dev.settings;
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
    const text = talkNote(talk.current.release().outcome, micOnHold, speechModel);
    if (text) radio.note(text);
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

  useEffect(() => {
    document.documentElement.classList.toggle("tauri", isTauri);
  }, []);

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

  return (
    <div className={`app ${sidebarOpen ? "" : "sidebar-closed"}`}>
      <TitleBar
        airport="KMCO"
        connected={!!radio.snapshot?.connected}
        demo={isDemo}
        sidebarOpen={sidebarOpen}
        devOpen={devOpen}
        onToggleSidebar={() => dev.update({ sidebarOpen: !sidebarOpen })}
        onToggleDev={() => setDevOpen((v) => !v)}
      />

      {sidebarOpen && (
        <Sidebar
          snapshot={radio.snapshot}
          showPhaseRail={dev.settings.showPhaseRail}
          showRadioStack={dev.settings.showRadioStack}
          onSwap={radio.swapCom1}
          talking={talking}
          onTalkPressed={() => applyRef.current(holds.current.pointerDown())}
          onTalkReleased={() => applyRef.current(holds.current.pointerUp())}
        />
      )}

      <main className="main">
        <StripHeader snapshot={radio.snapshot} callsign={callsign} />
        <Transcript lines={radio.lines} />
        <Composer
          callsign={callsign}
          destination={destination}
          onCallsign={setCallsign}
          onDestination={setDestination}
          send={radio.send}
          correctReadback={radio.correctReadback}
        />
      </main>

      {devOpen && <DevPanel {...dev} speechModel={speechModel} onClose={() => setDevOpen(false)} />}
    </div>
  );
}
