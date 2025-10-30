import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConnectionStatus } from '../types';

type Options = {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number; // ms
};

export function useWebSocket(url: string, opts: Options = {}) {
  const {
    autoReconnect = true,
    maxReconnectAttempts = 8,
    reconnectInterval = 1000,
  } = opts;

  const [connectionStatus, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const reconnectTimer = useRef<number | null>(null);

  const clearTimer = () => {
    if (reconnectTimer.current !== null) {
      window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  };

  const connect = useCallback(() => {
    clearTimer();
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    setStatus('CONNECTING');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptsRef.current = 0;
      setStatus('CONNECTED');
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (autoReconnect && attemptsRef.current < maxReconnectAttempts) {
        attemptsRef.current += 1;
        setStatus('RECONNECTING');
        clearTimer();
        reconnectTimer.current = window.setTimeout(connect, reconnectInterval);
      } else {
        setStatus('DISCONNECTED');
      }
    };

    ws.onerror = () => {
      setStatus('ERROR');
      ws.close();
    };

    ws.onmessage = () => {
      // Si quieres manejar mensajes entrantes, hazlo aquí.
    };
  }, [url, autoReconnect, maxReconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    clearTimer();
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('DISCONNECTED');
  }, []);

  const sendMessage = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return useMemo(() => ({
    connectionStatus,
    connect,
    disconnect,
    sendMessage,
  }), [connectionStatus, connect, disconnect, sendMessage]);
}
