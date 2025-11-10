import { useCallback, useEffect, useRef, useState } from "react";

type UseWSOpts = {
  url: string;
  reconnectMs?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (ev: Event) => void;
  onMessage?: (ev: MessageEvent) => void;
};

export function useWebSocket(opts: UseWSOpts) {
  const { url, reconnectMs = 2000, onOpen, onClose, onError, onMessage } = opts;
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let dead = false;
    let timer: any = null;

    const connect = () => {
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";        // recibir/enviar binario (PNG final)
      wsRef.current = ws;

      ws.onopen = () => { if (dead) return; setConnected(true); onOpen?.(); };
      ws.onclose = () => {
        if (dead) return;
        setConnected(false);
        onClose?.();
        timer = setTimeout(connect, reconnectMs);
      };
      ws.onerror = (ev) => { onError?.(ev); };
      ws.onmessage = (ev) => { onMessage?.(ev); };
    };

    connect();
    return () => { dead = true; clearTimeout(timer); try { wsRef.current?.close(); } catch { } };
  }, [url, reconnectMs, onOpen, onClose, onError, onMessage]);

  const sendJSON = useCallback((obj: any) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(obj));
    return true;
  }, []);

  const sendText = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(text);
    return true;
  }, []);

  const sendBinary = useCallback((bin: Blob | ArrayBuffer | Uint8Array) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(bin);
    return true;
  }, []);

  return { connected, sendJSON, sendText, sendBinary };
}
