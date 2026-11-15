import { PHASES, type Snapshot } from "../radio/types";

/** Page title (the controller you are talking to and what comes next), then the flight strip as a metric row. */
export function StripHeader({ snapshot, callsign }: { snapshot: Snapshot | null; callsign: string }) {
  const live = !!snapshot?.connected;
  const phaseKey = snapshot?.phase.toLowerCase() ?? "clearance";
  const phase = PHASES.find(([id]) => id === phaseKey)?.[1] ?? "Clearance";
  const cells: [string, string][] = [
    ["Callsign", snapshot?.callsign ?? callsign],
    ["Runway", snapshot?.runway ?? "18L"],
    ["Altitude", live ? `${Math.round(snapshot!.altitudeFt).toLocaleString("en-US")} ft` : "—"],
    ["IAS", live ? `${Math.round(snapshot!.ias)} kt` : "—"],
    ["Heading", live ? `${Math.round(snapshot!.heading).toString().padStart(3, "0")}°` : "—"],
  ];

  return (
    <>
      <header className="page-header">
        <h1>{phase}</h1>
        <p className="page-sub">
          <span className="label">Next</span> {snapshot?.nextHint ?? "Request clearance"}
        </p>
      </header>
      <dl className="strip">
        {cells.map(([label, value]) => (
          <div key={label} className="strip-cell">
            <dt className="label">{label}</dt>
            <dd className="mono">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
