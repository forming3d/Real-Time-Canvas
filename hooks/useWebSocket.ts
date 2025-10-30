import { useEffect, useRef, useCallback } from "react";

type WSMsg =
  | { type: "prompt"; payload: string }
  | { type: "draw"; payload: string }
  | { type: "ping" }
  | { type: string; payload?: any };

const DEFAULT_URL =
  (import.meta.env.VITE_WS_URL as string) ||
  // si sirves la web desde Render/HTTPS construimos wss:
  (location.protocol === "https:"
    ? `wss://${location.host}`
    : `ws://${location.hostname}:9980`);

export function useWebSocket(onMessage?: (m: MessageEvent) => void, url = DEFAULT_URL) {
  const wsRef = useRef<WebSocket | null>(null);
  const pingTimer = useRef<number | null>(null);

  const sendJson = useCallback((obj: WSMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }, []);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      // keep-alive (Render cierra por inactividad)
      pingTimer.current = window.setInterval(() => {
        try { ws.send(JSON.stringify({ type: "ping" })); } catch {}
      }, 25000) as unknown as number;
    });

    if (onMessage) ws.addEventListener("message", onMessage);

    ws.addEventListener("close", () => {
      if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; }
    });

    ws.addEventListener("error", () => {
      // no tiramos la app; solo dejamos que reintentes recargando
    });

    return () => {
      if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; }
      try { ws.close(); } catch {}
      wsRef.current = null;
    };
  }, [url, onMessage]);

  return { sendJson };
}
