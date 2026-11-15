import { LogoMark } from "../brand/LogoMark";
import { SidebarIcon } from "../ui/icons";

type Props = {
  airport: string;
  demo: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
};

/**
 * Full-width title bar under the overlay traffic lights (tauri.conf.json: titleBarStyle Overlay, lights at 18,22):
 * lights, sidebar toggle, then the mark and the two-weight wordmark. The bar itself drags the window.
 */
export function TitleBar({ airport, demo, sidebarOpen, onToggleSidebar }: Props) {
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
        <LogoMark size={20} />
        <span className="wm-a">Aurelia</span>
        <span className="wm-b">Radio</span>
      </div>
      <span className="badge mono">{airport}</span>
      {demo && <span className="badge badge-accent titlebar-end">Demo data</span>}
    </header>
  );
}
