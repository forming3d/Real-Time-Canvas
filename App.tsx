import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DrawingCanvas, { type DrawingCanvasRef } from "./components/DrawingCanvas";
// Si tienes un ColorPicker propio, déjalo; si no, usa un <input type="color" /> simple.
import ColorPicker from "./components/ColorPicker"; // opcional

// ---- ROOM desde URL (?room=xxx o ?r=xxx)
const ROOM =
  @@ - 10,9 + 11, 9 @@ const ROOM =

    // Construye la URL WS y le añade room + role=canvas aunque VITE_WS_URL ya tenga query
    function buildWsUrlBase(): string {
      if ((import.meta as any).env?.VITE_WS_URL) {
        try {
          const u = new URL((import.meta as any).env.VITE_WS_URL as string);
          if (!u.searchParams.has("room")) u.searchParams.set("room", ROOM);
          if (!u.searchParams.has("role")) u.searchParams.set("role", "canvas");
          return u.toString();
          @@ -76, 9 + 77, 7 @@ export default function App() {
            return () => {
              stop = true;
              if (retry != null) clearTimeout(retry);
              try { wsRef.current?.close(); } catch { }
              wsRef.current = null;
            };
          }, []);
          @@ -96, 7 + 95, 7 @@ export default function App() {
            return () => clearInterval(id);
          }, []);

          // ---- Envío de imagen (PNG 512×512)
          const sendDraw = useCallback((dataUrl: string) => {
            const ws = wsRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            @@ -109, 14 + 108, 11 @@ export default function App() {
            }, []);

          // Raster frame desde DrawingCanvas
          const handleFrame = useCallback((dataUrl: string) => {
            sendDraw(dataUrl);
          }, [sendDraw]);

          // (Opcional) stroke vectorial reducido
          const handleStroke = useCallback(
            (stroke: { points: { x: number; y: number; t?: number }[]; color: string; brushSize: number }) => {
              const ws = wsRef.current;
              @@ -178, 7 + 174, 6 @@ export default function App() {
                const toolLabel = useMemo(() => (mode === "brush" ? "Modo Pincel" : "Modo Borrador"), [mode]);

                return (
                  <div
                    style={{
                      display: "grid",
	@@ -188, 7 + 183, 7 @@ export default function App() {
                  color: "#e2e8f0",
      }
              }
    >
                {/* Sidebar */ }
                < aside
              style = {{
                borderRight: "1px solid #1e293b",
                  @@ - 199, 8 + 194, 8 @@ export default function App() {
                    overflow: "auto",
        }
              }
      >
                {/* Conexión / Sala */ }
                < details style = {{ border: "1px solid #334155", borderRadius: 8, background: "#0b1220" }
            }>
          <summary
            style={{
              listStyle: "none",
	@@ - 272, 13 + 267, 14 @@ export default function App() {
          </button >
        </div >

  {/* Color */ }
  < div >
  <div style={{ fontWeight: 600, marginBottom: 6 }}>Color</div>
{/* Si no tienes ColorPicker propio, usa: <input type="color" value={color} onChange={(e)=>setColor(e.target.value)} /> */ }
<ColorPicker color={color} onChange={setColor} showHistory />
        </div >

  {/* Pincel / Borrador */ }
  < div >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Ajustes del pincel</div>
          <input
	@@ -351, 19 + 347, 19 @@ export default function App() {
        </button >
      </aside >

    {/* Área de dibujo: ahora un wrapper EXACTO de 512×512 */ }
    < main style = {{ padding: 24, display: "grid", placeItems: "center" }
}>
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
      @@ -372,7 +368,8 @@ export default function App() {
        color = { color }
              brushSize={brushSize}
      mode={mode}
              /** snapshots EXACTOS 512×512 (letterbox si cambiara el aspecto) */
      targetSize={512}
      rasterFps={8}
      onFrame={handleFrame}
      onStroke={handleStroke}