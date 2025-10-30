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

// media query hook ligero
function useMedia(query: string) {
  const [m, setM] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mm = matchMedia(query);
    const h = () => setM(mm.matches);
    mm.addEventListener("change", h);
    return () => mm.removeEventListener("change", h);
  }, [query]);
  return m;
}

export default function App() {
  const room = useMemo(() => getQueryParam(["room", "r"], "room-default"), []);
  const wsUrl = useMemo(() => buildWsUrl(room), [room]);

  const [color, setColor] = useState("#478792");
  const [size, setSize] = useState(12);
  const [mode, setMode] = useState<"draw" | "erase">("draw");
  const [connected, setConnected] = useState(false);
  const [api, setApi] = useState<CanvasAPI | null>(null);

  // responsive: breakpoint 900px (tablet/móvil)
  const isNarrow = useMedia("(max-width: 900px)");
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // sincroniza UI con el canvas
  useEffect(() => {
    const id = setInterval(() => {
      if (!api) return;
      setMode(api.getMode());
      setSize(api.getBrushSize());
    }, 250);
    return () => clearInterval(id);
  }, [api]);

  // layout styles
  const layoutStyle: React.CSSProperties = isNarrow
    ? {
        height: "100dvh",
        width: "100vw",
        display: "grid",
        gridTemplateRows: "48px 1fr", // topbar + contenido
        background: "#0b0e12",
        color: "#e9eef3",
      }
    : {
        height: "100dvh",
        width: "100vw",
        display: "grid",
        gridTemplateColumns: "320px 1fr", // sidebar fijo + lienzo
        background: "#0b0e12",
        color: "#e9eef3",
      };

  return (
    <div style={layoutStyle}>
      {/* Top bar solo en pantallas estrechas */}
      {isNarrow && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 12px",
            borderBottom: "1px solid #141a22",
            background: "#0c1218",
            position: "sticky",
            top: 0,
            zIndex: 30,
          }}
        >
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #243041",
              background: "#0a0f15",
              color: "#e9eef3",
              cursor: "pointer",
            }}
            aria-label="Abrir panel"
          >
            ☰ Panel
          </button>
          <div style={{ opacity: 0.8, fontSize: 14 }}>
            Sala: <code>{room}</code> {connected ? "• online" : "• offline"}
          </div>
        </div>
      )}

      {/* Sidebar (fijo en desktop, drawer en mobile) */}
      {!isNarrow ? (
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
            (window as any).__RTC_SEND__?.({ t: "prompt", room, text });
          }}
          onColorsFromImage={(hexes) => {
            if (hexes[0]) setColor(hexes[0]);
          }}
        />
      ) : (
        isSidebarOpen && (
          <div
            role="dialog"
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              background: "rgba(0,0,0,.45)",
              display: "grid",
              gridTemplateColumns: "min(86vw, 340px) 1fr",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                height: "100%",
                background: "#0c1218",
                borderRight: "1px solid #141a22",
                overflow: "auto",
              }}
            >
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
                  (window as any).__RTC_SEND__?.({ t: "prompt", room, text });
                }}
                onColorsFromImage={(hexes) => {
                  if (hexes[0]) setColor(hexes[0]);
                }}
              />
            </div>
            <div />
          </div>
        )
      )}

      {/* Área de lienzo: centra y escala */}
      <div
        style={{
          display: "grid",
          placeItems: "center",
          padding: isNarrow ? 8 : 16,
          overflow: "auto",
        }}
      >
        {/* El canvas interno sigue a 512x512, pero el contenedor permite escalar visualmente en móvil */}
        <div
          style={{
            // Escala para que quepa en la pantalla sin barras
            width: "min(92vw, 90vh)", // cuadrado máximo visible
            maxWidth: 540,
            aspectRatio: "1 / 1",
            display: "grid",
            placeItems: "center",
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
    </div>
  );
}
