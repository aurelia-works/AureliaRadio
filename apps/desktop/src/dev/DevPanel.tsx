import { ACCENT_PRESETS, type DevSettings } from "./devSettings";
import { CloseIcon } from "../ui/icons";

type Props = {
  settings: DevSettings;
  update: (patch: Partial<DevSettings>) => void;
  reset: () => void;
  onClose: () => void;
};

/** Looks only. Nothing here changes what the controller says or does. */
export function DevPanel({ settings, update, reset, onClose }: Props) {
  return (
    <aside className="dev-panel" aria-label="Dev panel">
      <header>
        <h2>Dev panel</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close dev panel">
          <CloseIcon />
        </button>
      </header>

      <div className="dev-group">
        <span className="dev-label">Accent</span>
        <div className="swatches">
          {ACCENT_PRESETS.map(([name, hex]) => (
            <button
              key={hex}
              className="swatch"
              style={{ background: hex }}
              aria-label={name}
              title={name}
              aria-pressed={settings.accent.toLowerCase() === hex}
              onClick={() => update({ accent: hex })}
            />
          ))}
          <input
            id="dev-accent"
            type="color"
            value={settings.accent}
            onChange={(e) => update({ accent: e.target.value })}
            aria-label="Custom accent"
          />
        </div>
      </div>

      <label className="dev-group" htmlFor="dev-density">
        <span className="dev-label">
          Density <output className="mono">{settings.density.toFixed(2)}</output>
        </span>
        <input
          id="dev-density"
          type="range"
          min={0.8}
          max={1.25}
          step={0.05}
          value={settings.density}
          onChange={(e) => update({ density: Number(e.target.value) })}
        />
      </label>

      <label className="dev-group" htmlFor="dev-log">
        <span className="dev-label">
          Transcript text <output className="mono">{settings.logSize}px</output>
        </span>
        <input
          id="dev-log"
          type="range"
          min={12}
          max={18}
          step={1}
          value={settings.logSize}
          onChange={(e) => update({ logSize: Number(e.target.value) })}
        />
      </label>

      <Toggle id="dev-phases" label="Phase rail" on={settings.showPhaseRail} set={(v) => update({ showPhaseRail: v })} />
      <Toggle id="dev-radio" label="Radio stack" on={settings.showRadioStack} set={(v) => update({ showRadioStack: v })} />
      <Toggle id="dev-sidebar" label="Sidebar" on={settings.sidebarOpen} set={(v) => update({ sidebarOpen: v })} />

      <button className="btn ghost" onClick={reset}>
        Reset to defaults
      </button>
    </aside>
  );
}

function Toggle({ id, label, on, set }: { id: string; label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="dev-toggle" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} />
    </label>
  );
}
