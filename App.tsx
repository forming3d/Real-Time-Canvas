import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DrawingCanvas, { type DrawingCanvasRef } from "./components/DrawingCanvas";
// Si tienes un ColorPicker propio, déjalo; si no, usa un <input type="color" /> simple.
import ColorPicker from "./components/ColorPicker"; // opcional

// ---- ROOM desde URL (?room=xxx o ?r=xxx)
const ROOM =
  new URLSearchParams(window.location.search).get("room") ||
  new URLSearchParams(window.location.search).get("r") ||
  "default";

// Construye la URL WS y le añade room + role=canvas aunque VITE_WS_URL ya tenga query
function buildWsUrlBase(): string {
  if ((import.meta as any).env?.VITE_WS_URL) {
    try {
      const u = new URL((import.meta as any).env.VITE_WS_URL as string);
      if (!u.searchParams.has("room")) u.searchParams.set("room", ROOM);
      if (!u.searchParams.has("role")) u.searchParams.set("role", "canvas");
      return u.toString();
    } catch {
      // si VITE_WS_URL es inválida, caemos al default
    }
  }
  const base =
    window.location.hostname === "localhost"
      ? "ws://localhost:3000/ws"
      : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
  const u = new URL(base);
  u.searchParams.set("room", ROOM);
  u.searchParams.set("role", "canvas");
  return u.toString();
}

const WS_URL = buildWsUrlBase();
const WS_BACKPRESSURE_BYTES = 512 * 1024; // 512 KB

