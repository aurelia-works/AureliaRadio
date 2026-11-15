import { useEffect, useRef } from "react";

/**
 * Square halftone field behind the selected sidebar row, ported from CruiseControl's ui/NavDither.tsx.
 * Cells are 8 CSS px. When `pulseKey` changes the field steps through 25 frames over one second, then
 * settles on frame 0. Motion stops under prefers-reduced-motion or while the page is hidden. Nothing runs
 * when idle. Unlike the original, the colour is a prop, so a dev-panel accent change repaints it.
 */
const FRAME_COUNT = 25;
const CELL = 8;
const PULSE_MS = 1000;
const QUIET = 0.7;

/** Square size as a fraction of the cell for a luminance in 0..1; NaN means no square. */
export function glyphFraction(luminance: number): number {
  const k = 3.6;
  const threshold = 0.12;
  const floor = 0.05;
  const ceiling = 0.9;
  const lo = 1 / (1 + Math.exp(k * 0.5));
  const hi = 1 / (1 + Math.exp(-k * 0.5));
  const l = Math.min(1, Math.max(0, luminance));
  const value = (1 / (1 + Math.exp(-k * (l - 0.5))) - lo) / (hi - lo);
  return value < threshold ? NaN : floor + ((value - threshold) / (1 - threshold)) * (ceiling - floor);
}

function drawFrame(c: HTMLCanvasElement, frame: number, color: string): void {
  const g = c.getContext("2d");
  if (!g) return;
  g.clearRect(0, 0, c.width, c.height);
  const dpr = window.devicePixelRatio || 1;
  const cell = Math.max(1, Math.round(CELL * dpr));
  const cols = Math.ceil(c.width / cell);
  const rows = Math.ceil(c.height / cell);
  const t = Math.min(Math.max(frame, 0), FRAME_COUNT - 1) / (FRAME_COUNT - 1);
  g.fillStyle = color;
  for (let col = 0; col < cols; col++) {
    const x = cols > 1 ? col / (cols - 1) : 0.5;
    for (let row = 0; row < rows; row++) {
      const displacement =
        x < QUIET - 0.12 ? 0 : 0.24 * Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * (x * 1.5 - row * 0.16 - t));
      const fraction = glyphFraction((x - QUIET) / (1 - QUIET) + displacement);
      if (Number.isNaN(fraction)) continue;
      const side = Math.round(cell * fraction);
      if (side === 0) continue;
      const offset = Math.floor((cell - side) / 2);
      g.fillRect(col * cell + offset, row * cell + offset, side, side);
    }
  }
}

export function NavDither({ color, pulseKey }: { color: string; pulseKey: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const c = ref.current;
    const host = c?.parentElement;
    if (!c || !host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pulse = lastKey.current !== null && lastKey.current !== pulseKey;
    lastKey.current = pulseKey;
    let raf = 0;
    let start = 0;
    let frame = 0;

    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.min(4096, Math.ceil(host.clientWidth * dpr));
      c.height = Math.min(512, Math.ceil(host.clientHeight * dpr));
    };
    const motionAllowed = () => !reduce.matches && document.visibilityState === "visible";
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      start = 0;
      frame = 0;
      drawFrame(c, 0, color);
    };
    const tick = (now: number) => {
      if (!motionAllowed()) return stop();
      if (!start) start = now;
      const elapsed = now - start;
      if (elapsed >= PULSE_MS) return stop();
      frame = Math.min(FRAME_COUNT - 1, Math.floor((elapsed * (FRAME_COUNT - 1)) / PULSE_MS));
      drawFrame(c, frame, color);
      raf = requestAnimationFrame(tick);
    };

    size();
    drawFrame(c, 0, color);
    if (pulse && motionAllowed()) raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      size();
      drawFrame(c, frame, color);
    });
    ro.observe(host);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") stop();
    };
    const onMotion = () => {
      if (reduce.matches) stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    reduce.addEventListener("change", onMotion);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduce.removeEventListener("change", onMotion);
    };
  }, [color, pulseKey]);

  return <canvas ref={ref} className="nav-dither" aria-hidden="true" />;
}
