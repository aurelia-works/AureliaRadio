import type { Snapshot } from "../radio/types";

/** Flight-strip style readout: what the controller knows about you right now. */
export function StripHeader({ snapshot, callsign }: { snapshot: Snapshot | null; callsign: string }) {
  const live = !!snapshot?.connected;
  const cells: [string, string][] = [
    ["Callsign", snapshot?.callsign ?? callsign],
    ["Runway", snapshot?.runway ?? "18L"],
    ["Alt", live ? `${Math.round(snapshot!.altitudeFt).toLocaleString("en-US")} ft` : "—"],
    ["IAS", live ? `${Math.round(snapshot!.ias)} kt` : "—"],
    ["Hdg", live ? `${Math.round(snapshot!.heading).toString().padStart(3, "0")}°` : "—"],
  ];

  return (
    <div className="strip">
      <dl className="strip-cells">
        {cells.map(([label, value]) => (
          <div key={label} className="strip-cell">
            <dt>{label}</dt>
            <dd className="mono">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="next">
        <small>Next</small>
        <span>{snapshot?.nextHint ?? "Request clearance"}</span>
      </div>
    </div>
  );
}
