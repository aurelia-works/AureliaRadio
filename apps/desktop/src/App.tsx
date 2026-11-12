import { useEffect, useRef, useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { StripHeader } from "./components/StripHeader";
import { Transcript } from "./components/Transcript";
import { Composer } from "./components/Composer";
import { DevPanel } from "./dev/DevPanel";
import { useDevSettings } from "./dev/devSettings";
import { createTalkHolds, createTalkSession, isTypingTarget, requestBrowserMic, TALK_CODE, talkNote } from "./radio/ptt";
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
  const applyHold = (kind: "press" | "release" | "ignore") => {
    if (kind === "ignore") return;
    if (kind === "press") {
      setTalking(true);
      if (micOnHold) void talk.current.press();
      return;
    }
    setTalking(false);
    const text = talkNote(talk.current.release().outcome, micOnHold);
    if (text) radio.note(text);
  };
  const applyRef = useRef(applyHold);
  applyRef.current = applyHold;

  useEffect(() => {
    document.documentElement.classList.toggle("tauri", isTauri);
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
    const blur = () => applyRef.current(holds.current.dropAll());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
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

      {devOpen && <DevPanel {...dev} onClose={() => setDevOpen(false)} />}
    </div>
  );
}
