import { useEffect, useRef } from "react";
import { PHASES, type Snapshot } from "../radio/types";
import { CheckIcon } from "../ui/icons";
import { NavDither } from "../ui/NavDither";

type Props = {
  snapshot: Snapshot | null;
  airport: string;
  showPhaseRail: boolean;
  dither: boolean;
  accent: string;
};

/** Departure flow as CruiseControl-style rows. The rows show where the core is; they are not buttons. */
export function Sidebar({ snapshot, airport, showPhaseRail, dither, accent }: Props) {
  const phaseKey = snapshot?.phase.toLowerCase() ?? "clearance";
  const active = Math.max(0, PHASES.findIndex(([id]) => id === phaseKey));
  const activeId = PHASES[active][0];
  const shown = useRef<string | null>(null);
  const changed = shown.current !== null && shown.current !== activeId;
  useEffect(() => {
    shown.current = activeId;
  }, [activeId]);

  return (
    <aside className="sidebar">
      {showPhaseRail && (
        <nav className="phase-nav" aria-label="Departure flow">
          <h2 className="group-title">Departure flow</h2>
          <ol className="phase-list">
            {PHASES.map(([id, label], index) => {
              const state = index === active ? "is-active" : index < active ? "is-done" : "is-next";
              return (
                <li key={id} className={`phase-item ${state}`} aria-current={state === "is-active" ? "step" : undefined}>
                  {state === "is-active" && dither && <NavDither color={accent} pulse={changed} />}
                  <span className="phase-icon">{state === "is-done" ? <CheckIcon /> : index + 1}</span>
                  <span className="phase-label">{label}</span>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="sidebar-foot">
        <div className="foot-line">{airport} · Orlando International</div>
        <div className="foot-line">Aurelia Radio v0.1.0</div>
      </div>
    </aside>
  );
}
