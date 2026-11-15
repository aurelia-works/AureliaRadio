import { useCallback, useEffect, useState } from "react";

/** Looks Jah tweaks from the dev panel (⌘.). Stored per machine in localStorage; never sent to the core. */
export type DevSettings = {
  accent: string;
  density: number; // 0.8 compact … 1.2 roomy
  logSize: number; // transcript text, px
  showRadioStack: boolean;
  showPhaseRail: boolean;
  sidebarOpen: boolean;
};

export const ACCENT_PRESETS: [string, string][] = [
  ["Beacon amber", "#f2b441"],
  ["Signal teal", "#4fd8c4"],
  ["Sky blue", "#6fb3ff"],
  ["Scope green", "#8be28f"],
];

export const DEFAULTS: DevSettings = {
  accent: "#f2b441",
  density: 1,
  logSize: 14,
  showRadioStack: true,
  showPhaseRail: true,
  sidebarOpen: true,
};

const KEY = "aurelia-radio.dev.v1";

function load(): DevSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Dark text on light accents, light text on dark ones (WCAG relative luminance). */
export function onAccent(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#17120a";
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.35 ? "#14110b" : "#f4f6fa";
}

export function useDevSettings() {
  const [settings, setSettings] = useState<DevSettings>(load);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--accent", settings.accent);
    root.setProperty("--on-accent", onAccent(settings.accent));
    root.setProperty("--density", String(settings.density));
    root.setProperty("--log-size", `${settings.logSize}px`);
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* storage blocked: settings still apply for this run */
    }
  }, [settings]);

  const update = useCallback((patch: Partial<DevSettings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const reset = useCallback(() => setSettings(DEFAULTS), []);
  return { settings, update, reset };
}
