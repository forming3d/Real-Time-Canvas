
import { useState, useRef, useCallback, useEffect } from 'react';
import { ConnectionStatus, TouchDesignerConfig } from '../types';

interface UseWebSocketOptions {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
}

export const useWebSocket = (url: string, options: UseWebSocketOptions = {}) => {
  const {
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectInterval = 1000
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  // Use number for browser setTimeout id to avoid NodeJS typing requirement
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isManualDisconnectRef = useRef(false);

  const connect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket is already connected.');
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
        console.log('WebSocket connected to TouchDesigner');
      };

      socket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        
        if (!isManualDisconnectRef.current && autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, reconnectInterval * reconnectAttemptsRef.current);
          
          setConnectionStatus(ConnectionStatus.CONNECTING);
        } else {
          setConnectionStatus(ConnectionStatus.DISCONNECTED);
          if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            setConnectionStatus(ConnectionStatus.ERROR);
            console.error('Max reconnection attempts reached');
          }
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus(ConnectionStatus.ERROR);
      };
    } catch (error) {
      setConnectionStatus(ConnectionStatus.ERROR);
      console.error('Failed to create WebSocket:', error);
    }
  }, [url, autoReconnect, maxReconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    reconnectAttemptsRef.current = 0;
    setConnectionStatus(ConnectionStatus.DISCONNECTED);
  }, []);

  const sendMessage = useCallback((data: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(data);
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    } else {
      console.warn('WebSocket not connected. Message not sent:', data);
    }
  }, []);

  const resetReconnection = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  return { 
    connectionStatus, 
    connect, 
    disconnect, 
    sendMessage, 
    resetReconnection,
    reconnectAttempts: reconnectAttemptsRef.current
  };
};
