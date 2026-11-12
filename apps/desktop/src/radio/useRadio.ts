import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Line, Reply, Role, Snapshot } from "./types";
import { DEMO_LINES, DEMO_SNAPSHOT, isDemo } from "./demo";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * The console's only link to the Rust core. It polls the snapshot, sends pilot requests and keeps the transcript.
 * It never decides anything: every transmission, acceptance and next frequency comes back from the core.
 */
export function useRadio() {
  const nextId = useRef(1);
  const line = (role: Role, text: string, rejected?: boolean): Line => ({ id: nextId.current++, role, text, rejected });

  const [snapshot, setSnapshot] = useState<Snapshot | null>(isDemo ? DEMO_SNAPSHOT : null);
  const [lines, setLines] = useState<Line[]>(() =>
    isDemo
      ? DEMO_LINES.map(([role, text, rejected]) => line(role, text, rejected))
      : [line("system", "Aurelia Radio ready. Start X-Plane with the Aurelia Radio plugin to connect.")],
  );
  const push = useCallback((...added: Line[]) => setLines((prev) => [...prev, ...added]), []);

  const refresh = useCallback(async () => {
    if (!isTauri) return;
    try {
      setSnapshot(await invoke<Snapshot>("snapshot"));
    } catch (error) {
      push(line("system", String(error)));
    }
  }, [push]);

  useEffect(() => {
    if (!isTauri) return;
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [refresh]);

  const send = useCallback(
    async (command: string, args: Record<string, unknown> = {}, pilotText?: string) => {
      if (!isTauri) {
        push(line("system", "Requests need the desktop app. Run npm run app:dev."));
        return;
      }
      if (pilotText) push(line("pilot", pilotText));
      try {
        const reply = await invoke<Reply>(command, args);
        setSnapshot(reply.snapshot);
        push(line("atc", reply.transmission, !reply.accepted));
        if (!reply.accepted) push(line("system", "Readback rejected. Correct it and send again."));
        if (reply.nextFrequency && reply.snapshot.connected) {
          await invoke("set_standby", { mhz: Number(reply.nextFrequency) }).catch(() => {});
          refresh();
        }
      } catch (error) {
        push(line("system", String(error)));
      }
    },
    [push, refresh],
  );

  const swapCom1 = useCallback(async () => {
    if (!isTauri) return;
    await invoke("swap_com1").catch(() => {});
    refresh();
  }, [refresh]);

  const correctReadback = useCallback(async () => {
    if (!isTauri) return null;
    return invoke<string | null>("clearance_readback");
  }, []);

  const note = useCallback((text: string) => push(line("system", text)), [push]);

  return { snapshot, lines, send, swapCom1, correctReadback, note };
}
