import { useEffect, useRef } from "react";
import type { Line } from "../radio/types";

const WHO: Record<Line["role"], string> = { atc: "ATC", pilot: "YOU", system: "SYS" };

/** The radio log. Newest at the bottom; it follows new lines unless you have scrolled up to read. */
export function Transcript({ lines }: { lines: Line[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div
      className="transcript"
      ref={ref}
      role="log"
      aria-live="polite"
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
    >
      {lines.map((line) => (
        <div key={line.id} className={`line ${line.role}${line.rejected ? " rejected" : ""}`}>
          <span className="who mono">{WHO[line.role]}</span>
          <p>{line.text}</p>
        </div>
      ))}
    </div>
  );
}
