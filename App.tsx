import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrawingCanvas } from './components/DrawingCanvas';
import { useWebSocket } from './hooks/useWebSocket';
import { useHistory } from './hooks/useHistory';
import {
  ChevronDownIcon, ChevronUpIcon, UndoIcon, RedoIcon,
  BrushIcon, ClearIcon, ConnectIcon, DisconnectIcon
} from './components/icons';
import ColorPickerPro from './components/ColorPickerPro';

const randomRoomId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const WS_URL = (room: string) =>
  (location.protocol === 'https:' ? 'wss://' : 'ws://') +
  (location.host || 'localhost:8080') +
  `?room=${encodeURIComponent(room)}`;

type CanvasHistoryState = {
  dataUrl: string;
};

type LogEntry = {
  id: number;
  message: string;
  type: 'info' | 'error' | 'success';
  timestamp: number;
};

export default function App() {
  const initialRoom = useMemo(() => randomRoomId(), []);
  const [room, setRoom] = useState(initialRoom);
  const [roomInput, setRoomInput] = useState(initialRoom);

  const [brushColor, setBrushColor] = useState('#478792');
  const [brushSize, setBrushSize] = useState(10);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [eraser, setEraser] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [canvasSize, setCanvasSize] = useState(512);

  const [showRoomPanel, setShowRoomPanel] = useState(false);
  const [showPalettePanel, setShowPalettePanel] = useState(false);
  const [showLogPanel, setShowLogPanel] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [colorHistory, setColorHistory] = useState<string[]>([
    '#ff0040', '#3040a0', '#2050c0', '#4060e0', '#6070f0', '#8080ff', '#90a0ff', '#a0c0ff'
  ]);
  const [nextLogId, setNextLogId] = useState(1);

  const url = useMemo(() => WS_URL(room), [room]);

  const logScrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // WS
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { id: nextLogId, message, type, timestamp: Date.now() }]);
    setNextLogId(n => n + 1);
  }, [nextLogId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'l') setShowLogPanel(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSocketMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data !== 'string') return;
    try {
      const msg = JSON.parse(event.data);
      if (msg?.type === 'hello' && msg?.payload?.room) {
        const serverRoom = String(msg.payload.room).toUpperCase();
        setRoom((prev) => (prev === serverRoom ? prev : serverRoom));
        setRoomInput((prev) => (prev === serverRoom ? prev : serverRoom));
        addLog(`Conectado a sala: ${serverRoom}`, 'success');
      } else if (msg?.type === 'state') {
        addLog(`Estado recibido: ${msg?.payload?.state || 'N/A'}`, 'info');
      } else if (msg?.type === 'proc') {
        addLog(`Proc recibido: ${msg?.payload?.text || 'N/A'}`, 'info');
      }
    } catch {
      addLog('Mensaje no JSON recibido', 'error');
    }
  }, [addLog]);

  const { connected, sendJSON, sendBinary } = useWebSocket({
    url,
    onMessage: handleSocketMessage,
    reconnectMs: 2000
  });

  // History
  const { state: canvasHistoryState, setState: setCanvasHistoryState, undo, redo, canUndo, canRedo } =
    useHistory<CanvasHistoryState | null>(null);

  // Canvas sizing
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const paddingCompensation = 40; // margen
    const computeSize = () => {
      const bounds = stageEl.getBoundingClientRect();
      const available = Math.max(0, bounds.width - paddingCompensation);
      const next = Math.round(Math.min(512, Math.max(256, available || 512)));
      setCanvasSize((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    };

    computeSize();
    let resizeObserver: ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(computeSize);
      resizeObserver.observe(stageEl);
    } else {
      window.addEventListener('resize', computeSize);
    }
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', computeSize);
    };
  }, []);

  // Actions
  const saveCanvasState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setCanvasHistoryState({ dataUrl });
    addLog('Estado del canvas guardado', 'info');
  }, [setCanvasHistoryState, addLog]);

  const sendLiveFrame = useCallback((canvas: HTMLCanvasElement, options: { liveMax: number; liveJpegQ: number }) => {
    if (!connected) return;

    const { liveMax, liveJpegQ } = options;
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

    sendJSON({ type: 'draw', payload: { dataUrl } });
  }, [connected, sendJSON]);

  const handleFinalBlob = useCallback(async (blob: Blob) => {
    if (!connected) return;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      sendJSON({ type: 'draw-final', payload: { dataUrl: `data:image/png;base64,${base64}` } });
      addLog('Imagen final enviada', 'success');
    } catch {
      addLog('Error al convertir blob final', 'error');
    }
  }, [connected, sendJSON, addLog]);

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    saveCanvasState();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    addLog('Canvas borrado', 'info');
  }, [saveCanvasState, addLog]);

  const handleRoomSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    const next = roomInput.trim();
    if (!next) return;
    const normalized = next.toUpperCase();
    if (normalized === room) return;
    setRoom(normalized);
    setRoomInput(normalized);
    addLog(`Cambiando a sala: ${normalized}`, 'info');
  }, [room, roomInput, addLog]);

  const sendState = useCallback((state: string) => {
    if (!connected) return;
    sendJSON({ type: 'state', payload: { state } });
  }, [connected, sendJSON]);

  const sendPrompt = useCallback(() => {
    if (!connected) return;
    const text = prompt.trim();
    if (!text) return;
    sendJSON({ type: 'proc', payload: { text } });
    addLog(`Prompt enviado: ${text}`, 'success');
  }, [connected, prompt, sendJSON, addLog]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 100;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size).data;

        const samplePositions = [
          { x: size * 0.2, y: size * 0.2 },
          { x: size * 0.8, y: size * 0.2 },
          { x: size * 0.5, y: size * 0.5 },
          { x: size * 0.2, y: size * 0.8 },
          { x: size * 0.8, y: size * 0.8 },
        ];

        const colors = samplePositions.map(pos => {
          const i = (Math.floor(pos.y) * size + Math.floor(pos.x)) * 4;
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
        });

        setColorHistory(prev => {
          const merged = [...colors, ...prev];
          return Array.from(new Set(merged)).slice(0, 24);
        });
        addLog('Paleta de colores extraída de la imagen', 'success');
      };
      img.src = String(event.target?.result || '');
    };
    reader.readAsDataURL(file);
  }, [addLog]);

  return (
    <main className="app">
      <img src="/logo.png" alt="Logo" className="page-logo" />

      {/* Panel lateral de control */}
      <aside role="complementary" aria-label="Panel de control" className="panel">
        {/* Estado de conexión + sala */}
        <div className="connection-status">
          <div className="status-indicator">
            <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
            <span>Conexión {connected ? 'activa' : 'inactiva'}</span>
          </div>
          <button onClick={() => setShowRoomPanel(!showRoomPanel)} className="dropdown-toggle" aria-label="Ver sala">
            Ver sala {showRoomPanel ? <ChevronUpIcon className="toggle-icon" /> : <ChevronDownIcon className="toggle-icon" />}
          </button>
        </div>

        {showRoomPanel && (
          <div className="collapsible">
            <div className="collapsible-content">
              <form onSubmit={handleRoomSubmit}>
                <label>
                  Sala
                  <input
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    aria-label="Nombre de la sala"
                  />
                </label>
                <button className="btn-join" type="submit">Cambiar de sala</button>
              </form>
            </div>
          </div>
        )}

        {/* Conectar / Desconectar */}
        <div className="row">
          {!connected ? (
            <button className="connect-button" onClick={() => location.assign(WS_URL(room))} aria-label="Conectar (abrir WS)">
              <ConnectIcon className="icon" /> Conectar
            </button>
          ) : (
            <button className="disconnect-button" onClick={() => location.reload()} aria-label="Desconectar">
              <DisconnectIcon className="icon" /> Desconectar
            </button>
          )}
        </div>

        {/* Prompt */}
        <div className="col">
          <label>
            Prompt
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              aria-label="Texto de prompt"
              placeholder="Escribe tu mensaje/proc..."
            />
          </label>
          <button type="button" className="send-button" onClick={sendPrompt}>Enviar mensaje</button>
        </div>

        {/* Color */}
        <div className="col">
          <h3>Color</h3>
          <ColorPickerPro
            value={brushColor}
            onChange={(hex) => setBrushColor(hex)}
            recent={colorHistory}
            onPickRecent={(hex) => setBrushColor(hex)}
          />

          <div className="image-upload" style={{ marginTop: 12 }}>
            <button className="dropdown-toggle" onClick={() => setShowPalettePanel(!showPalettePanel)}>
              {showPalettePanel ? 'Ocultar opciones de paleta' : 'Opciones de paleta'}
              {showPalettePanel ? <ChevronUpIcon className="toggle-icon" /> : <ChevronDownIcon className="toggle-icon" />}
            </button>
            {showPalettePanel && (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  aria-label="Subir imagen para extraer paleta"
                  style={{ marginTop: 8 }}
                />
                {colorHistory.length > 0 && (
                  <div className="palette" style={{ marginTop: 10 }}>
                    {colorHistory.map((c, i) => (
                      <button
                        key={c + i}
                        className="swatch"
                        style={{ backgroundColor: c }}
                        onClick={() => setBrushColor(c)}
                        aria-label={`Seleccionar color ${c}`}
                        title={c}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Pincel */}
        <div className="col">
          <h3>Ajustes del pincel</h3>

          <div className="slider-container">
            <label>
              Grosor
              <input
                type="range"
                min={1}
                max={80}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                aria-label="Grosor del pincel"
              />
            </label>
          </div>

          <div className="slider-container">
            <label>
              Opacidad
              <input
                type="range"
                min={1}
                max={100}
                value={brushOpacity}
                onChange={(e) => setBrushOpacity(Number(e.target.value))}
                aria-label="Opacidad del pincel"
              />
            </label>
          </div>

          <div className="row" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button
              className={`tool-button ${!eraser ? 'active' : ''}`}
              onClick={() => setEraser(false)}
              aria-pressed={!eraser}
              aria-label="Pincel"
            >
              <BrushIcon className="tool-icon" /> Pincel
            </button>
            <button
              className={`tool-button ${eraser ? 'active' : ''}`}
              onClick={() => setEraser(true)}
              aria-pressed={eraser}
              aria-label="Borrador"
            >
              <ClearIcon className="tool-icon" /> Borrador
            </button>
          </div>

          <div className="row" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button className="history-button" onClick={undo} disabled={!canUndo} aria-label="Deshacer">
              <UndoIcon className="tool-icon" /> Deshacer
            </button>
            <button className="history-button" onClick={redo} disabled={!canRedo} aria-label="Rehacer">
              <RedoIcon className="tool-icon" /> Rehacer
            </button>
          </div>

          <div className="row" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button className="action-button" onClick={saveCanvasState} aria-label="Guardar estado de canvas">
              Guardar estado
            </button>
            <button className="action-button clear" onClick={clearCanvas} aria-label="Borrar lienzo">
              Borrar lienzo
            </button>
          </div>
        </div>
      </aside>

      {/* Stage */}
      <section className="stage" ref={stageRef as any}>
        <div className="canvas-frame">
          <DrawingCanvas
            ref={canvasRef as any}
            size={canvasSize}
            brushColor={brushColor}
            brushOpacity={brushOpacity}
            eraser={eraser}
            onLiveFrame={sendLiveFrame}
            onFinalBlob={handleFinalBlob}
            onDrawStart={() => sendState('drawing:start')}
            onDrawEnd={() => sendState('drawing:end')}
            connected={connected}
          />
        </div>

        {/* LOG */}
        <div className={`log-container ${showLogPanel ? 'expanded' : ''}`} role="region" aria-label="Consola de eventos">
          <div className="log-header">
            <strong>Logs</strong>
            <button className="log-hide" onClick={() => setShowLogPanel(false)} aria-label="Ocultar log">✕</button>
          </div>
          <div className="log-window" ref={logScrollRef}>
            {logs.map(log => (
              <div key={log.id} className={`log-entry log-entry-${log.type}`}>
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))}
            {logs.length === 0 && <div className="log-entry">No hay entradas aún</div>}
          </div>
        </div>
      </section>

      {/* Botón flotante para mostrar/ocultar log */}
      <button
        className="log-fab"
        aria-label={showLogPanel ? 'Ocultar log' : 'Mostrar log'}
        onClick={() => setShowLogPanel(v => !v)}
        title={showLogPanel ? 'Ocultar log (L)' : 'Mostrar log (L)'}
      >
        {showLogPanel ? '✕' : 'LOG'}
      </button>
    </main>
  );
}
