import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DrawingCanvas, { type DrawingCanvasRef } from "./components/DrawingCanvas";

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (window.location.hostname === "localhost"
    ? "ws://localhost:3000/ws"
    : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);

const WS_BACKPRESSURE_BYTES = 512 * 1024;

const PALETTE = [
  "#ffffff","#cbd5e1","#94a3b8","#0f172a","#111827",
  "#ff4d4d","#ff7f11","#ffbf00","#22c55e","#16a34a",
  "#0ea5e9","#6366f1","#a855f7","#ec4899","#f43f5e",
];

export default function App() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  // UI (diseño anterior)
  const [prompt, setPrompt] = useState("");
  const [color, setColor] = useState("#ff4d4d");
  const [brushSize, setBrushSize] = useState(18);
  const [mode, setMode] = useState<"brush"|"eraser">("brush");
  const [log, setLog] = useState<string[]>([]);
  const canvasRef = useRef<DrawingCanvasRef | null>(null);

  const appendLog = useCallback((s: string) => {
    setLog((L) => [s, ...L].slice(0, 300));
  }, []);

  // Conexión WS + reconexión
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
          appendLog(`WS open → ${WS_URL}`);
          try { ws.send(JSON.stringify({ type: "welcome", payload: Date.now() })); } catch {}
        };
        ws.onmessage = (ev) => {
          const txt = typeof ev.data === "string" ? ev.data : "[binary]";
          appendLog(`WS in: ${txt.slice(0, 160)}`);
        };
        ws.onclose = () => {
          if (stop) return;
          setConnected(false);
          appendLog("WS closed, retrying…");
          retry = window.setTimeout(connect, 1500) as unknown as number;
        };
        ws.onerror = () => appendLog("WS error");
      } catch (e) {
        appendLog(`WS connect error: ${String(e)}`);
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
  }, [appendLog]);

  // Envío imagen a TD
  const sendDraw = useCallback((dataUrl: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > WS_BACKPRESSURE_BYTES) return;
    try { ws.send(JSON.stringify({ type: "draw", payload: dataUrl })); } catch {}
  }, []);

  const handleFrame = useCallback((dataUrl: string) => {
    sendDraw(dataUrl);
  }, [sendDraw]);

  // Opcional: stroke vector (si te sirve para otras integraciones)
  const handleStroke = useCallback((stroke: any) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try { ws.send(JSON.stringify({ type: "stroke", payload: stroke })); } catch {}
  }, []);

  // Prompt → TD (proc/prompt)
  const sendPrompt = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const text = prompt.trim();
    if (!text) return;
    try {
      ws.send(JSON.stringify({ type: "proc", payload: text }));
      appendLog(`PROC out: ${text}`);
    } catch {}
  }, [prompt, appendLog]);

  // Borrar canvas (botón + tecla)
  const clearCanvas = useCallback(() => {
    const dataUrl = canvasRef.current?.clear(); // limpia y devuelve snapshot vacío
    if (dataUrl) sendDraw(dataUrl);            // IMPORTANTÍSIMO: notificar a TD
  }, [sendDraw]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Delete / Backspace / C
      if (e.key === "Delete" || e.key === "Backspace" || e.key.toLowerCase() === "c") {
        e.preventDefault();
        clearCanvas();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearCanvas]);

  // sincroniza UI → canvas
  useEffect(() => { canvasRef.current?.setColor(color); }, [color]);
  useEffect(() => { canvasRef.current?.setBrushSize(brushSize); }, [brushSize]);

  const toolLabel = useMemo(() => mode === "brush" ? "Modo Pincel" : "Modo Borrador", [mode]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      {/* Panel lateral (diseño anterior con paleta) */}
      <aside style={{ borderRight: "1px solid #1e293b", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong>Conexión</strong>
          <span style={{ marginLeft: "auto" }}>{connected ? "🟢 Conectado" : "🔴 Desconectado"}</span>
        </div>

        <div>
          <label htmlFor="prompt" style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>Aviso de IA (PROC/PROMPT)</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && sendPrompt()}
            placeholder="Escribe tu prompt y pulsa Ctrl/Cmd+Enter…"
            rows={5}
            style={{ width: "100%", resize: "vertical", padding: "10px 12px", background: "#0b1220", color: "#fff", border: "1px solid #222", borderRadius: 8 }}
          />
          <button onClick={sendPrompt} style={{ marginTop: 8, width: "100%", padding: 10, borderRadius: 8, border: 0, background: "#a855f7", color: "#fff", cursor: "pointer" }}>
            Enviar mensaje
          </button>
        </div>

        {/* Paleta de colores */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Paleta de colores</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            {PALETTE.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  border: c === color ? "2px solid #a855f7" : "1px solid #334155",
                  background: c, cursor: "pointer"
                }}
              />
            ))}
          </div>
        </div>

        {/* Grosor + herramienta */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Ajustes del pincel</div>
          <input
            type="range" min={2} max={80} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.currentTarget.value))}
            aria-label="Grosor de pincel"
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", marginTop: 8, gap: 8 }}>
            <button
              onClick={() => setMode("brush")}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: mode === "brush" ? "2px solid #22c55e" : "1px solid #334155", background: "#0b1220", color: "#e2e8f0" }}
            >
              ✏️ Pincel
            </button>
            <button
              onClick={() => setMode("eraser")}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: mode === "eraser" ? "2px solid #f43f5e" : "1px solid #334155", background: "#0b1220", color: "#e2e8f0" }}
            >
              🧽 Borrador
            </button>
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{toolLabel} · atajo: C / Supr</div>
        </div>

        {/* Borrar */}
        <button
          onClick={clearCanvas}
          style={{ marginTop: 4, width: "100%", padding: 10, borderRadius: 8, border: "1px solid #334155", background: "#0b1220", color: "#e2e8f0", cursor: "pointer" }}
          title="Borrar canvas (envía draw vacío a TouchDesigner)"
        >
          Borrar canvas
        </button>

        {/* Log */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Log</div>
          <div style={{ maxHeight: 220, overflow: "auto", fontSize: 12, background: "#0b1220", border: "1px solid #222", borderRadius: 8, padding: 8, whiteSpace: "pre-wrap" }}>
            {log.length === 0 ? <div style={{ opacity: 0.5 }}>Sin mensajes…</div> : log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      </aside>

      {/* Área de dibujo (igual que antes) */}
      <main style={{ display: "grid", placeItems: "center", padding: 12 }}>
        <div style={{ width: "min(95vw, 1100px)", height: "min(75vh, 680px)",
          display: "grid", placeItems: "center", border: "1px solid #1e293b", borderRadius: 12, background: "#0b1220" }}>
          <DrawingCanvas
            ref={canvasRef}
            width={900}
            height={560}
            color={color}
            brushSize={brushSize}
            mode={mode}
            rasterMax={512}
            rasterFps={8}
            jpegQuality={0.7}
            onFrame={handleFrame}
            onStroke={handleStroke}
          />
        </div>
      </main>
    </div>
  );
}
