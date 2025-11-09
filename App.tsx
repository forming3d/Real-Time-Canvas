// App.tsx
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrawingCanvas } from './components/DrawingCanvas';
import { useWebSocket } from './hooks/useWebSocket';
import { useHistory } from './hooks/useHistory';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  UndoIcon,
  RedoIcon,
  SendIcon,
  BrushIcon,
  ClearIcon,
} from './components/icons';

type HSL = {
  hue: number;
  saturation: number;
  lightness: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeHex = (input: string): string | null => {
  if (!input) return null;
  let value = input.trim().replace(/^#/, '').toLowerCase();
  if (!/^[0-9a-f]{3}$/.test(value) && !/^[0-9a-f]{6}$/.test(value)) return null;
  if (value.length === 3) {
    value = value
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  return `#${value.toUpperCase()}`;
};

const hexToHSL = (hex: string): HSL => {
  const normalized = normalizeHex(hex) ?? '#000000';
  const value = normalized.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        hue = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      case b:
        hue = (r - g) / delta + 4;
        break;
    }
    hue /= 6;
  }

  return {
    hue: Math.round(hue * 360),
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100),
  };
};

const hslToHex = (h: number, s: number, l: number): string => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;

  if (saturation === 0) {
    const component = Math.round(lightness * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
    return `#${component}${component}${component}`;
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const r = hue2rgb(p, q, hue / 360 + 1 / 3);
  const g = hue2rgb(p, q, hue / 360);
  const b = hue2rgb(p, q, hue / 360 - 1 / 3);

  const toHex = (value: number) =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hslToPickerPosition = (h: number, s: number) => {
  const angle = (h * Math.PI) / 180;
  const radius = clamp(s / 100, 0, 1) * 0.5;
  const x = clamp(0.5 + radius * Math.cos(angle), 0, 1);
  const y = clamp(0.5 - radius * Math.sin(angle), 0, 1);
  return { x, y };
};

const INITIAL_COLOR_HEX = '#478792';
const INITIAL_COLOR_HSL = hexToHSL(INITIAL_COLOR_HEX);
const INITIAL_PICKER_POSITION = hslToPickerPosition(
  INITIAL_COLOR_HSL.hue,
  INITIAL_COLOR_HSL.saturation
);

const DEFAULT_HISTORY = Array.from(
  new Set(
    [
      INITIAL_COLOR_HEX,
      '#3040A0',
      '#2050C0',
      '#4060E0',
      '#6070F0',
      '#8080FF',
      '#90A0FF',
      '#A0C0FF',
    ]
      .map((color) => normalizeHex(color))
      .filter((color): color is string => Boolean(color))
  )
);

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
  const [brushColor, setBrushColor] = useState(INITIAL_COLOR_HEX);
  const [colorHSL, setColorHSL] = useState<HSL>(INITIAL_COLOR_HSL);
  const [hexInputValue, setHexInputValue] = useState(INITIAL_COLOR_HEX.toUpperCase());
  const [brushSize, setBrushSize] = useState(10);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [eraser, setEraser] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [canvasSize, setCanvasSize] = useState(512);
  const [colorPickerPosition, setColorPickerPosition] = useState(INITIAL_PICKER_POSITION);
  const [showRoomPanel, setShowRoomPanel] = useState(false);
  const [showPalettePanel, setShowPalettePanel] = useState(false);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [colorHistory, setColorHistory] = useState<string[]>(
    () => Array.from(new Set(DEFAULT_HISTORY as string[]))
  );
  const [nextLogId, setNextLogId] = useState(1);

  const url = useMemo(() => WS_URL(room), [room]);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const colorPointerActiveRef = useRef(false);
  
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
    setLogs((prev) => [
      ...prev,
      {
        id: nextLogId,
        message,
        type,
        timestamp: Date.now(),
      },
    ]);
    setNextLogId((prev) => prev + 1);
  }, [nextLogId]);

  const commitHexInput = useCallback(() => {
    if (!hexInputValue) {
      setHexInputValue(brushColor.toUpperCase());
      return;
    }
    const normalized = updateColorFromHex(hexInputValue, { addToHistory: true });
    if (!normalized) {
      setHexInputValue(brushColor.toUpperCase());
      addLog('Formato de color inválido. Usa valores como #AABBCC.', 'error');
    }
  }, [addLog, brushColor, hexInputValue, updateColorFromHex]);

  const handleHexInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitHexInput();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setHexInputValue(brushColor.toUpperCase());
      }
    },
    [brushColor, commitHexInput]
  );

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

  const lastPointerUpdateRef = useRef(0);

  const pushColorToHistory = useCallback((hex: string) => {
    const normalized = normalizeHex(hex);
    if (!normalized) return;
    setColorHistory((prev) => {
      const filtered = prev.filter((color) => color !== normalized);
      return [normalized, ...filtered].slice(0, 12);
    });
  }, []);

  const updateColorFromHSL = useCallback(
    (
      hue: number,
      saturation: number,
      lightness: number,
      options: { updatePosition?: boolean; addToHistory?: boolean } = {}
    ) => {
      const safeHue = ((hue % 360) + 360) % 360;
      const safeSaturation = clamp(saturation, 0, 100);
      const safeLightness = clamp(lightness, 0, 100);

      setColorHSL({ hue: safeHue, saturation: safeSaturation, lightness: safeLightness });
      const hex = hslToHex(safeHue, safeSaturation, safeLightness);
      setBrushColor(hex);
      setHexInputValue(hex.toUpperCase());

      if (options.updatePosition !== false) {
        setColorPickerPosition(hslToPickerPosition(safeHue, safeSaturation));
      }

      if (options.addToHistory) {
        pushColorToHistory(hex);
      }

      return hex;
    },
    [pushColorToHistory]
  );

  const updateColorFromHex = useCallback(
    (value: string, options: { addToHistory?: boolean; updatePosition?: boolean } = {}) => {
      const normalized = normalizeHex(value);
      if (!normalized) return null;
      const hsl = hexToHSL(normalized);
      updateColorFromHSL(hsl.hue, hsl.saturation, hsl.lightness, options);
      return normalized;
    },
    [updateColorFromHSL]
  );

  const handleColorPointer = useCallback(
    (clientX: number, clientY: number, commit = false) => {
      const rect = colorPickerRef.current?.getBoundingClientRect();
      if (!rect) return null;

      const now = performance.now();
      if (!commit && now - lastPointerUpdateRef.current < 16) {
        return null;
      }
      lastPointerUpdateRef.current = now;

      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);
      const dx = x - 0.5;
      const dy = 0.5 - y;
      const angle = Math.atan2(dy, dx);
      const hue = (angle * 180) / Math.PI;
      const radius = Math.min(0.5, Math.sqrt(dx * dx + dy * dy));
      const saturation = clamp((radius / 0.5) * 100, 0, 100);

      setColorPickerPosition({ x, y });
      const hex = updateColorFromHSL(hue, saturation, colorHSL.lightness, {
        updatePosition: false,
      });

      if (commit && hex) {
        pushColorToHistory(hex);
      }

      return hex;
    },
    [colorHSL.lightness, pushColorToHistory, updateColorFromHSL]
  );

  const handleColorPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      colorPointerActiveRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      handleColorPointer(event.clientX, event.clientY);
    },
    [handleColorPointer]
  );

  const handleColorPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!colorPointerActiveRef.current) return;
      handleColorPointer(event.clientX, event.clientY);
    },
    [handleColorPointer]
  );

  const handleColorPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!colorPointerActiveRef.current) return;
      colorPointerActiveRef.current = false;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignored
      }
      handleColorPointer(event.clientX, event.clientY, true);
    },
    [handleColorPointer]
  );

  const handleColorPointerCancel = useCallback(() => {
    colorPointerActiveRef.current = false;
  }, []);

  const handleColorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const stepHue = 5;
      const stepSaturation = 5;
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          updateColorFromHSL(colorHSL.hue + stepHue, colorHSL.saturation, colorHSL.lightness, {
            addToHistory: false,
          });
          break;
        case 'ArrowLeft':
          event.preventDefault();
          updateColorFromHSL(colorHSL.hue - stepHue, colorHSL.saturation, colorHSL.lightness, {
            addToHistory: false,
          });
          break;
        case 'ArrowUp':
          event.preventDefault();
          updateColorFromHSL(
            colorHSL.hue,
            clamp(colorHSL.saturation + stepSaturation, 0, 100),
            colorHSL.lightness,
            { addToHistory: false }
          );
          break;
        case 'ArrowDown':
          event.preventDefault();
          updateColorFromHSL(
            colorHSL.hue,
            clamp(colorHSL.saturation - stepSaturation, 0, 100),
            colorHSL.lightness,
            { addToHistory: false }
          );
          break;
        case 'Enter':
          event.preventDefault();
          pushColorToHistory(brushColor);
          break;
        default:
          break;
      }
    },
    [
      brushColor,
      colorHSL.hue,
      colorHSL.lightness,
      colorHSL.saturation,
      pushColorToHistory,
      updateColorFromHSL,
    ]
  );

  const handleLightnessInput = useCallback(
    (value: number) => {
      updateColorFromHSL(colorHSL.hue, colorHSL.saturation, value, {
        updatePosition: false,
      });
    },
    [colorHSL.hue, colorHSL.saturation, updateColorFromHSL]
  );

  const commitLightnessInput = useCallback(() => {
    pushColorToHistory(brushColor);
  }, [brushColor, pushColorToHistory]);

  const handleHexInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setHexInputValue(event.target.value.toUpperCase());
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
        
        const sanitizedColors = colors
          .map((color) => normalizeHex(color))
          .filter((color): color is string => Boolean(color));

        if (sanitizedColors.length) {
          setColorHistory((prev) => {
            const merged = [...sanitizedColors, ...prev];
            const unique = merged.filter(
              (color, index) => merged.indexOf(color) === index
            );
            return unique.slice(0, 12);
          });
          updateColorFromHex(sanitizedColors[0], { addToHistory: false });
        }

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
          <h3 id="color-section-heading">Color</h3>
          <div
            className="color-picker"
            ref={colorPickerRef}
            role="application"
            aria-labelledby="color-section-heading"
            aria-roledescription="Selector de matiz y saturación"
            tabIndex={0}
            onPointerDown={handleColorPointerDown}
            onPointerMove={handleColorPointerMove}
            onPointerUp={handleColorPointerUp}
            onPointerCancel={handleColorPointerCancel}
            onPointerLeave={handleColorPointerCancel}
            onKeyDown={handleColorKeyDown}
          >
            <div
              className="color-cursor"
              style={{
                left: `${colorPickerPosition.x * 100}%`,
                top: `${colorPickerPosition.y * 100}%`,
              }}
            />
          </div>
          <div className="color-display" role="group" aria-labelledby="color-display-label">
            <span id="color-display-label" className="sr-only">
              Color seleccionado actualmente
            </span>
            <div className="color-preview" style={{ backgroundColor: brushColor }} aria-hidden="true"></div>
            <div className="color-code">
              <label className="sr-only" htmlFor="color-hex-input">
                Editar color en formato hexadecimal
              </label>
              <input
                id="color-hex-input"
                className="color-hex-input"
                value={hexInputValue}
                onChange={handleHexInputChange}
                onBlur={commitHexInput}
                onKeyDown={handleHexInputKeyDown}
                aria-label="Código hexadecimal del color"
                spellCheck={false}
              />
              <span className="color-value" aria-live="polite">
                {brushColor}
              </span>
            </div>
            <label className="sr-only" htmlFor="color-native-input">
              Selector de color del sistema
            </label>
            <input
              id="color-native-input"
              className="color-native-input"
              type="color"
              value={brushColor}
              onChange={(event) =>
                updateColorFromHex(event.target.value, { addToHistory: true })
              }
              aria-label="Selector de color del sistema"
            />
          </div>

          <div className="slider-container">
            <label htmlFor="lightness-slider">
              Luminosidad
              <input
                id="lightness-slider"
                type="range"
                min={0}
                max={100}
                value={colorHSL.lightness}
                onChange={(event) => handleLightnessInput(Number(event.target.value))}
                onPointerUp={commitLightnessInput}
                onKeyUp={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    commitLightnessInput();
                  }
                }}
                onBlur={commitLightnessInput}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={colorHSL.lightness}
                aria-label="Luminosidad del color"
              />
            </label>
          </div>

          {colorHistory.length > 0 && (
            <div className="color-history" aria-label="Colores recientes" role="list">
              {colorHistory.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="color-history-swatch"
                  style={{ backgroundColor: color }}
                  title={color}
                  aria-label={`Seleccionar ${color}`}
                  role="listitem"
                  onClick={() => updateColorFromHex(color, { addToHistory: true })}
                />
              ))}
            </div>
          )}

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
                aria-valuemin={1}
                aria-valuemax={64}
                aria-valuenow={brushSize}
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
                aria-valuemin={1}
                aria-valuemax={100}
                aria-valuenow={brushOpacity}
                aria-label="Opacidad de brocha"
              />
            </label>
          </div>
          
          <div className="tools-container">
            <button
              className={`tool-button ${!eraser ? 'active' : ''}`}
              onClick={() => eraser && setEraser(false)}
              aria-pressed={!eraser}
              aria-label="Pincel"
            >
              <BrushIcon className="tool-icon" /> Pincel
            </button>
            
            <button
              className={`tool-button ${eraser ? 'active' : ''}`}
              onClick={() => !eraser && setEraser(true)}
              aria-pressed={eraser}
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

      <section
        className="stage"
        ref={stageRef}
        data-log-open={showLogPanel ? 'true' : 'false'}
      >
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
