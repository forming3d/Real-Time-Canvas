// App.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DrawingCanvas from "./DrawingCanvas";
import ControlPanel from "./ControlPanel";
import { ConnectionStatus } from "./types";
import { useWebSocket } from "./useWebSocket";

function getRoomFromUrl(): string {
  const u = new URL(window.location.href);
  return u.searchParams.get("room") || "default";
}

export default function App() {
  const ROOM = useMemo(() => getRoomFromUrl(), []);

  const buildWsUrl = useCallback(() => {
    const { protocol, host } = window.location;
    const scheme = protocol === "https:" ? "wss" : "ws";
    return `${scheme}://${host}/ws?room=${encodeURIComponent(ROOM)}&role=canvas`;
  }, [ROOM]);

  const { connectionStatus, connect, disconnect, sendMessage } = useWebSocket(buildWsUrl(), {
    autoReconnect: true,
    maxReconnectAttempts: 100,
    reconnectInterval: 1500,
  });

  // UI state
  const [prompt, setPrompt] = useState("");
  const [color, setColor] = useState("#ff4d4d");
  const [brushSize, setBrushSize] = useState(10);
  const [mode, setMode] = useState<"brush" | "eraser">("brush");

  // Canvas ref (usa los métodos expuestos por DrawingCanvas)
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const connected = connectionStatus === ConnectionStatus.CONNECTED;

  const sendPrompt = useCallback(() => {
    const p = prompt.trim();
    if (!p) return;
    sendMessage(JSON.stringify({ type: "prompt", payload: p }));
  }, [prompt, sendMessage]);

  const onStroke = useCallback(
    (stroke: any) => {
      const payload = {
        points: stroke.points?.map((p: any) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
        color: stroke.color,
        brushSize: stroke.brushSize,
        mode: stroke.mode,
      };
      sendMessage(JSON.stringify({ type: "stroke", payload }));
    },
    [sendMessage]
  );

  const onFrame = useCallback(
    (dataUrl: string) => {
      // Desactiva raster si no lo necesitas (rasterFps=0 abajo)
      sendMessage(JSON.stringify({ type: "canvas", payload: dataUrl }));
    },
    [sendMessage]
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(240px, 320px) 1fr",
        gap: 16,
        padding: 16,
        height: "100vh",
        boxSizing: "border-box",
        background: "#0f172a",
        color: "#e2e8f0",
      }}
    >
      <ControlPanel
        room={ROOM}
        connected={connected}
        prompt={prompt}
        setPrompt={setPrompt}
        sendPrompt={sendPrompt}
        color={color}
        setColor={setColor}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        mode={mode}
        setMode={setMode}
        onClear={() => canvasRef.current?.clear?.()}
        onUndo={() => canvasRef.current?.undo?.()}
        onRedo={() => canvasRef.current?.redo?.()}
      />

      <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%" }}>
        <div
          style={{
            width: "min(90vmin, 1024px)",
            aspectRatio: "1 / 1",
            border: "1px solid #334155",
            borderRadius: 12,
            overflow: "hidden",
            background: "#0b1220",
          }}
        >
          <DrawingCanvas
            ref={canvasRef}
            color={color}
            brushSize={brushSize}
            mode={mode}
            onStroke={onStroke}
            onFrame={onFrame}
            rasterFps={0}       // 0 = no enviar raster
            targetSize={512}    // tamaño del snapshot cuando rasterFps > 0
          />
        </div>
      </div>
    </div>
  );
}
