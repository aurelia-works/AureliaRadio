import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Snapshot = {
  phase: string;
  runway: string;
  callsign: string | null;
  connected: boolean;
  com1: string;
  standby: string;
  nextHint: string;
};

type Reply = { snapshot: Snapshot; transmission: string; accepted: boolean };
type Line = { role: "atc" | "pilot" | "system"; text: string };

const PHASES = [
  ["clearance", "Clearance"],
  ["ground", "Ground"],
  ["tower", "Tower"],
  ["departure", "Departure"],
] as const;

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [lines, setLines] = useState<Line[]>([
    { role: "system", text: "Aurelia Radio ready. X-Plane bridge is offline in Phase 0." },
  ]);
  const [callsign, setCallsign] = useState("N123AB");
  const [destination, setDestination] = useState("KJFK");
  const [readback, setReadback] = useState("");
  const [tx, setTx] = useState(false);

  const refresh = async () => {
    try {
      setSnapshot(await invoke<Snapshot>("snapshot"));
    } catch (error) {
      setLines((prev) => [...prev, { role: "system", text: String(error) }]);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const send = async (command: string, args: Record<string, unknown> = {}, pilotText?: string) => {
    if (pilotText) {
      setLines((prev) => [...prev, { role: "pilot", text: pilotText }]);
    }
    try {
      const reply = await invoke<Reply>(command, args);
      setSnapshot(reply.snapshot);
      setLines((prev) => [...prev, { role: "atc", text: reply.transmission }]);
      if (!reply.accepted) {
        setLines((prev) => [...prev, { role: "system", text: "Readback rejected. Correct it and send again." }]);
      }
    } catch (error) {
      setLines((prev) => [...prev, { role: "system", text: String(error) }]);
    }
  };

  const fillReadback = async () => {
    const text = await invoke<string | null>("clearance_readback");
    if (text) setReadback(text);
  };

  const phaseKey = snapshot?.phase.toLowerCase() ?? "clearance";
  const activeIndex = Math.max(0, PHASES.findIndex(([id]) => id === phaseKey));

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <div className="mark">AR</div>
          <div>
            <h1>Aurelia Radio</h1>
            <p>KMCO · Orlando International</p>
          </div>
        </div>

        <div className={`link ${snapshot?.connected ? "online" : ""}`}>
          <span className="dot" />
          {snapshot?.connected ? "X-Plane connected" : "X-Plane bridge offline"}
        </div>

        <ol className="phases">
          {PHASES.map(([id, label], index) => (
            <li key={id} className={index === activeIndex ? "active" : index < activeIndex ? "done" : ""}>
              <span>{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <div className="radio">
          <div className="freq">
            <small>COM1</small>
            <b>{snapshot?.com1 ?? "—"}</b>
          </div>
          <div className="freq">
            <small>STBY</small>
            <b>{snapshot?.standby ?? "—"}</b>
          </div>
          <button
            className={`ptt ${tx ? "tx" : ""}`}
            onMouseDown={() => setTx(true)}
            onMouseUp={() => {
              setTx(false);
              setLines((prev) => [
                ...prev,
                { role: "system", text: "Push-to-talk voice is wired in Phase 1. The text loop works now." },
              ]);
            }}
            onMouseLeave={() => setTx(false)}
          >
            {tx ? "TRANSMITTING" : "HOLD TO TALK"}
          </button>
          <p className="tiny">A320 RMP and 737 tuning panel use the same COM1 datarefs.</p>
        </div>
      </aside>

      <main className="main">
        <header className="top">
          <div>
            <small>RUNWAY</small>
            <b>{snapshot?.runway ?? "18L"}</b>
          </div>
          <div>
            <small>CALLSIGN</small>
            <b>{snapshot?.callsign ?? callsign}</b>
          </div>
          <div className="hint">{snapshot?.nextHint ?? "Request clearance"}</div>
        </header>

        <section className="transcript">
          {lines.map((line, index) => (
            <div key={index} className={`line ${line.role}`}>
              <span className="who">{line.role === "atc" ? "ATC" : line.role === "pilot" ? "YOU" : "SYS"}</span>
              <p>{line.text}</p>
            </div>
          ))}
        </section>

        <section className="composer">
          <div className="fields">
            <label>
              Callsign
              <input value={callsign} onChange={(event) => setCallsign(event.target.value.toUpperCase())} />
            </label>
            <label>
              Destination
              <input value={destination} onChange={(event) => setDestination(event.target.value.toUpperCase())} />
            </label>
          </div>

          <div className="actions">
            <button
              className="primary"
              onClick={() =>
                send("request_clearance", { callsign, destination }, `${callsign}, request IFR clearance to ${destination}.`)
              }
            >
              Request clearance
            </button>
            <button onClick={() => send("request_taxi", {}, `${callsign}, request taxi.`)}>Request taxi</button>
            <button onClick={() => send("request_takeoff", {}, `${callsign}, ready for departure.`)}>Ready for takeoff</button>
            <button onClick={() => send("request_departure", {}, `${callsign}, switching to departure.`)}>Contact departure</button>
          </div>

          <div className="readback">
            <textarea
              value={readback}
              placeholder="Readback text"
              onChange={(event) => setReadback(event.target.value)}
            />
            <div className="readback-actions">
              <button onClick={fillReadback}>Fill correct readback</button>
              <button className="primary" onClick={() => send("readback", { text: readback }, readback)}>
                Send readback
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
