import React, { useCallback, useMemo, useRef, useState } from 'react';
import DrawingCanvas, { DrawingCanvasRef } from './components/DrawingCanvas';
import ControlPanel from './components/ControlPanel';
import { useWebSocket } from './hooks/useWebSocket';

const ROOM = new URLSearchParams(window.location.search).get('room') || Math.random().toString(36).slice(2);

function buildWsUrlBase(room: string): string {
  const envUrl = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  if (envUrl) {
    const u = new URL(envUrl);
    u.pathname = '/ws';
    if (!u.searchParams.has('room')) u.searchParams.set('room', room);
    if (!u.searchParams.has('role')) u.searchParams.set('role', 'canvas');
    return u.toString();
  }
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const u = new URL(`${scheme}://${window.location.host}/ws`);
  u.searchParams.set('room', room);
  u.searchParams.set('role', 'canvas');
  return u.toString();
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [color, setColor] = useState('#ff4d4d');
  const [brushSize, setBrushSize] = useState(14);
  const [mode, setMode] = useState<'brush' | 'eraser'>('brush');

  const wsUrl = useMemo(() => buildWsUrlBase(ROOM), []);
  const { connectionStatus, connect, disconnect, sendMessage } = useWebSocket(wsUrl, {
    autoReconnect: true,
    maxReconnectAttempts: 10,
    reconnectInterval: 1000,
  });

  const canvasRef = useRef<DrawingCanvasRef | null>(null);

  const sendPrompt = useCallback(() => {
    sendMessage(JSON.stringify({ type: 'prompt', payload: prompt, room: ROOM }));
  }, [prompt, sendMessage]);

  const onFrame = useCallback((dataUrl: string) => {
    sendMessage(JSON.stringify({ type: 'canvas', payload: dataUrl, room: ROOM }));
  }, [sendMessage]);

  const onStroke = useCallback((stroke: any) => {
    sendMessage(JSON.stringify({ type: 'stroke', payload: stroke, room: ROOM }));
  }, [sendMessage]);

  const undo = useCallback(() => canvasRef.current?.undo(), []);
  const redo = useCallback(() => canvasRef.current?.redo(), []);
  const clearCanvas = useCallback(() => canvasRef.current?.clear(), []);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(280px, 320px) 1fr',
      height: '100dvh',
      background: '#0f172a',
      color: '#e2e8f0',
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto'
    }}>
      <ControlPanel
        room={ROOM}
        connected={connectionStatus === 'CONNECTED'}
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
        onConnect={connect}
        onDisconnect={disconnect}
        connectionStatus={connectionStatus}
      />

      <div style={{ display: 'grid', placeItems: 'center', padding: 16 }}>
        <div
          style={{
            width: 'min(92vw, 1280px)',
            aspectRatio: '1 / 1',
            border: '1px solid #1e293b',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#0b1220',
          }}
        >
          <DrawingCanvas
            ref={canvasRef}
            color={color}
            brushSize={mode === 'eraser' ? 32 : brushSize}
            onStroke={onStroke}
            onFrame={onFrame}
            rasterFps={8}
            targetSize={512}
            mode={mode}
          />
        </div>
      </div>
    </div>
  );
}
