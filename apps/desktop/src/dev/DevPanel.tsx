import { ACCENT_PRESETS, type DevSettings } from "./devSettings";
import { SPEECH_MODEL_FILE, type SpeechModelSlot } from "../radio/ptt";
import { CloseIcon } from "../ui/icons";

type Props = {
  settings: DevSettings;
  update: (patch: Partial<DevSettings>) => void;
  reset: () => void;
  speechModel: SpeechModelSlot;
  onClose: () => void;
};

/** Looks, the microphone, the speech-model file, and whether new controller lines are spoken. Nothing here changes what the controller says. */
export function DevPanel({ settings, update, reset, speechModel, onClose }: Props) {
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
      <Toggle id="dev-mic" label="Microphone on hold" on={settings.micOnHold} set={(v) => update({ micOnHold: v })} />
      <div className="dev-group">
        <Toggle
          id="dev-voice"
          label="Controller voice"
          on={settings.controllerVoice}
          set={(v) => update({ controllerVoice: v })}
        />
        <p className="tiny">
          A new controller line is read by the system voice on this Mac. Pilot lines and notes stay quiet.
        </p>
      </div>
      <Toggle id="dev-joy" label="Joystick talk" on={settings.joystickTalk} set={(v) => update({ joystickTalk: v })} />
      <label className="dev-group" htmlFor="dev-joy-button">
        <span className="dev-label">
          Joystick button <output className="mono">{settings.joystickButton}</output>
        </span>
        <input
          id="dev-joy-button"
          type="range"
          min={0}
          max={15}
          step={1}
          value={settings.joystickButton}
          onChange={(e) => update({ joystickButton: Number(e.target.value) })}
        />
      </label>

      <div className="dev-group">
        <span className="dev-label">
          Speech model
          <output className="mono" id="dev-speech-model">
            {speechModel === "present" ? "file found" : "not installed"}
          </output>
        </span>
        <p className="tiny">
          Looks for <span className="mono">{SPEECH_MODEL_FILE}</span> under Application Support. Recognition does not
          run yet.
        </p>
      </div>

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
