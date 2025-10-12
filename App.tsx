import { useCallback, useEffect, useRef, useState } from "react";
import DrawingCanvas, { type DrawingCanvasRef } from "./components/DrawingCanvas";

/**
 * URL del WebSocket:
 * - Local: ws://localhost:3000/ws
 * - Producción: mismo host donde sirve el server (Render), wss://<tu-dominio>/ws
 * - Puedes sobreescribir con VITE_WS_URL
 */
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (window.location.hostname === "localhost"
    ? "ws://localhost:3000/ws"
    : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);

/** Límite de backpressure: si hay muchos bytes encolados, saltamos frames `draw` */
const WS_BACKPRESSURE_BYTES = 512 * 1024; // 512 KB

export default function App() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const canvasRef = useRef<DrawingCanvasRef | null>(null);

  const appendLog = useCallback((s: string) => {
    setLog((L) => [s, ...L].slice(0, 300));
  }, []);

  /** Conexión WS con reconexión */
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
          try {
            ws.send(JSON.stringify({ type: "welcome", payload: Date.now() }));
          } catch {}
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
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
  }, [appendLog]);

  /** Envía raster (imagen) — lo que TouchDesigner espera como `type:"draw"` */
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

  /** (Opcional) Envía el stroke vectorizado para otras integraciones */
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

  /** Envía el prompt (usa `proc` porque tu callback TD maneja 'proc' y 'prompt') */
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

  /** Limpia el canvas */
  const clearCanvas = useCallback(() => {
    canvasRef.current?.clear();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#0f172a", // slate-900
        color: "#e2e8f0", // slate-200
      }}
    >
      {/* Panel lateral */}
      <aside
        style={{
          width: 320,
          maxWidth: "40vw",
          borderRight: "1px solid #1e293b",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong>Conexión</strong>
          <span style={{ marginLeft: "auto" }}>{connected ? "🟢 Conectado" : "🔴 Desconectado"}</span>
        </div>

        <div>
          <label htmlFor="prompt" style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}>
            Aviso de IA (PROC/PROMPT)
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && sendPrompt()}
            placeholder="Escribe tu prompt y pulsa Ctrl/Cmd+Enter…"
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
              background: "#a855f7", // purple-500
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Enviar mensaje
          </button>
        </div>

        <div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={clearCanvas}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #334155",
                background: "#0b1220",
                color: "#e2e8f0",
                cursor: "pointer",
              }}
              title="Borrar canvas"
            >
              Borrar canvas
            </button>
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Log</div>
          <div
            style={{
              maxHeight: 220,
              overflow: "auto",
              fontSize: 12,
              background: "#0b1220",
              border: "1px solid #222",
              borderRadius: 8,
              padding: 8,
              whiteSpace: "pre-wrap",
            }}
          >
            {log.length === 0 ? <div style={{ opacity: 0.5 }}>Sin mensajes…</div> : log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      </aside>

      {/* Área de dibujo */}
      <main
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: 12,
        }}
      >
        <div
          style={{
            width: "min(95vw, 1100px)",
            height: "min(75vh, 680px)",
            display: "grid",
            placeItems: "center",
            border: "1px solid #1e293b",
            borderRadius: 12,
            background: "#0b1220",
          }}
        >
          <DrawingCanvas
            ref={canvasRef}
            /** dimensiones de lienzo (CSS las ajusta a la caja, dentro aplica DPR) */
            width={900}
            height={560}
            /** estilo inicial del pincel */
            color="#ff4d4d"
            brushSize={18}
            /** rasterización para TD */
            rasterMax={512}     // tamaño máximo del snapshot que enviamos al WS
            rasterFps={8}       // snapshots/seg durante el trazo
            jpegQuality={0.7}   // baja si quieres menos ancho de banda
            onFrame={handleFrame}   // ← ENVÍA {type:"draw", payload: dataURL}
            onStroke={handleStroke} // ← opcional: vectorizado
          />
        </div>
      </main>
    </div>
  );
}

    </div>
  );
}
