import { useState } from "react";

type Props = {
  callsign: string;
  destination: string;
  onCallsign: (v: string) => void;
  onDestination: (v: string) => void;
  send: (command: string, args?: Record<string, unknown>, pilotText?: string) => Promise<void>;
  correctReadback: () => Promise<string | null>;
};

/** Text stand-in for the voice loop until Phase 1: the same requests the pilot will later speak. */
export function Composer({ callsign, destination, onCallsign, onDestination, send, correctReadback }: Props) {
  const [readback, setReadback] = useState("");

  const sendReadback = async () => {
    const text = readback.trim();
    if (!text) return;
    await send("readback", { text }, text);
    setReadback("");
  };

  return (
    <section className="composer" aria-label="Pilot requests">
      <div className="composer-row">
        <label className="field" htmlFor="callsign">
          <span>Callsign</span>
          <input
            id="callsign"
            className="mono"
            value={callsign}
            spellCheck={false}
            onChange={(e) => onCallsign(e.target.value.toUpperCase())}
          />
        </label>
        <label className="field" htmlFor="destination">
          <span>Destination</span>
          <input
            id="destination"
            className="mono"
            value={destination}
            spellCheck={false}
            onChange={(e) => onDestination(e.target.value.toUpperCase())}
          />
        </label>
        <div className="requests">
          <button
            className="btn primary"
            onClick={() =>
              send("request_clearance", { callsign, destination }, `${callsign}, request IFR clearance to ${destination}.`)
            }
          >
            Request clearance
          </button>
          <button className="btn" onClick={() => send("request_taxi", {}, `${callsign}, request taxi.`)}>
            Request taxi
          </button>
          <button className="btn" onClick={() => send("request_takeoff", {}, `${callsign}, ready for departure.`)}>
            Ready for takeoff
          </button>
          <button className="btn" onClick={() => send("request_departure", {}, `${callsign}, switching to departure.`)}>
            Contact departure
          </button>
        </div>
      </div>

      <div className="readback">
        <textarea
          id="readback"
          className="mono"
          value={readback}
          placeholder="Type your readback, then press ⌘ Return"
          spellCheck={false}
          onChange={(e) => setReadback(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              sendReadback();
            }
          }}
        />
        <div className="readback-actions">
          <button className="btn ghost" onClick={async () => setReadback((await correctReadback()) ?? readback)}>
            Fill correct readback
          </button>
          <button className="btn primary" onClick={sendReadback} disabled={!readback.trim()}>
            Send readback
          </button>
        </div>
      </div>
    </section>
  );
}
