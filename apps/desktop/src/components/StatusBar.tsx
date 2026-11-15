type Props = {
  connected: boolean;
  phase: string;
  devOpen: boolean;
  onToggleDev: () => void;
};

/** Bottom status bar in CruiseControl's shape: link state on the left, the dev panel switch on the right. */
export function StatusBar({ connected, phase, devOpen, onToggleDev }: Props) {
  return (
    <footer className="statusbar">
      <span className={`status-link ${connected ? "is-online" : ""}`} role="status">
        <span className="square-dot" />
        {connected ? "X-Plane connected" : "X-Plane offline"}
      </span>
      <span className="statusbar-sep">{phase}</span>
      <span className="grow" />
      <button onClick={onToggleDev} aria-pressed={devOpen} aria-label="Dev panel" title="Dev panel (⌘.)">
        Dev panel <kbd>⌘.</kbd>
      </button>
    </footer>
  );
}
