import { useState } from "react";
import { PHASES, type Snapshot } from "../radio/types";
import { CheckIcon, MicIcon, SwapIcon } from "../ui/icons";

type Props = {
  snapshot: Snapshot | null;
  showPhaseRail: boolean;
  showRadioStack: boolean;
  onSwap: () => void;
  onTalkPressed: () => void;
  onTalkReleased: () => void;
};

export function Sidebar({ snapshot, showPhaseRail, showRadioStack, onSwap, onTalkPressed, onTalkReleased }: Props) {
  const phaseKey = snapshot?.phase.toLowerCase() ?? "clearance";
  const active = Math.max(0, PHASES.findIndex(([id]) => id === phaseKey));

  return (
    <aside className="sidebar">
      {showPhaseRail && (
        <section className="side-section">
          <h2 className="overline">Departure flow</h2>
          <ol className="phases">
            {PHASES.map(([id, label], index) => {
              const state = index === active ? "active" : index < active ? "done" : "next";
              return (
                <li key={id} className={state} aria-current={state === "active" ? "step" : undefined}>
                  <span className="phase-dot">{state === "done" ? <CheckIcon /> : index + 1}</span>
                  {label}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {showRadioStack && (
        <RadioStack snapshot={snapshot} onSwap={onSwap} onTalkPressed={onTalkPressed} onTalkReleased={onTalkReleased} />
      )}
    </aside>
  );
}

function RadioStack({
  snapshot,
  onSwap,
  onTalkPressed,
  onTalkReleased,
}: {
  snapshot: Snapshot | null;
  onSwap: () => void;
  onTalkPressed: () => void;
  onTalkReleased: () => void;
}) {
  const [tx, setTx] = useState(false);
  const connected = !!snapshot?.connected;
  const release = () => {
    if (!tx) return;
    setTx(false);
    onTalkReleased();
  };

  return (
    <section className="radio-stack" aria-label="COM1">
      <div className="radio-head">
        <h2 className="overline">COM1</h2>
        <span className="squawk mono">
          XPDR {connected ? String(snapshot!.transponder).padStart(4, "0") : "----"}
        </span>
      </div>
      <div className="freqs">
        <div className="freq active-freq">
          <small>ACTIVE</small>
          <b className="mono">{connected ? snapshot!.com1 : "---.---"}</b>
        </div>
        <button className="swap" onClick={onSwap} disabled={!connected} aria-label="Swap active and standby" title="Swap">
          <SwapIcon />
        </button>
        <div className="freq">
          <small>STBY</small>
          <b className="mono">{connected ? snapshot!.standby : "---.---"}</b>
        </div>
      </div>
      <button
        className={`ptt ${tx ? "tx" : ""}`}
        onPointerDown={() => {
          setTx(true);
          onTalkPressed();
        }}
        onPointerUp={release}
        onPointerLeave={release}
      >
        <MicIcon />
        {tx ? "Transmitting" : "Hold to talk"}
      </button>
      <p className="tiny">The A320 RMP and the 737 tuning panel drive the same COM1.</p>
    </section>
  );
}
