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

  // Estados HSL
  const [hue, setHue] = useState(0);        // 0..360
  const [sat, setSat] = useState(1);        // 0..1
  const [lum, setLum] = useState(0.5);      // 0..1

  // Convierte HSL (0..360, 0..1, 0..1) a HEX
  const hslToHex = (H: number, S: number, L: number) => {
    const C = (1 - Math.abs(2*L - 1)) * S;
    const X = C * (1 - Math.abs(((H/60) % 2) - 1));
    const m = L - C/2;
    let r=0,g=0,b=0;
    if (0 <= H && H < 60)  { r=C; g=X; b=0; }
    else if (60 <= H && H < 120) { r=X; g=C; b=0; }
    else if (120 <= H && H < 180){ r=0; g=C; b=X; }
    else if (180 <= H && H < 240){ r=0; g=X; b=C; }
    else if (240 <= H && H < 300){ r=X; g=0; b=C; }
    else { r=C; g=0; b=X; }
    const toHex = (v:number)=> (Math.round((v+m)*255)).toString(16).padStart(2,'0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // sincroniza brushColor cuando cambia H/S/L
  useEffect(() => {
    setBrushColor(hslToHex(hue, sat, lum));
  }, [hue, sat, lum]);

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

  const handleColorPickerChange = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = colorPickerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setColorPickerPosition({ x, y }); // para el cursor

    // Geometría
    const cx = 0.5, cy = 0.5;
    const dx = x - cx, dy = y - cy;
    const r = Math.sqrt(dx*dx + dy*dy);         // 0..~0.71
    const angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360; // 0° a la derecha, CW

    // Tamaño del cuadrado central (igual que CSS: 40% del contenedor)
    const SQ = 0.40;
    const left = cx - SQ/2, right = cx + SQ/2;
    const top  = cy - SQ/2, bottom = cy + SQ/2;
    const inSquare = (x >= left && x <= right && y >= top && y <= bottom);

    if (inSquare) {
      // Mapear S (0..1) y L (0..1) dentro del cuadrado
      const sx = (x - left) / SQ;   // 0 izquierda (blanco) -> 1 derecha (color)
      const ly = 1 - (y - top) / SQ; // 1 arriba (más claro) -> 0 abajo (oscuro)
      setSat(sx);
      setLum(ly);
    } else {
      // Selección de hue en el anillo
      setHue(angleDeg);
    }
  }, []);

  const copyWebSocketUrl = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => {
      addLog('URL de WebSocket copiada al portapapeles', 'success');
    }).catch(() => {
      addLog('Error al copiar URL de WebSocket', 'error');
    });
  }, [url]);

  // K-means clustering para extraer colores dominantes
  const extractDominantColors = useCallback((imageData: Uint8ClampedArray, k: number = 8, maxIterations: number = 10) => {
    // Extraer todos los píxeles RGB (saltando alpha)
    const pixels: [number, number, number][] = [];
    for (let i = 0; i < imageData.length; i += 4) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const alpha = imageData[i + 3];
      
      // Ignorar píxeles muy transparentes o muy oscuros/claros extremos
      if (alpha > 50 && !(r < 10 && g < 10 && b < 10) && !(r > 245 && g > 245 && b > 245)) {
        pixels.push([r, g, b]);
      }
    }
    
    if (pixels.length === 0) return [];
    
    // Inicializar centroides aleatoriamente
    const centroids: [number, number, number][] = [];
    const step = Math.floor(pixels.length / k);
    for (let i = 0; i < k; i++) {
      const idx = Math.min((i * step + Math.floor(step / 2)), pixels.length - 1);
      centroids.push([...pixels[idx]]);
    }
    
    // Función de distancia euclidiana
    const distance = (a: [number, number, number], b: [number, number, number]) => {
      return Math.sqrt(
        Math.pow(a[0] - b[0], 2) +
        Math.pow(a[1] - b[1], 2) +
        Math.pow(a[2] - b[2], 2)
      );
    };
    
    // Iteraciones de k-means
    for (let iter = 0; iter < maxIterations; iter++) {
      // Asignar cada píxel al centroide más cercano
      const clusters: [number, number, number][][] = Array(k).fill(null).map(() => []);
      
      // Muestrear para mejor rendimiento (cada 4to píxel)
      for (let i = 0; i < pixels.length; i += 4) {
        const pixel = pixels[i];
        let minDist = Infinity;
        let closestIdx = 0;
        
        for (let j = 0; j < k; j++) {
          const dist = distance(pixel, centroids[j]);
          if (dist < minDist) {
            minDist = dist;
            closestIdx = j;
          }
        }
        
        clusters[closestIdx].push(pixel);
      }
      
      // Actualizar centroides
      let changed = false;
      for (let i = 0; i < k; i++) {
        if (clusters[i].length === 0) continue;
        
        const newCentroid: [number, number, number] = [0, 0, 0];
        for (const pixel of clusters[i]) {
          newCentroid[0] += pixel[0];
          newCentroid[1] += pixel[1];
          newCentroid[2] += pixel[2];
        }
        newCentroid[0] = Math.round(newCentroid[0] / clusters[i].length);
        newCentroid[1] = Math.round(newCentroid[1] / clusters[i].length);
        newCentroid[2] = Math.round(newCentroid[2] / clusters[i].length);
        
        if (distance(newCentroid, centroids[i]) > 1) {
          changed = true;
        }
        centroids[i] = newCentroid;
      }
      
      // Converger si no hay cambios significativos
      if (!changed) break;
    }
    
    // Convertir centroides a hex y ordenar por saturación/luminancia
    const colors = centroids
      .filter(c => c[0] !== undefined)
      .map(([r, g, b]) => {
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        // Calcular saturación para ordenar
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        return { hex, saturation };
      })
      .sort((a, b) => b.saturation - a.saturation) // Más saturados primero
      .map(c => c.hex);
    
    return colors;
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Crear canvas para extraer colores
        const canvas = document.createElement('canvas');
        const size = 150; // Tamaño mayor para mejor muestreo
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        
        // Extraer colores dominantes con k-means
        addLog('Analizando imagen con k-means...', 'info');
        const colors = extractDominantColors(imageData.data, 12); // Extraer 12 colores
        
        if (colors.length > 0) {
          setColorHistory(colors);
          addLog(`Paleta de ${colors.length} colores dominantes extraída`, 'success');
        } else {
          addLog('No se pudieron extraer colores de la imagen', 'error');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [extractDominantColors, addLog]);

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
            style={{ ['--picker-hue' as any]: hue }}
            onMouseDown={handleColorPickerChange}
            onMouseMove={(e) => e.buttons === 1 && handleColorPickerChange(e)}
            onTouchStart={(e) => {
              const t = e.touches[0];
              handleColorPickerChange({ clientX: t.clientX, clientY: t.clientY } as any);
            }}
            onTouchMove={(e) => {
              const t = e.touches[0];
              handleColorPickerChange({ clientX: t.clientX, clientY: t.clientY } as any);
            }}
          >
            <div className="color-square" />
            <div 
              className="color-cursor" 
              style={{ 
                left: `${colorPickerPosition.x * 100}%`, 
                top: `${colorPickerPosition.y * 100}%` 
              }}
            />
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
          
          {showPalettePanel && colorHistory.length > 0 && (
            <div className="palette">
              {colorHistory.map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  className="swatch"
                  style={{ backgroundColor: c }}
                  onClick={() => setBrushColor(c)}
                  aria-label={`Seleccionar color ${c}`}
                  title={c}
                />
              ))}
            </div>
          )}
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
