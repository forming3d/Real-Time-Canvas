import { useCallback, useEffect, useRef, useState } from "react";
import DrawingCanvas from "./DrawingCanvas";

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (window.location.hostname === "localhost"
    ? "ws://localhost:3000/ws"
    : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);

const WS_BACKPRESSURE_BYTES = 512 * 1024; // 512KB

export default function App() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const appendLog = useCallback((s: string) => setLog((L) => [s, ...L].slice(0, 200)), []);

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
          try { ws.send(JSON.stringify({ type: "welcome", payload: Date.now() })); } catch {}
        };

        ws.onmessage = (ev) => appendLog(`WS in: ${String(ev.data).slice(0, 140)}`);
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

  // ---- RASTER: envía imagen (esto es lo que necesita tu callback de TD) ----
  const handleFrame = useCallback((dataUrl: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > WS_BACKPRESSURE_BYTES) return; // evita saturar
    try {
      ws.send(JSON.stringify({ type: "draw", payload: dataUrl }));
    } catch (e) {
      console.warn("send draw error", e);
    }
  }, []);

  // ---- Opcional: también envío del vectorizado (para otras integraciones) ----
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
      ws.send(JSON.stringify({ type: "proc", payload: text })); // tu callback ya maneja 'proc'/'prompt'
      appendLog(`PROC out: ${text}`);
    } catch (e) {
      console.warn("send prompt error", e);
    }
  }, [prompt, appendLog]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <header style={{ padding: 12, borderBottom: "1px solid #1e293b" }}>
        <strong>Real-time Canvas</strong> — WS: {connected ? "🟢" : "🟥"}
      </header>
      <main style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12, padding: 12, flex: 1 }}>
        <aside style={{ border: "1px solid #1e293b", borderRadius: 8, padding: 12 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Aviso de IA</div>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendPrompt()}
            placeholder="Escribe tu prompt"
            style={{ width: "100%", padding: "10px 12px", background: "#0b1220", color: "#fff", border: "1px solid #222", borderRadius: 8 }}
          />
          <button onClick={sendPrompt} style={{ marginTop: 8, width: "100%", padding: 10, borderRadius: 8, border: 0, background: "#a855f7", color: "#fff" }}>
            Enviar mensaje
          </button>
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>Se guardará en <code>proc.txt</code> y actualizará tu Text TOP si existe.</div>
          <div style={{ marginTop: 16, maxHeight: 200, overflow: "auto", fontSize: 12, background: "#0b1220", border: "1px solid #222", borderRadius: 8, padding: 8 }}>
            {log.length === 0 ? <div style={{ opacity: 0.5 }}>Sin mensajes…</div> : log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </aside>

        <section style={{ display: "grid", placeItems: "center" }}>
          <DrawingCanvas
            width={900}
            height={560}
            color="#ff4d4d"
            brushSize={18}
            rasterMax={512}
            rasterFps={8}
            jpegQuality={0.7}
            onFrame={handleFrame}   // ← IMPORTANTE
            onStroke={handleStroke} // opcional
          />
        </section>
      </main>
    </div>
  );
}
