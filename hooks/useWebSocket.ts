// hooks/useWebSocket.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import { ConnectionStatus } from '../types';

interface UseWebSocketOptions {
  /** Reintentar automáticamente si se corta la conexión */
  autoReconnect?: boolean;
  /** Máximo de intentos de reconexión */
  maxReconnectAttempts?: number;
  /** Intervalo base (ms) entre reconexiones; se multiplica por el nº de intento y un jitter 0.5–1.5 */
  reconnectInterval?: number;
}

/**
 * Hook de WebSocket con reconexión exponencial suave (con jitter) y API mínima.
 * - `connect()` y `disconnect()` para control manual
 * - `sendMessage(data)` para enviar strings
 * - `connectionStatus` indica estado (CONNECTING/CONNECTED/DISCONNECTED/ERROR)
 * - `resetReconnection()` reinicia el contador de reconexiones
 */
export const useWebSocket = (url: string, options: UseWebSocketOptions = {}) => {
  const {
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectInterval = 1000,
  } = options;

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isManualDisconnectRef = useRef<boolean>(false);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const resetReconnection = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    clearReconnectTimeout();
  }, []);

  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    clearReconnectTimeout();

    try {
      const s = socketRef.current;
      if (s && (s.readyState === WebSocket.OPEN || s.readyState === WebSocket.CONNECTING)) {
        s.close();
      }
    } catch {
      /* no-op */
    } finally {
      socketRef.current = null;
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
    }
  }, []);

  const connect = useCallback(() => {
    // Evitar múltiples connect simultáneos
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    isManualDisconnectRef.current = false;
    setConnectionStatus(ConnectionStatus.CONNECTING);

    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus(ConnectionStatus.CONNECTED);
        reconnectAttemptsRef.current = 0;
        clearReconnectTimeout();
        // Opcional: log
        // console.log('WebSocket connected:', url);
      };

      socket.onmessage = () => {
        // Manejo opcional aquí si quieres interceptar mensajes globales
      };

      socket.onerror = (err) => {
        // No cerramos aquí; dejamos que onclose gestione la reconexión
        // console.error('WebSocket error:', err);
        setConnectionStatus(ConnectionStatus.ERROR);
      };

      socket.onclose = (event) => {
        // console.log('WebSocket disconnected:', event.code, event.reason);

        // Si lo cerramos manualmente, no reintentamos
        if (isManualDisconnectRef.current) {
          setConnectionStatus(ConnectionStatus.DISCONNECTED);
          return;
        }

        // Reintentos con jitter
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          setConnectionStatus(ConnectionStatus.CONNECTING);

          // Jitter aleatorio 0.5–1.5 para evitar reconexiones sincronizadas
          const jitter = 0.5 + Math.random(); // [0.5, 1.5)
          const delay = reconnectInterval * reconnectAttemptsRef.current * jitter;

          clearReconnectTimeout();
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        } else {
          // Sin reconexión o alcanzado el máximo
          if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            setConnectionStatus(ConnectionStatus.ERROR);
          } else {
            setConnectionStatus(ConnectionStatus.DISCONNECTED);
          }
        }
      };
    } catch (e) {
      // Si falló la creación del WS, agenda un reintento si procede
      if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const jitter = 0.5 + Math.random();
        const delay = reconnectInterval * reconnectAttemptsRef.current * jitter;

        clearReconnectTimeout();
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
        setConnectionStatus(ConnectionStatus.CONNECTING);
      } else {
        setConnectionStatus(ConnectionStatus.ERROR);
      }
    }
  }, [autoReconnect, maxReconnectAttempts, reconnectInterval, url]);

  const sendMessage = useCallback((data: string) => {
    const s = socketRef.current;
    if (!s || s.readyState !== WebSocket.OPEN) {
      // console.warn('WebSocket not connected. Message not sent:', data);
      return;
    }
    try {
      s.send(data);
    } catch (error) {
      // console.error('Failed to send message:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionStatus,
    connect,
    disconnect,
    sendMessage,
    resetReconnection,
    reconnectAttempts: reconnectAttemptsRef.current,
  };
};
