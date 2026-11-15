import { useEffect, useRef } from "react";
import type { Snapshot } from "../radio/types";
import { MicIcon, SwapIcon } from "../ui/icons";

type Props = {
  snapshot: Snapshot | null;
  onSwap: () => void;
  talking: boolean;
  onTalkPressed: () => void;
  onTalkReleased: () => void;
};

/** COM1 as read from X-Plane, the swap, and hold to talk. Nothing here is invented: no link shows dashes. */
export function RadioCard({ snapshot, onSwap, talking, onTalkPressed, onTalkReleased }: Props) {
  const connected = !!snapshot?.connected;
  const pointerDown = useRef(false);
  const releaseRef = useRef(onTalkReleased);
  releaseRef.current = onTalkReleased;
  useEffect(
    () => () => {
      if (!pointerDown.current) return;
      pointerDown.current = false;
      releaseRef.current();
    },
    [],
  );
  const releasePointer = () => {
    if (!pointerDown.current) return;
    pointerDown.current = false;
    onTalkReleased();
  };

  return (
    <section className="card radio-card" aria-label="COM1">
      <div className="card-head">
        <h2>COM1</h2>
        <span className="badge mono">
          XPDR {connected ? String(snapshot!.transponder).padStart(4, "0") : "----"}
        </span>
      </div>
      <div className="freqs">
        <div className="freq">
          <span className="label">Active</span>
          <b className="mono freq-active">{connected ? snapshot!.com1 : "---.---"}</b>
        </div>
        <button className="btn btn-icon" onClick={onSwap} disabled={!connected} aria-label="Swap active and standby" title="Swap">
          <SwapIcon />
        </button>
        <div className="freq freq-right">
          <span className="label">Standby</span>
          <b className="mono">{connected ? snapshot!.standby : "---.---"}</b>
        </div>
      </div>
      <button
        className={`btn ptt ${talking ? "is-tx" : ""}`}
        onPointerDown={() => {
          pointerDown.current = true;
          onTalkPressed();
        }}
        onPointerUp={releasePointer}
        onPointerLeave={releasePointer}
      >
        <MicIcon />
        {talking ? "Transmitting" : "Hold to talk"}
      </button>
      <p className="small">
        Hold <kbd>`</kbd> or a joystick button while this window is focused. The A320 RMP and the 737 tuning panel
        drive the same COM1.
      </p>
    </section>
  );
}
