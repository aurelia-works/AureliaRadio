import { LogoMark } from "../brand/LogoMark";
import { SidebarIcon, SlidersIcon } from "../ui/icons";

type Props = {
  airport: string;
  connected: boolean;
  demo: boolean;
  sidebarOpen: boolean;
  devOpen: boolean;
  onToggleSidebar: () => void;
  onToggleDev: () => void;
};

/**
 * Full-width title bar under the overlay traffic lights (tauri.conf.json: titleBarStyle Overlay, lights at 18,22).
 * Layout follows the T3 Code shell: lights, sidebar toggle, then the mark and name. The bar itself drags the window.
 */
export function TitleBar({ airport, connected, demo, sidebarOpen, devOpen, onToggleSidebar, onToggleDev }: Props) {
  return (
    <header className="titlebar" data-tauri-drag-region="deep">
      <div className="traffic-space" />
      <button
        className="icon-btn"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        aria-pressed={sidebarOpen}
        title="Toggle sidebar (⌘B)"
      >
        <SidebarIcon />
      </button>
      <div className="wordmark">
        <LogoMark size={18} />
        <b>Aurelia Radio</b>
        <span className="chip mono">{airport}</span>
      </div>

      <div className="titlebar-end">
        {demo && <span className="chip demo">Demo data</span>}
        <span className={`link ${connected ? "online" : ""}`} role="status">
          <span className="dot" />
          {connected ? "X-Plane connected" : "X-Plane offline"}
        </span>
        <button
          className="icon-btn"
          onClick={onToggleDev}
          aria-label="Dev panel"
          aria-pressed={devOpen}
          title="Dev panel (⌘.)"
        >
          <SlidersIcon />
        </button>
      </div>
    </header>
  );
}
