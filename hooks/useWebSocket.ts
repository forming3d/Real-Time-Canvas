// useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';

type WSOpts = {
  url: string;              // ej: ws://localhost:8080?room=ROOM1
  binaryType?: BinaryType;  // 'arraybuffer' por defecto
  reconnectMs?: number;     // backoff fijo simple
  maxBuffered?: number;     // umbral para saltar frames (bytes)
  onMessage?: (event: MessageEvent) => void; // manejar mensajes entrantes
};

export function useWebSocket(opts: WSOpts) {
  const {
    url,
    binaryType = 'arraybuffer',
    reconnectMs = 1500,
    maxBuffered = 256 * 1024, // 256 KB por defecto (ajustable)
    onMessage,
  } = opts;

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef<typeof onMessage>(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const cleanup = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { }
      wsRef.current = null;
    }
  };

  const connect = useCallback(() => {
    cleanup();
    try {
      const ws = new WebSocket(url);
      ws.binaryType = binaryType;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        timerRef.current = window.setTimeout(connect, reconnectMs);
      };
      ws.onerror = () => {
        try { ws.close(); } catch { }
      };
      ws.onmessage = (event) => {
        const handler = onMessageRef.current;
        if (handler) handler(event);
      };
      wsRef.current = ws;
    } catch {
      timerRef.current = window.setTimeout(connect, reconnectMs);
    }
  }, [url, binaryType, reconnectMs]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect]);

  const canSend = () => {
    const ws = wsRef.current;
    return !!ws && ws.readyState === WebSocket.OPEN && ws.bufferedAmount < maxBuffered;
  };

  const sendJSON = (obj: any) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    if (ws.bufferedAmount >= maxBuffered) return false;
    ws.send(JSON.stringify(obj));
    return true;
  };

  const sendBinary = (buf: ArrayBuffer | Uint8Array) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    if (ws.bufferedAmount >= maxBuffered) return false;
    ws.send(buf);
    return true;
  };

  return { wsRef, connected, canSend, sendJSON, sendBinary };
}
