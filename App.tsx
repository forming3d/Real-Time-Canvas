// App.tsx
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrawingCanvas } from './components/DrawingCanvas';
import { useWebSocket } from './hooks/useWebSocket';

const randomRoomId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const WS_URL = (room: string) =>
  (location.protocol === 'https:' ? 'wss://' : 'ws://') +
  (location.host || 'localhost:8080') +
  `?room=${encodeURIComponent(room)}`;

export default function App() {
  const initialRoom = useMemo(() => randomRoomId(), []);
  const [room, setRoom] = useState(initialRoom);
  const [roomInput, setRoomInput] = useState(initialRoom);
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(10);
  const [eraser, setEraser] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [canvasSize, setCanvasSize] = useState(512);

  const url = useMemo(() => WS_URL(room), [room]);
  const handleSocketMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data !== 'string') return;
    try {
      const msg = JSON.parse(event.data);
      if (msg?.type === 'hello' && msg?.payload?.room) {
        const serverRoom = String(msg.payload.room).toUpperCase();
        setRoom((prev) => (prev === serverRoom ? prev : serverRoom));
        setRoomInput((prev) => (prev === serverRoom ? prev : serverRoom));
      }
    } catch (err) {
      console.warn('Mensaje WS inválido', err);
    }
  }, []);

  const { connected, sendJSON, sendBinary } = useWebSocket({ url, onMessage: handleSocketMessage });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const paddingCompensation = 24; // stage padding 12px a cada lado
    const computeSize = () => {
      const bounds = stageEl.getBoundingClientRect();
      const available = Math.max(0, bounds.width - paddingCompensation);
      const next = Math.round(
        Math.min(512, Math.max(256, available || 512))
      );
      setCanvasSize((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    };

    computeSize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => computeSize());
      resizeObserver.observe(stageEl);
    }

    window.addEventListener('resize', computeSize);
    window.addEventListener('orientationchange', computeSize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', computeSize);
      window.removeEventListener('orientationchange', computeSize);
    };
  }, []);

  const sendLiveFrame = useCallback((canvas: HTMLCanvasElement, { liveMax, liveJpegQ }: { liveMax: number; liveJpegQ: number }) => {
    if (!connected) return;

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    const scale = Math.min(1, liveMax / Math.max(logicalWidth, logicalHeight));
    let dataUrl: string;

    if (scale < 1) {
      const w = Math.round(logicalWidth * scale);
      const h = Math.round(logicalHeight * scale);
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext('2d');
      if (!tctx) return;
      tctx.drawImage(canvas, 0, 0, w, h);
      dataUrl = tmp.toDataURL('image/jpeg', liveJpegQ);
    } else {
      dataUrl = canvas.toDataURL('image/jpeg', liveJpegQ);
    }

    sendJSON({ type: 'draw', payload: dataUrl });
  }, [connected, sendJSON]);

  // PNG final -> binario
  const handleFinalBlob = useCallback((blob: Blob) => {
    if (!connected) return;
    blob.arrayBuffer().then((ab) => {
      sendBinary(ab); // binario (onReceiveBinary en TD)
    });
  }, [connected, sendBinary]);

  // Estado de dibujo (para lock en TD)
  const sendState = useCallback((s: 'drawing:start' | 'drawing:end') => {
    sendJSON({ type: 'state', payload: s });
  }, [sendJSON]);

  const sendPrompt = useCallback(() => {
    sendJSON({ type: 'proc', payload: prompt });
  }, [prompt, sendJSON]);

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
  }, []);

  const handleRoomSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    const next = roomInput.trim();
    if (!next) return;
    const normalized = next.toUpperCase();
    if (normalized === room) return;
    setRoom(normalized);
    setRoomInput(normalized);
  }, [room, roomInput]);

  return (
    <main className="app">
      <aside role="complementary" aria-label="Panel de control" className="panel">
        <form className="row" onSubmit={handleRoomSubmit}>
          <label>
            Sala:
            <input
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="p. ej. X7Q4PF"
              aria-label="Nombre de la sala"
            />
          </label>
          <button type="submit" className="btn" aria-label="Cambiar sala">
            Cambiar
          </button>
          <span aria-live="polite" aria-label={connected ? 'Conectado' : 'Desconectado'}>
            {connected ? '🟢' : '🔴'}
          </span>
        </form>

        <div className="row">
          <label>
            Color
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              aria-label="Color de brocha"
            />
          </label>

          <label>
            Grosor
            <input
              type="range"
              min={1}
              max={64}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              aria-valuemin={1}
              aria-valuemax={64}
              aria-valuenow={brushSize}
              aria-label="Grosor de brocha"
            />
          </label>

          <button
            type="button"
            className="btn"
            onClick={() => setEraser(v => !v)}
            aria-pressed={eraser}
            aria-label="Alternar goma de borrar"
            title="Goma"
          >
            {eraser ? 'Goma ON' : 'Goma OFF'}
          </button>

          <button
            type="button"
            className="btn"
            onClick={clearCanvas}
            aria-label="Borrar lienzo"
            title="Borrar lienzo"
          >
            Borrar
          </button>
        </div>

        <div className="col">
          <label>
            Prompt
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Escribe el prompt…"
              aria-label="Texto de prompt"
            />
          </label>
          <button type="button" className="btn" onClick={sendPrompt}>Enviar prompt</button>
        </div>
      </aside>

      <section className="stage" ref={stageRef}>
        <div
          className="canvas-frame"
          style={{ width: `${canvasSize}px`, height: `${canvasSize}px` }}
        >
          <DrawingCanvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            brushSize={brushSize}
            brushColor={brushColor}
            eraser={eraser}
            onLiveFrame={sendLiveFrame}
            onFinalBlob={handleFinalBlob}
            onDrawStart={() => sendState('drawing:start')}
            onDrawEnd={() => sendState('drawing:end')}
            connected={connected}
          />
        </div>
      </section>
    </main>
  );
}
