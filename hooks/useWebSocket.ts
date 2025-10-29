import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectionStatus } from '../types';

type Options = {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number; // ms
};

export function useWebSocket(url: string, options: Options = {}) {
  const {
    autoReconnect = true,
    maxReconnectAttempts = 8,
    reconnectInterval = 1000
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const attempts = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === 0 || wsRef.current.readyState === 1))
      return;

    setStatus('CONNECTING');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attempts.current = 0;
      setStatus('CONNECTED');
    };

   
