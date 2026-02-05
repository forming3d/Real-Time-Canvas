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
  
  // Usar refs para callbacks para evitar reconexiones
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const onMessageRef = useRef(onMessage);
  
  useEffect(() => {
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
    onMessageRef.current = onMessage;
  }, [onOpen, onClose, onError, onMessage]);

  useEffect(() => {
    let dead = false;
    let timer: any = null;

    const connect = () => {
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";        // recibir/enviar binario (PNG final)
      wsRef.current = ws;

      ws.onopen = () => { 
        if (dead) return; 
        console.log('✅ WebSocket conectado:', url);
        setConnected(true); 
        onOpenRef.current?.(); 
      };
      ws.onclose = () => {
        if (dead) return;
        console.log('🔌 WebSocket desconectado');
        setConnected(false);
        onCloseRef.current?.();
        timer = setTimeout(connect, reconnectMs);
      };
      ws.onerror = (ev) => { 
        console.error('❌ WebSocket error:', ev);
        onErrorRef.current?.(ev); 
      };
      ws.onmessage = (ev) => { 
        console.log('📥 Mensaje recibido:', typeof ev.data, ev.data instanceof ArrayBuffer ? `${ev.data.byteLength} bytes` : ev.data.substring(0, 100));
        onMessageRef.current?.(ev); 
      };
    };

    connect();
    return () => { dead = true; clearTimeout(timer); try { wsRef.current?.close(); } catch { } };
  }, [url, reconnectMs]);

  const sendJSON = useCallback((obj: any) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('❌ WebSocket no está abierto. Estado:', ws?.readyState);
      return false;
    }
    const payload = JSON.stringify(obj);
    console.log('📤 Enviando JSON:', obj.type, payload.substring(0, 100));
    ws.send(payload);
    return true;
  }, []);

  const sendText = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('❌ WebSocket no está abierto');
      return false;
    }
    console.log('📤 Enviando texto:', text.substring(0, 100));
    ws.send(text);
    return true;
  }, []);

  const sendBinary = useCallback((bin: Blob | ArrayBuffer | Uint8Array) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('❌ WebSocket no está abierto');
      return false;
    }
    const size = bin instanceof Blob ? bin.size : bin.byteLength;
    console.log('📤 Enviando binario:', size, 'bytes');
    ws.send(bin);
    return true;
  }, []);

  return { connected, sendJSON, sendText, sendBinary };
}
