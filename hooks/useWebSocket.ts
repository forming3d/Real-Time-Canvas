import { useCallback, useEffect, useRef, useState } from "react";

export type WSStatus = "connecting" | "open" | "closed";

function getRoomFromURL() {
  const qs = new URLSearchParams(window.location.search);
  return qs.get("room") || "default";
}

// CAMBIA este dominio si usas otro servicio
const WS_BASE = "wss://real-time-canvas-ok.onrender.com/ws";

export function useWS(roomParam?: string) {
  const room = roomParam || getRoomFromURL();
  const [status, setStatus] = useState<WSStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<string[]>([]);

  useEffect(() => {
    const url = `${WS_BASE}?room=${encodeURIComponent(room)}&role=web`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("open");
      // flush cola
      for (const m of queueRef.current) ws.send(m);
      queueRef.current = [];
      ws.send(JSON.stringify({ type: "hello", payload: "web" }));
    };

    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("closed");

    // keepalive
    const ping = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping", payload: Date.now() }));
      }
    }, 25000);

    return () => {
      clearInterval(ping);
      try { ws.close(); } catch {}
    };
  }, [room]);

  const send = useCallback((type: string, payload: any) => {
    const msg = JSON.stringify({ type, payload });
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(msg);
    else queueRef.current.push(msg);
  }, []);

  return { send, status, room };
}
