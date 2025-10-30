import { useState } from "react";
import DrawingCanvas from "./DrawingCanvas";
import { useWebSocket } from "./useWebSocket";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const { sendJson } = useWebSocket();

  function sendPrompt() {
    const text = prompt.trim();
    if (!text) return;
    sendJson({ type: "prompt", payload: text } as any);
  }

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "black",
        color: "white",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div style={{ width: "min(92vw, 700px)", display: "grid", gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, opacity: 0.9 }}>Real-Time Canvas → TouchDesigner</h1>

        <DrawingCanvas sendJson={(m) => sendJson(m as any)} width={512} height={512} jpegQuality={0.7} fps={10} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <input
            placeholder="Escribe prompt/PROC…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendPrompt(); }}
            style={{ padding: "10px 12px", background: "#111", border: "1px solid #333", color: "white" }}
          />
          <button onClick={sendPrompt}>Enviar PROC</button>
        </div>

        <p style={{ opacity: 0.6, fontSize: 12, marginTop: 8 }}>
          Envía <code>draw</code> (JPEG) y <code>prompt</code> por WebSocket. En TouchDesigner usa un Movie File In TOP llamado <b>canvas_in</b> y el script de callbacks que ya tienes.
        </p>
      </div>
    </div>
  );
}
