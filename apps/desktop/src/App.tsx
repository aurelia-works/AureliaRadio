import { useEffect, useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { StripHeader } from "./components/StripHeader";
import { Transcript } from "./components/Transcript";
import { Composer } from "./components/Composer";
import { DevPanel } from "./dev/DevPanel";
import { useDevSettings } from "./dev/devSettings";
import { isTauri, useRadio } from "./radio/useRadio";
import { isDemo } from "./radio/demo";

export default function App() {
  const radio = useRadio();
  const dev = useDevSettings();
  const [devOpen, setDevOpen] = useState(false);
  const [callsign, setCallsign] = useState("N123AB");
  const [destination, setDestination] = useState("KJFK");
  const { sidebarOpen } = dev.settings;

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
          onTalkReleased={() =>
            radio.note("The microphone is not connected. Type what you would say in the box below.")
          }
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