export default function App() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  // UI state
  const [prompt, setPrompt] = useState("");
  const [color, setColor] = useState("#ff4d4d");
  const [brushSize, setBrushSize] = useState(18);
  const [mode, setMode] = useState<"brush" | "eraser">("brush");

  // Canvas ref
  const canvasRef = useRef<DrawingCanvasRef | null>(null);

  // ---- Conexión WebSocket
  useEffect(() => {
    let stop = false;
    let retry: number | null = null;

    const connect = () => {
      if (stop) return;
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => {
          setConnected(true);
          try {
            ws.send(JSON.stringify({ type: "welcome", payload: Date.now(), room: ROOM }));
          } catch {}
        };
        ws.onclose = () => {
          if (stop) return;
          setConnected(false);
          retry = window.setTimeout(connect, 1500) as unknown as number;
        };
      } catch {
        retry = window.setTimeout(connect, 2000) as unknown as number;
      }
    };

    connect();
    return () => {
      stop = true;
      if (retry != null) clearTimeout(retry);
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
    };
  }, []);

  // Keep-alive JSON cada 30s (evita timeouts intermedios)
  useEffect(() => {
    const id = window.setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "keepalive", payload: Date.now(), room: ROOM }));
        } catch {}
      }
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // ---- Envío de imagen (PNG 512×512)
  const sendDraw = useCallback((dataUrl: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > WS_BACKPRESSURE_BYTES) return; // backpressure
    try {
      ws.send(JSON.stringify({ type: "draw", payload: dataUrl }));
    } catch (e) {
      console.warn("send draw error", e);
    }
  }, []);

  // Raster frame desde DrawingCanvas
  const handleFrame = useCallback((dataUrl: string) => {
    sendDraw(dataUrl);
  }, [sendDraw]);

  // (Opcional) stroke vectorial reducido
  const handleStroke = useCallback(
    (stroke: { points: { x: number; y: number; t?: number }[]; color: string; brushSize: number }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const pts = stroke.points;
      const reduced: typeof pts = [];
      const SKIP = 2;
      for (let i = 0; i < pts.length; i += SKIP) reduced.push(pts[i]);
      try {
        ws.send(
          JSON.stringify({
            type: "stroke",
            payload: { points: reduced, color: stroke.color, brushSize: stroke.brushSize },
          })
        );
      } catch (e) {
        console.warn("send stroke error", e);
      }
    },
    []
  );

  // Prompt → TD
  const sendPrompt = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const text = prompt.trim();
    if (!text) return;
    try {
      ws.send(JSON.stringify({ type: "proc", payload: text }));
    } catch {}
  }, [prompt]);

  // Acciones de Canvas
  const clearCanvas = useCallback(() => {
    const d = canvasRef.current?.clear();
    if (d) sendDraw(d);
  }, [sendDraw]);

  const undo = useCallback(() => {
    const d = canvasRef.current?.undo();
    if (d) sendDraw(d);
  }, [sendDraw]);

  const redo = useCallback(() => {
    const d = canvasRef.current?.redo();
    if (d) sendDraw(d);
  }, [sendDraw]);

  // UI -> Canvas
  useEffect(() => {
    canvasRef.current?.setColor(color);
  }, [color]);

  useEffect(() => {
    canvasRef.current?.setBrushSize(brushSize);
  }, [brushSize]);

  const toolLabel = useMemo(() => (mode === "brush" ? "Modo Pincel" : "Modo Borrador"), [mode]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(260px, 300px) 1fr",
        height: "100dvh",
        background: "#0f172a",
        color: "#e2e8f0",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          borderRight: "1px solid #1e293b",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflow: "auto",
        }}
      >
        {/* Conexión / Sala */}
        <details style={{ border: "1px solid #334155", borderRadius: 8, background: "#0b1220" }}>
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              userSelect: "none",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: connected ? "#22c55e" : "#ef4444",
              }}
            />
            <strong style={{ marginRight: 6 }}>Conexión</strong>
            <span style={{ opacity: 0.7 }}>(ver sala)</span>
          </summary>
          <div style={{ padding: "8px 12px", borderTop: "1px solid #334155", fontSize: 13 }}>
            <div style={{ marginBottom: 6 }}>
              Sala (room): <code>{ROOM}</code>
            </div>
            <div style={{ opacity: 0.75 }}>
              Abre este canvas con <code>?room={ROOM}</code> para enlazar con tu TouchDesigner.
            </div>
          </div>
        </details>

        {/* Prompt */}
        <div>
          <label htmlFor="prompt" style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>
            Aviso de IA (PROC/PROMPT)
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Escribe tu prompt…"
            rows={5}
            style={{
              width: "100%",
              resize: "vertical",
              padding: "10px 12px",
              background: "#0b1220",
              color: "#fff",
              border: "1px solid #222",
              borderRadius: 8,
              outline: "none",
            }}
          />
          <button
            onClick={sendPrompt}
            style={{
              marginTop: 8,
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: 0,
              background: "#a855f7",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Enviar mensaje
          </button>
        </div>

        {/* Color */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Color</div>
          {/* Si no tienes ColorPicker propio, usa: <input type="color" value={color} onChange={(e)=>setColor(e.target.value)} /> */}
          <ColorPicker color={color} onChange={setColor} showHistory />
        </div>

        {/* Pincel / Borrador */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Ajustes del pincel</div>
          <input
            type="range"
            min={2}
            max={80}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.currentTarget.value))}
            aria-label="Grosor de pincel"
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", marginTop: 8, gap: 8 }}>
            <button
              onClick={() => setMode("brush")}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                border: mode === "brush" ? "2px solid #22c55e" : "1px solid #334155",
                background: "#0b1220",
                color: "#e2e8f0",
              }}
            >
              ✏️ Pincel
            </button>
            <button
              onClick={() => setMode("eraser")}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                border: mode === "eraser" ? "2px solid #f43f5e" : "1px solid #334155",
                background: "#0b1220",
                color: "#e2e8f0",
              }}
            >
              🧽 Borrador
            </button>
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{toolLabel}</div>
        </div>

        {/* Acciones */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            onClick={undo}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #334155", background: "#0b1220", color: "#e2e8f0" }}
          >
            ↩️ Deshacer
          </button>
          <button
            onClick={redo}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #334155", background: "#0b1220", color: "#e2e8f0" }}
          >
            ↪️ Rehacer
          </button>
        </div>
        <button
          onClick={clearCanvas}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #334155",
            background: "#0b1220",
            color: "#e2e8f0",
          }}
        >
          Borrar canvas
        </button>
      </aside>

      {/* Área de dibujo: ahora un wrapper EXACTO de 512×512 */}
      <main style={{ padding: 24, display: "grid", placeItems: "center" }}>
        <div
          style={{
            width: 512,
            height: 512,
            border: "1px solid #1e293b",
            borderRadius: 12,
            background: "#0b1220",
            overflow: "hidden",
            padding: 12,
            boxSizing: "border-box",
            display: "grid",
          }}
        >
          <div style={{ width: "100%", height: "100%" }}>
            <DrawingCanvas
              ref={canvasRef}
              color={color}
              brushSize={brushSize}
              mode={mode}
              /** snapshots EXACTOS 512×512 (letterbox si cambiara el aspecto) */
              targetSize={512}
              rasterFps={8}
              onFrame={handleFrame}
              onStroke={handleStroke}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
