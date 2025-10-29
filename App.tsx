import React, { useCallback, useMemo, useRef, useState } from 'react';
import DrawingCanvas, { DrawingCanvasRef } from './components/DrawingCanvas';
import ControlPanel from './components/ControlPanel';
import { useWebSocket } from './hooks/useWebSocket';

const ROOM =
  new URLSearchParams(location.search).get('room') ??
  Math.random().toString(36).slice(2);

function buildWsUrl(room: string) {
  const env = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  if (env) {
    const u = new URL(env);
    u.pathname = '/ws';
    u.searchParams.set('room', room);
    u.searchParams.set('role', 'canvas');
    return u.toString();
  }
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const u = new URL(`${scheme}://${location.host}/ws`);
  u.searchParams.set('room', room);
  u.searchParams.set('role', 'canvas');
  return u.toString();
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [color, setColor] = useState('#00e5ff');
  const [brushSize, setBrushSize] = useState(14);
  const [mode, setMode] = useState<'brush' | 'eraser'>('brush');

  const wsUrl = useMemo(() => buildWsUrl(ROOM), []);
  const { connectionStatus, sendMessage, connect, disconnect } = useWebSocket(
    wsUrl,
    { autoReconnect: true, maxReconnectAttempts: 10, reconnectInterval: 1200 }
  );

  const canvasRef = useRef<DrawingCanvasRef | null>(null);

  const onStroke = useCallback(
    (stroke: any) => {
      sendMessage(JSON.stringify({ type: 'stroke', payload: stroke }));
    },
    [sendMessage]
  );

  const onFrame = useCallback(
    (dataUrl: string) => {
      sendMessage(JSON.stringify({ type: 'canvas', payload: dataUrl }));
    },
    [sendMessage]
  );

  const sendPrompt = useCallback(() => {
    sendMessage(JSON.stringify({ type: 'prompt', payload: prompt }));
  }, [prompt, sendMessage]);

  const undo = useCallback(() => canvasRef.current?.undo(), []);
  const redo = useCallback(() => canvasRef.current?.redo(), []);
  const clear = useCallback(() => canvasRef.current?.clear(), []);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: 16,
        padding: 16,
        minHeight: '100dvh'
      }}
    >
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
        clearCanvas={clear}
      />

      <main
        style={{
          display: 'grid',
          placeItems: 'center',
          width: '100%',
          height: 'calc(100dvh - 32px)'
        }}
      >
        <div
          style={{
            width: 'min(96vw, 1100px)',
            aspectRatio: '1/1',
            border: '1px solid #1e293b',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#0b1220'
          }}
          aria-label="Lienzo interactivo"
        >
          <DrawingCanvas
            ref={canvasRef}
            color={color}
            brushSize={brushSize}
            mode={mode}
            onStroke={onStroke}
            onFrame={onFrame}
            rasterFps={8}
            targetSize={768}
          />
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={connect}>Conectar WS</button>
          <button onClick={disconnect}>Desconectar WS</button>
          <span style={{ alignSelf: 'center', opacity: 0.75 }}>
            Estado: {connectionStatus}
          </span>
        </div>
      </main>
    </div>
  );
}
