import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import DrawingCanvas from "./components/DrawingCanvas";

// ----------------- utils -----------------
function getQueryParam(names: string[], def = ""): string {
  const q = new URLSearchParams(window.location.search);
  for (const n of names) {
    const v = q.get(n);
    if (v && v.trim()) return v.trim();
  }
  return def;
}

function buildWsUrl(room: string) {
  const base =
    import.meta.env.VITE_WS_URL ||
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
  const url = new URL(base);
  url.searchParams.set("role", "canvas");
  url.searchParams.set("room", room);
  return url.toString();
}

type CanvasAPI = {
  setMode: (m: "draw" | "erase") => void;
  getMode: () => "draw" | "erase";
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
  setBrushSize: (n: number) => void;
  getBrushSize: () => number;
};

export default function App() {
  const room = useMemo(() => getQueryParam(["room", "r"], "room-default"), []);
  const wsUrl = useMemo(() => buildWsUrl(room), [room]);

  const [color, setColor] = useState("#478792");
  const [size, setSize] = useState(12);
  const [mode, setMode] = useState<"draw" | "erase">("draw");
  const [connected, setConnected] = useState(false);

  const [api, setApi] = useState<CanvasAPI | null>(null);

  // sincroniza UI con el canvas
  useEffect(() => {
    const id = setInterval(() => {
      if (!api) return;
      setMode(api.getMode());
      setSize(api.getBrushSize());
    }, 250);
    return () => clearInterval(id);
  }, [api]);

  return (
    <div
      style={{
        height: "100dvh",
        width: "100vw",
        display: "grid",
        gridTemplateColumns: "320px 1fr",
        background: "#0b0e12",
        color: "#e9eef3",
      }}
    >
      {/* Sidebar izquierda */}
      <Sidebar
        room={room}
        connected={connected}
        color={color}
        onColor={setColor}
        brushSize={size}
        onBrushSize={(n) => {
          setSize(n);
          api?.setBrushSize(n);
        }}
        mode={mode}
        onMode={(m) => {
          setMode(m);
          api?.setMode(m);
        }}
        onClear={() => api?.clearAll()}
        onUndo={() => api?.undo()}
        onRedo={() => api?.redo()}
        onSendPrompt={(text) => {
          (window as any).__RTC_SEND__?.({
            t: "prompt",
            room,
            text,
          });
        }}
        onColorsFromImage={(hexes) => {
          if (hexes[0]) setColor(hexes[0]);
        }}
      />

      {/* Área de lienzo */}
      <div
        style={{
          display: "grid",
          placeItems: "center",
          padding: 16,
        }}
      >
        <DrawingCanvas
          wsUrl={wsUrl}
          room={room}
          color={color}
          size={size}
          mode={mode}
          onApiReady={setApi}
          onConnectionChange={setConnected}
        />
      </div>
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import DrawingCanvas from "./components/DrawingCanvas";

// ----------------- utils -----------------
function getQueryParam(names: string[], def = ""): string {
  const q = new URLSearchParams(window.location.search);
  for (const n of names) {
    const v = q.get(n);
    if (v && v.trim()) return v.trim();
  }
  return def;
}

function buildWsUrl(room: string) {
  const base =
    import.meta.env.VITE_WS_URL ||
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
  const url = new URL(base);
  url.searchParams.set("role", "canvas");
  url.searchParams.set("room", room);
  return url.toString();
}

type CanvasAPI = {
  setMode: (m: "draw" | "erase") => void;
  getMode: () => "draw" | "erase";
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
  setBrushSize: (n: number) => void;
  getBrushSize: () => number;
};

export default function App() {
  const room = useMemo(() => getQueryParam(["room", "r"], "room-default"), []);
  const wsUrl = useMemo(() => buildWsUrl(room), [room]);

  const [color, setColor] = useState("#478792");
  const [size, setSize] = useState(12);
  const [mode, setMode] = useState<"draw" | "erase">("draw");
  const [connected, setConnected] = useState(false);

  const [api, setApi] = useState<CanvasAPI | null>(null);

  // sincroniza UI con el canvas
  useEffect(() => {
    const id = setInterval(() => {
      if (!api) return;
      setMode(api.getMode());
      setSize(api.getBrushSize());
    }, 250);
    return () => clearInterval(id);
  }, [api]);

  return (
    <div
      style={{
        height: "100dvh",
        width: "100vw",
        display: "grid",
        gridTemplateColumns: "320px 1fr",
        background: "#0b0e12",
        color: "#e9eef3",
      }}
    >
      {/* Sidebar izquierda */}
      <Sidebar
        room={room}
        connected={connected}
        color={color}
        onColor={setColor}
        brushSize={size}
        onBrushSize={(n) => {
          setSize(n);
          api?.setBrushSize(n);
        }}
        mode={mode}
        onMode={(m) => {
          setMode(m);
          api?.setMode(m);
        }}
        onClear={() => api?.clearAll()}
        onUndo={() => api?.undo()}
        onRedo={() => api?.redo()}
        onSendPrompt={(text) => {
          (window as any).__RTC_SEND__?.({
            t: "prompt",
            room,
            text,
          });
        }}
        onColorsFromImage={(hexes) => {
          if (hexes[0]) setColor(hexes[0]);
        }}
      />

      {/* Área de lienzo */}
      <div
        style={{
          display: "grid",
          placeItems: "center",
          padding: 16,
        }}
      >
        <DrawingCanvas
          wsUrl={wsUrl}
          room={room}
          color={color}
          size={size}
          mode={mode}
          onApiReady={setApi}
          onConnectionChange={setConnected}
        />
      </div>
    </div>
  );
}
