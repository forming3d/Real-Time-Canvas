
import { useState, useRef, useCallback, useEffect } from 'react';
import { ConnectionStatus } from '../types';

export const useWebSocket = (url: string) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket is already connected.');
      return;
    }

    setConnectionStatus(ConnectionStatus.CONNECTING);
    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus(ConnectionStatus.CONNECTED);
        console.log('WebSocket connected');
      };

      socket.onclose = () => {
        setConnectionStatus(ConnectionStatus.DISCONNECTED);
        console.log('WebSocket disconnected');
      };

      socket.onerror = (error) => {
        setConnectionStatus(ConnectionStatus.ERROR);
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      setConnectionStatus(ConnectionStatus.ERROR);
      console.error('Failed to create WebSocket:', error);
    }
  }, [url]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((data: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(data);
    }
  }, []);
  
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { connectionStatus, connect, disconnect, sendMessage };
};
