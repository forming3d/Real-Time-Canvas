// App.tsx
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrawingCanvas } from './components/DrawingCanvas';
import { useWebSocket } from './hooks/useWebSocket';
import { useHistory } from './hooks/useHistory';
import {
  ChevronDownIcon, ChevronUpIcon, UndoIcon, RedoIcon, SendIcon,
  BrushIcon, ClearIcon, ConnectIcon, DisconnectIcon
} from './components/icons';

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
  const [colorPickerPosition, setColorPickerPosition] = useState({ x: 0, y: 0 });
  const [showRoomPanel, setShowRoomPanel] = useState(false);
  const [showPalettePanel, setShowPalettePanel] = useState(false);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [colorHistory, setColorHistory] = useState<string[]>(['#478792', '#3040a0', '#2050c0', '#4060e0', '#6070f0', '#8080ff', '#90a0ff', '#a0c0ff']);
  const [nextLogId, setNextLogId] = useState(1);

  const url = useMemo(() => WS_URL(room), [room]);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  
  const { state: canvasHistoryState, setState: setCanvasHistoryState, undo, redo, canUndo, canRedo } = 
    useHistory<CanvasHistoryState | null>(null);

  const handleSocketMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data !== 'string') return;
    try {
      const msg = JSON.parse(event.data);
      if (msg?.type === 'hello' && msg?.payload?.room) {
        const serverRoom = String(msg.payload.room).toUpperCase();
        setRoom((prev) => (prev === serverRoom ? prev : serverRoom));
        setRoomInput((prev) => (prev === serverRoom ? prev : serverRoom));
        addLog(`Conectado a sala: ${serverRoom}`, 'success');
      }
    } catch (err) {
      console.warn('Mensaje WS inválido', err);
      addLog('Error al procesar mensaje WebSocket', 'error');
    }
  }, []);

  const { connected, sendJSON, sendBinary } = useWebSocket({ 
    url, 
    onMessage: handleSocketMessage,
    reconnectMs: 2000
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);

  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [...prev, {
      id: nextLogId,
      message,
      type,
      timestamp: Date.now()
    }]);
    setNextLogId(prev => prev + 1);
  }, [nextLogId]);

  // Scroll logs to bottom when new logs are added
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const paddingCompensation = 40; // Increased padding for better framing
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

    addLog('Aplicación inicializada correctamente', 'info');

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', computeSize);
      window.removeEventListener('orientationchange', computeSize);
    };
  }, []);

  useEffect(() => {
    if (connected) {
      addLog('Conexión WebSocket establecida', 'success');
    } else {
      addLog('Conexión WebSocket perdida', 'error');
    }
  }, [connected]);

  const saveCanvasState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    setCanvasHistoryState({ dataUrl });
    addLog('Estado del canvas guardado', 'info');
  }, [setCanvasHistoryState]);

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
    if (s === 'drawing:end') {
      saveCanvasState();
    }
  }, [sendJSON, saveCanvasState]);

  const sendPrompt = useCallback(() => {
    if (prompt.trim() === '') return;
    
    sendJSON({ type: 'proc', payload: prompt });
    addLog(`Prompt enviado: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}`, 'info');
  }, [prompt, sendJSON]);

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    
    // Save current state before clearing
    saveCanvasState();
    
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    
    addLog('Canvas borrado', 'info');
  }, [saveCanvasState]);

  const handleRoomSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    const next = roomInput.trim();
    if (!next) return;
    const normalized = next.toUpperCase();
    if (normalized === room) return;
    setRoom(normalized);
    setRoomInput(normalized);
    addLog(`Cambiando a sala: ${normalized}`, 'info');
  }, [room, roomInput]);

  // Throttle state updates for smoother color picker
  const lastUpdateRef = useRef(0);
  
  const handleColorPickerChange = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!colorPickerRef.current) return;
    
    // Throttle updates to improve performance
    const now = performance.now();
    if (now - lastUpdateRef.current < 16) { // Aproximadamente 60fps
      return; // Skip this update if less than 16ms has passed
    }
    lastUpdateRef.current = now;
    
    const rect = colorPickerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    
    setColorPickerPosition({ x, y });
    
    // Convert position to color - fixed calculation for correct color matching
    // Angle calculation: atan2 returns angle in radians, convert to degrees
    const angle = Math.atan2(y - 0.5, x - 0.5) * 180 / Math.PI;
    // Normalize to 0-360 degrees (0 = right, going counterclockwise)
    // Adding 90 instead of 270 fixes the color mapping
    const hue = (angle + 90) % 360;
    const distance = Math.sqrt(Math.pow(x - 0.5, 2) + Math.pow(y - 0.5, 2)) * 2;
    const saturation = Math.min(1, distance) * 100;
    const lightness = 50;
    
    // Convert HSL to hex
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;
    
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    setBrushColor(hexColor);
    
    // Optimized: we don't need to update the color history on every move
    // Only add to history when mouse is released
  }, []);

  const copyWebSocketUrl = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => {
      addLog('URL de WebSocket copiada al portapapeles', 'success');
    }).catch(() => {
      addLog('Error al copiar URL de WebSocket', 'error');
    });
  }, [url]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to extract colors
        const canvas = document.createElement('canvas');
        const size = 100; // small size for sampling
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size).data;
        
        // Sample colors from different parts of the image
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
          return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        });
        
        // Update color history
        setColorHistory(colors);
        addLog('Paleta de colores extraída de la imagen', 'success');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  return (
    <main className="app">
      <img src="/logo.png" alt="Logo" className="page-logo" />
      <aside role="complementary" aria-label="Panel de control" className="panel">
        {/* Connection Status */}
        <div className="connection-status">
          <div className="status-indicator">
            <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></div>
            <span>Conexión {connected ? 'activa' : 'inactiva'}</span>
          </div>
          <button 
            onClick={() => setShowRoomPanel(!showRoomPanel)} 
            aria-label="Ver sala"
            className="dropdown-toggle"
          >
            Ver sala {showRoomPanel ? <ChevronUpIcon className="toggle-icon" /> : <ChevronDownIcon className="toggle-icon" />}
          </button>
        </div>
        
        {/* Collapsible Room Panel */}
        {showRoomPanel && (
          <div className="collapsible">
            <div className="collapsible-content">
              <p className="info-text">
                Este es un panel de prueba para la aplicación de dibujo. 
                Aquí puedes ver y copiar el identificador de la sala actual.
              </p>
              <form onSubmit={handleRoomSubmit}>
                <label>
                  Sala:
                  <input
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    placeholder="p. ej. X7Q4PF"
                    aria-label="Nombre de la sala"
                  />
                </label>
                <button type="button" className="copy-link-button" onClick={copyWebSocketUrl}>
                  Copiar link de conexión
                </button>
              </form>
            </div>
          </div>
        )}
        
        {/* Prompt Input */}
        <div className="prompt-container">
          <textarea
            className="prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Escribe tu prompt..."
            aria-label="Texto de prompt"
          />
          <button className="send-button" onClick={sendPrompt}>
            Enviar mensaje
          </button>
        </div>
        
        {/* Color Section */}
        <div className="color-section">
          <h3>Color</h3>
          <div 
            className="color-picker" 
            ref={colorPickerRef}
            onMouseDown={handleColorPickerChange}
            onMouseMove={(e) => e.buttons === 1 && handleColorPickerChange(e)}
            onTouchStart={(e) => {
              e.preventDefault(); // Prevenir comportamientos por defecto
              const touch = e.touches[0];
              handleColorPickerChange({
                clientX: touch.clientX,
                clientY: touch.clientY
              } as React.MouseEvent<HTMLDivElement>);
            }}
            onTouchMove={(e) => {
              e.preventDefault(); // Prevenir scroll
              const touch = e.touches[0];
              handleColorPickerChange({
                clientX: touch.clientX,
                clientY: touch.clientY
              } as React.MouseEvent<HTMLDivElement>);
            }}
          >
            <div className="color-square"></div>
            <div 
              className="color-cursor" 
              style={{ 
                left: `${colorPickerPosition.x * 100}%`, 
                top: `${colorPickerPosition.y * 100}%` 
              }}
            ></div>
          </div>
          <div className="color-display">
            <div className="color-preview" style={{ backgroundColor: brushColor }}></div>
            <span className="color-value">{brushColor}</span>
          </div>
          
          
          <div className="image-upload">
            <button className="dropdown-toggle" onClick={() => setShowPalettePanel(!showPalettePanel)}>
              {showPalettePanel ? 'Ocultar opciones de paleta' : 'Mostrar opciones de paleta'} {showPalettePanel ? <ChevronUpIcon className="toggle-icon" /> : <ChevronDownIcon className="toggle-icon" />}
            </button>
            
            {showPalettePanel && (
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload}
                aria-label="Subir imagen para extraer paleta de colores" 
              />
            )}
          </div>
        </div>
        
        {/* Brush Controls */}
        <div className="brush-controls">
          <h3>Ajustes del pincel</h3>
          
          <div className="slider-container">
            <label>
              Grosor
              <input
                type="range"
                min={1}
                max={64}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                aria-valuemin="1"
                aria-valuemax="64"
                aria-valuenow={String(brushSize)}
                aria-label="Grosor de brocha"
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
                aria-valuemin="1"
                aria-valuemax="100"
                aria-valuenow={String(brushOpacity)}
                aria-label="Opacidad de brocha"
              />
            </label>
          </div>
          
          <div className="tools-container">
            <button
              className={`tool-button ${!eraser ? 'active' : ''}`}
              onClick={() => eraser && setEraser(false)}
              aria-pressed={!eraser ? "true" : "false"}
              aria-label="Pincel"
            >
              <BrushIcon className="tool-icon" /> Pincel
            </button>
            
            <button
              className={`tool-button ${eraser ? 'active' : ''}`}
              onClick={() => !eraser && setEraser(true)}
              aria-pressed={eraser ? "true" : "false"}
              aria-label="Borrador"
            >
              <ClearIcon className="tool-icon" /> Borrador
            </button>
          </div>
          
          <div className="history-controls">
            <button
              className="history-button"
              onClick={undo}
              disabled={!canUndo}
              aria-label="Deshacer"
            >
              <UndoIcon className="tool-icon" />
            </button>
            
            <button
              className="history-button"
              onClick={redo}
              disabled={!canRedo}
              aria-label="Rehacer"
            >
              <RedoIcon className="tool-icon" />
            </button>
            
            <button
              className="history-button"
              onClick={clearCanvas}
              aria-label="Borrar lienzo"
            >
              <ClearIcon className="tool-icon" />
            </button>
          </div>
        </div>
        
        {/* Log Window Toggle */}
        <button 
          className="dropdown-toggle" 
          onClick={() => setShowLogPanel(!showLogPanel)}
        >
          {showLogPanel ? 'Ocultar log' : 'Mostrar log'} {showLogPanel ? <ChevronUpIcon className="toggle-icon" /> : <ChevronDownIcon className="toggle-icon" />}
        </button>
        
        {/* Log Window */}
        <div className={`log-container ${showLogPanel ? 'expanded' : ''}`}>
          <div className="log-window" ref={logScrollRef}>
            {logs.map(log => (
              <div 
                key={log.id} 
                className={`log-entry log-entry-${log.type}`}
              >
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="log-entry">No hay entradas en el log todavía</div>
            )}
          </div>
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
            brushOpacity={brushOpacity}
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
