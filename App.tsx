import React, { useCallback, useMemo, useRef, useState } from 'react';
import DrawingCanvas, { DrawingCanvasRef } from './DrawingCanvas';
import ControlPanel from './ControlPanel';
import { useWebSocket } from './useWebSocket';

// Lee room de la URL o crea una
const ROOM = new URLSearchParams(location.search).get('room') || Math.random().toString(36).slice(2);

// Construye la URL de WS en base al host actual o a VITE_WS_URL si lo configuras
function buildWsUrlBase(room: string): string {
  const envUrl = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  if (envUrl) {
    const u = new URL(envUrl);
    u.pathname = '/ws';
    if (!u.searchParams.has('room')) u.searchParams.set('room', room);
    if (!u.searchParams.has('role')) u.searchParams.set('role', 'canvas');
    return u.toString();
  }
  const { protocol, host } = window.location;
  const scheme = protocol === 'https:' ? 'wss' : 'ws';
  const u = new URL(`${scheme}://${host}/ws`);
  u.searchParams.set('room', room);
  u.searchParams.set('role', 'canvas');
  return u.toString();
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [color, setColor] = useState('#ff4d4d');
  const [brushSize, setBrushSize] = useState(16);
  const [mode, setMode] = useState<'brush' | 'eraser'>('brush');

  const wsUrl = useMemo(() => buildWsUrlBase(ROOM), []);
  const { connectionStatus, connect, disconnect, sendMessage } = useWebSocket(wsUrl, {
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectInterval: 1000,
  });

  const canvasRef = useRef<DrawingCanvasRef | null>(null);

  // Enviar prompt a TD
  const sendPrompt = useCallback(() => {
    const msg = JSON.stringify({ type: 'prompt', payload: prompt });
    sendMessage(msg);
  }, [prompt, sendMessage]);

  // Recibir snapshot raster del canvas (si quieres raster en TD)
  const onFrame = useCallback((dataUrl: string) => {
    // manda imagen comprimida (puedes recortar/optimizar en TD)
    sendMessage(JSON.stringify({ type: 'canvas', payload: dataUrl }));
  }, [sendMessage]);

  // Enviar stroke vectorial (si quieres vector en TD)
  const onStroke = useCallback((stroke: any) => {
    sendMessage(JSON.stringify({ type: 'stroke', payload: stroke }));
  }, [sendMessage]);

  // Acciones de historia
  const undo = useCallback(() => canvasRef.current?.undo(), []);
  const redo = useCallback(() => canvasRef.current?.redo(), []);
  const clearCanvas = useCallback(() => canvasRef.current?.clear(), []);

  const connected = connectionStatus === 'CONNECTED';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: '100dvh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <ControlPanel
        room={ROOM}
        connected={connected}
        prompt={prompt}
        setPrompt={setPrompt}
        sendPrompt={sendPrompt}
        color={color}
        setColor={setColor}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        mode={mode}
        setMode={setMode}
        undo={undo}
        redo={redo}
        clearCanvas={clearCanvas}
        canUndo={true}
        canRedo={true}
      />

      <div style={{ display: 'grid', placeItems: 'center', padding: 16 }}>
        <div
          style={{
            width: 'min(90vw, 1024px)',
            aspectRatio: '1/1',
            border: '1px solid #1e293b',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#0b1220',
          }}
        >
          <DrawingCanvas
            ref={canvasRef}
            color={color}
            brushSize={brushSize}
            onStroke={onStroke}
            onFrame={onFrame}
            rasterFps={8}
            targetSize={512}
            // modo pincel/borrador: tu componente lo lee desde props
            mode={mode}
          />
        </div>

        {/* Controles de conexión */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={connect} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0b1220', color: '#e2e8f0' }}>
            Conectar
          </button>
          <button onClick={disconnect} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0b1220', color: '#e2e8f0' }}>
            Desconectar
          </button>
          <span style={{ alignSelf: 'center', opacity: .8 }}>Estado: {connectionStatus}</span>
        </div>
      </div>
    </div>
  );
}
