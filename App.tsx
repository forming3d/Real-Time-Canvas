import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DrawingCanvas, { type DrawingCanvasRef } from "./components/DrawingCanvas";

// URL del WebSocket
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (window.location.hostname === "localhost"
    ? "ws://localhost:3000/ws"               // si corres Node+Express local
    : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`); // misma origin en prod

// backpressure: si hay muchos bytes encolados, saltar frames
const WS_BACKPRESSURE_BYTES = 512 * 1024; // 512 KB

export default function App() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const canvasRef = useRef<DrawingCanvasRef>(null);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => {
      const next = [...prev, line];
      if (next.length > 200) next.shift();
      return next;
    });
  }, []);

  // --- conexión con reconexión ---
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
          appendLog(`WS open -> ${WS_URL}`);
          try {
            ws.send(JSON.stringify({ type: "welcome", payload: Date.now() }));
          } catch { }
        };

        ws.onmessage = (ev) => {
          appendLog(`WS in: ${String(ev.data).slice(0, 140)}`);
        };

        ws.onclose = () => {
          if (stop) return;
          setConnected(false);
          appendLog("WS closed, retrying…");
          retry = window.setTimeout(connect, 1500) as unknown as number;
        };

        ws.onerror = () => {
          appendLog("WS error");
        };
      } catch (e) {
        appendLog(`WS connect error: ${String(e)}`);
        retry = window.setTimeout(connect, 2000) as unknown as number;
      }
    };

    connect();
    return () => {
      stop = true;
      if (retry != null) clearTimeout(retry);
      try { wsRef.current?.close(); } catch { }
      wsRef.current = null;
    };
  }, [appendLog]);

  // --- envío de frame (draw) ---
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

  // --- envío opcional de vector strokes ---
  const handleStroke = useCallback(
    (stroke: { points: { x: number; y: number; t?: number }[]; color: string; brushSize: number }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const pts = stroke.points;
      const maxPts = 600;
      const step = Math.max(1, Math.floor(pts.length / maxPts));
      const reduced = step > 1 ? pts.filter((_, i) => i % step === 0) : pts;
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

  // --- prompt/PROC ---
  const sendPrompt = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const text = prompt.trim();
    if (!text) return;
    try {
      ws.send(JSON.stringify({ type: "proc", payload: text }));
      appendLog(`PROC out: ${text}`);
    } catch (e) {
      console.warn("send prompt error", e);
    }
  }, [prompt, appendLog]);

  const onPromptKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") sendPrompt();
    },
    [sendPrompt]
  );

  const statusDot = useMemo(
    () => (
      <span
        title={connected ? "Conectado" : "Desconectado"}
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: 10,
          marginRight: 8,
          background: connected ? "#00d084" : "#ff4757",
          boxShadow: "0 0 6px rgba(0,0,0,.2)",
        }}
      />
    ),
    [connected]
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#eaeaea", fontFamily: "Inter, system-ui, sans-serif" }}>
      <header style={{ padding: "12px 16px", borderBottom: "1px solid #222" }}>
        {statusDot}
        <strong>Real-Time Canvas</strong>
        <span style={{ opacity: 0.7, marginLeft: 10, fontSize: 13 }}>{connected ? "WS conectado" : "reconectando…"}</span>
      </header>

      <main style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, padding: 16 }}>
        <section>
          <DrawingCanvas
            ref={canvasRef}
            width={800}
            height={500}
            color="#ffffff"
            brushSize={8}
            rasterMax={512}
            rasterFps={8}
            jpegQuality={0.7}
            onFrame={handleFrame}
            onStroke={handleStroke}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onPromptKey}
              placeholder="Escribe tu prompt (se guarda en proc.txt y actualiza SD)"
              style={{
                flex: 1,
                background: "#121212",
                color: "#fff",
                border: "1px solid #222",
                padding: "10px 12px",
                borderRadius: 8,
                outline: "none",
              }}
            />
            <button
              onClick={sendPrompt}
              style={{
                background: "#1f7aec",
                color: "#fff",
                border: 0,
                padding: "10px 14px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Enviar
            </button>
          </div>
        </section>

        <aside>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Log</div>
          <div
            style={{
              background: "#0f0f0f",
              border: "1px solid #1f1f1f",
              borderRadius: 8,
              padding: 10,
              height: 520,
              overflow: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
              fontSize: 12,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
            }}
          >
            {log.length === 0 ? (
              <div style={{ opacity: 0.5 }}>Sin mensajes…</div>
            ) : (
              log.map((l, i) => <div key={i}>{l}</div>)
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
