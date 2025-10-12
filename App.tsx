import { useCallback, useEffect, useRef, useState } from "react";
import DrawingCanvas, { type DrawingCanvasRef } from "./components/DrawingCanvas";

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (window.location.hostname === "localhost"
    ? "ws://localhost:3000/ws"
    : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);

const WS_BACKPRESSURE_BYTES = 512 * 1024;

export default function App() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const canvasRef = useRef<DrawingCanvasRef | null>(null);

  const appendLog = useCallback((s: string) => {
    setLog((L) => [s, ...L].slice(0, 300));
  }, []);

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

  const handleFrame = useCallback((dataUrl: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > WS_BACKPRESSURE_BYTES) return;
    try {
      ws.send(JSON.stringify({ type: "draw", payload: dataUrl }));
    } catch (e) {
      console.warn("send draw error", e);
    }
  }, []);

  const handleStroke = useCallback(
    (stroke: { points: { x: number; y: number; t?: number }[]; color: string; brushSize: number }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({ type: "stroke", payload: stroke }));
      } catch (e) {
        console.warn("send stroke error", e);
      }
    },
    []
  );

  const sendPrompt = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const text = prompt.trim();
    if (!text) return;
    try {
      ws.send(JSON.stringify({ type: "proc", payload: text })); // tu callback TD maneja 'proc' y 'prompt'
      appendLog(`PROC out: ${text}`);
    } catch (e) {
      console.warn("send prompt error", e);
    }
  }, [prompt, appendLog]);

  const clearCanvas = useCallback(() => {
    canvasRef.current?.clear();
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <aside style={{ width: 320, maxWidth: "40vw", borderRight: "1px solid #1e293b", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
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
            style={{ width: "100%", resize: "vertical", padding: "10px 12px", background: "#0b1220", color: "#fff", border: "1px solid #222", borderRadius: 8, outline: "none" }}
          />
          <button
            onClick={sendPrompt}
            style={{ marginTop: 8, width: "100%", padding: 10, borderRadius: 8, border: 0, background: "#a855f7", color: "#fff", cursor: "pointer" }}
          >
            Enviar mensaje
          </button>
        </div>

        <button
          onClick={clearCanvas}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #334155", background: "#0b1220", color: "#e2e8f0", cursor: "pointer" }}
          title="Borrar canvas"
        >
          Borrar canvas
        </button>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Log</div>
          <div style={{ maxHeight: 220, overflow: "auto", fontSize: 12, background: "#0b1220", border: "1px solid #222", borderRadius: 8, padding: 8, whiteSpace: "pre-wrap" }}>
            {log.length === 0 ? <div style={{ opacity: 0.5 }}>Sin mensajes…</div> : log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, display: "grid", placeItems: "center", padding: 12 }}>
        <div style={{ width: "min(95vw, 1100px)", height: "min(75vh, 680px)", display: "grid", placeItems: "center", border: "1px solid #1e293b", borderRadius: 12, background: "#0b1220" }}>
          <DrawingCanvas
            ref={canvasRef}
            width={900}
            height={560}
            color="#ff4d4d"
            brushSize={18}
            rasterMax={512}
            rasterFps={8}
            jpegQuality={0.7}
            onFrame={handleFrame}   // ← envía {type:"draw"}
            onStroke={handleStroke} // ← opcional
          />
        </div>
      </main>
    </div>
  );
}
