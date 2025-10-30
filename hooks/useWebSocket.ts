import { useEffect, useRef, useState } from "react";

type Listener = (ev: MessageEvent) => void;

export default function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const [readyState, setReadyState] = useState<string>("CLOSED");
  const retryRef = useRef<number>(0);

  useEffect(() => {
    let closedByUser = false;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      setReadyState("CONNECTING");

      ws.onopen = () => {
        setReadyState("OPEN");
        retryRef.current = 0;
      };

      ws.onmessage = (ev) => {
        listenersRef.current.forEach((fn) => fn(ev));
      };

      ws.onclose = () => {
        setReadyState("CLOSED");
        if (!closedByUser) {
          // backoff simple
          const t = Math.min(1000 + retryRef.current * 500, 5000);
          retryRef.current += 1;
          setTimeout(connect, t);
        }
      };

      ws.onerror = () => {
        setReadyState("ERROR");
        ws.close();
      };
    };

    connect();
    return () => {
      closedByUser = true;
      wsRef.current?.close();
    };
  }, [url]);

  const onMessage = (fn: Listener) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  };

  const send = (obj: any) => {
    const json = JSON.stringify(obj);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(json);
  };

  return { onMessage, send, readyState };
}
