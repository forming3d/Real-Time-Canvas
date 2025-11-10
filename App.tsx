import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrawingCanvas } from './components/DrawingCanvas';
import { useWebSocket } from './hooks/useWebSocket';
import { useHistory } from './hooks/useHistory';
import {
  ChevronDownIcon, ChevronUpIcon, UndoIcon, RedoIcon,
  BrushIcon, ClearIcon
} from './components/icons';
import ColorPickerPro from './components/ColorPickerPro';

type CanvasHistoryState = { dataUrl: string };
type LogEntry = { id: number; message: string; type: 'info' | 'error' | 'success'; timestamp: number };

const randomRoomId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// ⬅️ tu server escucha en /ws
const WS_URL = (room: string) =>
  (location.protocol === 'https:' ? 'wss://' : 'ws://') +
  (location.host || 'localhost:8080') +
  `/ws?room=${encodeURIComponent(room)}`;

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

  // Historial para Undo/Redo por imagen
  const { state: canvasHistoryState, setState: setCanvasHistoryState, undo, redo, canUndo, canRedo } =
    useHistory<CanvasHistoryState | null>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { id: nextLogId, message, type, timestamp: Date.now() }]);
    setNextLogId(n => n + 1);
  }, [nextLogId]);

  const handleSocketMessage = useCallback((event: MessageEvent) => {
    // json o binario (Touch manda PNG como binario -> no nos afecta aquí)
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === 'hello' && msg?.payload?.room) {
          const serverRoom = String(msg.payload.room).toUpperCase();
          setRoom(serverRoom);
          setRoomInput(serverRoom);
          addLog(`Conectado a sala: ${serverRoom}`, 'success');
        } else if (msg?.type === 'state') {
          addLog(`Estado recibido: ${String(msg?.payload)}`, 'info');
        } else if (msg?.type === 'proc') {
          addLog(`Proc recibido: ${String(msg?.payload)}`, 'info');
        }
      } catch { /* ignorar no-JSON */ }
    }
  }, [addLog]);

  const { connected, sendJSON, sendBinary } = useWebSocket({
    url,
    onMessage: handleSocketMessage,
    reconnectMs: 2000
  });

  useEffect(() => {
    if (logScrollRef.current)
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'l') setShowLogPanel(v => !v); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Tamaño canvas (tablet horizontal)
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const computeSize = () => {
      const b = stageEl.getBoundingClientRect();
      const available = Math.max(0, b.width - 40);
      const next = Math.round(Math.min(512, Math.max(256, available || 512)));
      setCanvasSize(prev => (Math.abs(prev - next) > 1 ? next : prev));
    };
    computeSize();
    let ro: ResizeObserver | null = null;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(computeSize); ro.observe(stageEl); }
    else { window.addEventListener('resize', computeSize); }
    return () => { ro?.disconnect(); window.removeEventListener('resize', computeSize); };
  }, []);

  // Restaurar snapshot sin re-escalar (coordenadas lógicas)
  useEffect(() => {
    if (!canvasHistoryState?.dataUrl || !canvasRef.current) return;
    const c = canvasRef.current;
    const ctx = c.getContext('2d'); if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = c.width / dpr, H = c.height / dpr;

    const img = new Image();
    img.onload = () => { ctx.clearRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H); };
    img.src = canvasHistoryState.dataUrl;
  }, [canvasHistoryState]);

  // --- PROTOCOLO CORRECTO PARA TOUCH --- //
  // draw       -> payload: string "data:image/jpeg;base64,..."
  // state      -> payload: string "drawing:start" | "drawing:end"
  // proc/prompt-> payload: string "texto"
  // final PNG  -> binario (onReceiveBinary)
  const sendLiveFrame = useCallback((canvas: HTMLCanvasElement, opts: { liveMax: number; liveJpegQ: number }) => {
    if (!connected) return;
    const { liveMax, liveJpegQ } = opts;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr, H = canvas.height / dpr;
    const scale = Math.min(1, liveMax / Math.max(W, H));

    let dataUrl: string;
    if (scale < 1) {
      const w = Math.round(W * scale), h = Math.round(H * scale);
      const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext('2d'); if (!tctx) return;
      tctx.drawImage(canvas, 0, 0, w, h);
      dataUrl = tmp.toDataURL('image/jpeg', liveJpegQ);
    } else {
      dataUrl = canvas.toDataURL('image/jpeg', liveJpegQ);
    }

    // ⬅️ payload como STRING (no objeto)
    sendJSON({ type: 'draw', payload: dataUrl });
  }, [connected, sendJSON]);

  const handleFinalBlob = useCallback(async (blob: Blob) => {
    if (!connected) return;
    // ⬅️ PNG final como BINARIO (Touch -> onReceiveBinary)
    sendBinary(blob);
    addLog('PNG final enviado (binario)', 'success');
  }, [connected, sendBinary, addLog]);

  const sendState = useCallback((state: 'drawing:start' | 'drawing:end') => {
    if (!connected) return;
    // ⬅️ payload como STRING
    sendJSON({ type: 'state', payload: state });
  }, [connected, sendJSON]);

  const sendPrompt = useCallback(() => {
    if (!connected) return;
    const text = prompt.trim(); if (!text) return;
    // ⬅️ payload como STRING
    sendJSON({ type: 'proc', payload: text });
    addLog(`Prompt enviado: ${text}`, 'success');
  }, [connected, prompt, sendJSON, addLog]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = 100; c.height = 100;
        const ctx = c.getContext('2d'); if (!ctx) return;
        ctx.drawImage(img, 0, 0, 100, 100);
        const data = ctx.getImageData(0, 0, 100, 100).data;
        const pts = [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 50, y: 50 }, { x: 20, y: 80 }, { x: 80, y: 80 }];
        const colors = pts.map(p => {
          const i = (Math.floor(p.y) * 100 + Math.floor(p.x)) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
        });
        setColorHistory(prev => Array.from(new Set([...colors, ...prev])).slice(0, 24));
        addLog('Paleta extraída de la imagen', 'success');
      };
      img.src = String(event.target?.result || '');
    };
    reader.readAsDataURL(file);
  }, [addLog]);

  const handleCopyLink = useCallback(async () => {
    const link = WS_URL(roomInput || room);
    try { await navigator.clipboard.writeText(link); addLog('Link WSS copiado', 'success'); }
    catch {
      const ta = document.createElement('textarea'); ta.value = link;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      addLog('Link WSS copiado (fallback)', 'success');
    }
  }, [room, roomInput, addLog]);

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    addLog('Canvas borrado', 'info');
  }, [addLog]);

  return (
    <main className="app">
      <img src="/logo.png" alt="Logo" className="page-logo" />

      <aside role="complementary" aria-label="Panel de control" className="panel">
        <div className="connection-status">
          <div className="status-indicator">
            <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
            <span>{connected ? 'Conectado' : 'Desconectado'}</span>
          </div>
          <button onClick={() => setShowRoomPanel(v => !v)} className="btn btn-ghost btn-sm" aria-label="Ver sala">
            {showRoomPanel ? <ChevronUpIcon className="toggle-icon" /> : <ChevronDownIcon className="toggle-icon" />} Ver sala
          </button>
        </div>

        {showRoomPanel && (
          <div className="collapsible">
            <div className="collapsible-content">
              <p className="info-text">
                Comparte este <strong>link WSS</strong> con el receptor (TouchDesigner, Node, Python…).<br />
                <small>El receptor debe conectarse por WebSocket a esta URL para unirse a tu sala.</small>
              </p>
              <label className="label-inline">
                Sala
                <input value={roomInput} onChange={(e) => setRoomInput(e.target.value.toUpperCase())} aria-label="Nombre de la sala" />
              </label>
              <div className="room-actions">
                <input className="room-link" readOnly value={WS_URL(roomInput || room)} aria-label="Link WSS" />
                <button className="btn btn-primary btn-sm" onClick={handleCopyLink}>Copiar link</button>
              </div>
            </div>
          </div>
        )}

        <div className="section">
          <label>
            Prompt
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Texto de prompt" placeholder="Escribe tu mensaje/proc..." />
          </label>
          <button type="button" className="btn btn-primary btn-sm" onClick={sendPrompt}>Enviar</button>
        </div>

        <div className="section">
          <h3>Color</h3>
          <ColorPickerPro
            value={brushColor}
            onChange={(hex) => setBrushColor(hex)}
            recent={colorHistory}
            onPickRecent={(hex) => setBrushColor(hex)}
          />
          <div className="image-upload" style={{ marginTop: 12 }}>
            <button className="btn btn-ghost btn-pill btn-xs" onClick={() => setShowPalettePanel(v => !v)}>
              {showPalettePanel ? <ChevronUpIcon className="toggle-icon" /> : <ChevronDownIcon className="toggle-icon" />} Opciones de paleta
            </button>
            {showPalettePanel && (
              <>
                <input type="file" accept="image/*" onChange={handleImageUpload} aria-label="Subir imagen para extraer paleta" style={{ marginTop: 8 }} />
                {colorHistory.length > 0 && (
                  <div className="palette" style={{ marginTop: 10 }}>
                    {colorHistory.map((c, i) => (
                      <button key={c + i} className="swatch" style={{ backgroundColor: c }}
                        onClick={() => setBrushColor(c)} aria-label={`Seleccionar color ${c}`} title={c} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="section">
          <h3>Pincel</h3>
          <div className="slider-container">
            <label>Grosor
              <input type="range" min={1} max={80} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} aria-label="Grosor del pincel" />
            </label>
          </div>
          <div className="slider-container">
            <label>Opacidad
              <input type="range" min={1} max={100} value={brushOpacity} onChange={(e) => setBrushOpacity(Number(e.target.value))} aria-label="Opacidad del pincel" />
            </label>
          </div>
          <div className="toolbar">
            <button className={`btn btn-ghost btn-sm ${!eraser ? 'active' : ''}`} onClick={() => setEraser(false)} aria-label="Pincel" title="Pincel">
              <BrushIcon className="tool-icon" /> Pincel
            </button>
            <button className={`btn btn-ghost btn-sm ${eraser ? 'active' : ''}`} onClick={() => setEraser(true)} aria-label="Borrador" title="Borrador">
              <ClearIcon className="tool-icon" /> Borrador
            </button>
            <button className="btn btn-muted btn-sm" onClick={undo} disabled={!canUndo} title="Deshacer"><UndoIcon className="tool-icon" /> Undo</button>
            <button className="btn btn-muted btn-sm" onClick={redo} disabled={!canRedo} title="Rehacer"><RedoIcon className="tool-icon" /> Redo</button>
            <button className="btn btn-danger btn-sm" onClick={clearCanvas} aria-label="Borrar lienzo">Borrar</button>
          </div>
        </div>
      </aside>

      <section className="stage" ref={stageRef as any}>
        <div className="canvas-frame">
          <DrawingCanvas
            ref={canvasRef as any}
            width={canvasSize}
            height={canvasSize}
            brushColor={brushColor}
            brushOpacity={brushOpacity}
            brushSize={brushSize}
            eraser={eraser}
            onLiveFrame={(c) => sendLiveFrame(c, { liveMax: 256, liveJpegQ: 0.5 })}
            onFinalBlob={(b) => { handleFinalBlob(b); }}
            onDrawStart={() => sendState('drawing:start')}
            onDrawEnd={() => {
              const c = canvasRef.current;
              if (c) setCanvasHistoryState({ dataUrl: c.toDataURL('image/png') });
              sendState('drawing:end');
            }}
            connected={connected}
          />
        </div>

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

      <button className="log-fab" aria-label={showLogPanel ? 'Ocultar log' : 'Mostrar log'}
        onClick={() => setShowLogPanel(v => !v)} title={showLogPanel ? 'Ocultar log (L)' : 'Mostrar log (L)'}>
        {showLogPanel ? '✕' : 'LOG'}
      </button>
    </main>
  );
}
