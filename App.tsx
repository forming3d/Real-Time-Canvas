import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import BottomBar from "./components/BottomBar";
import DrawingCanvas from "./components/DrawingCanvas";

// ---------- utils ----------
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

// hook tamaño viewport (reacciona a barra de direcciones móvil)
function useViewport() {
  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);
  useEffect(() => {
    const onR = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener("resize", onR);
    window.addEventListener("orientationchange", onR);
    return () => {
      window.removeEventListener("resize", onR);
      window.removeEventListener("orientationchange", onR);
    };
  }, []);
  return { vw, vh };
}

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

  // responsive por ALTURA
  const { vw, vh } = useViewport();
  const isCompactLandscape = vh < 600 && vw > vh; // clave: poco alto y en horizontal

  // estilos raíz: sin scroll
  const rootStyle: React.CSSProperties = {
    height: "100dvh",
    width: "100vw",
    overflow: "hidden",
    background: "#0b0e12",
    color: "#e9eef3",
    display: "grid",
    gridTemplateColumns: isCompactLandscape ? "1fr" : "320px 1fr",
    gridTemplateRows: isCompactLandscape ? "1fr auto" : "1fr",
  };

  // canvas wrapper: sin barras
  // si compacto, el canvas se ajusta debajo para no chocar con la BottomBar
  const barH = Math.max(48, Math.min(Math.round(vh * 0.09), 64));
  const canvasBoxStyle: React.CSSProperties = isCompactLandscape
    ? {
        display: "grid",
        placeItems: "center",
        padding: 8,
        overflow: "hidden",
      }
    : {
        display: "grid",
        placeItems: "center",
        padding: 16,
        overflow: "hidden",
      };

  const canvasSquareStyle: React.CSSProperties = isCompactLandscape
    ? {
        width: `min(98vw, ${Math.max(100, vh - barH - 8)}px)`,
        height: `min(98vw, ${Math.max(100, vh - barH - 8)}px)`,
        maxWidth: 540,
        maxHeight: 540,
        display: "grid",
        placeItems: "center",
      }
    : {
        width: "min(92vw, 90vh)",
        maxWidth: 540,
        aspectRatio: "1 / 1",
        display: "grid",
        placeItems: "center",
      };

  return (
    <div style={rootStyle}>
      {/* Panel / Barra */}
      {isCompactLandscape ? (
        // nada arriba; la BottomBar va al final del grid
        <>
          <div style={canvasBoxStyle}>
            <div style={canvasSquareStyle}>
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

          <BottomBar
            height={barH}
            room={room}
            connected={connected}
            color={color}
            onColor={(c) => {
              setColor(c);
            }}
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
              // TD
              (window as any).__RTC_SEND__?.({ type: "prompt", payload: text });
              // Web (opcional)
              (window as any).__RTC_SEND__?.({ t: "prompt", room, text });
            }}
            onColorsFromImage={(hexes) => {
              if (hexes[0]) setColor(hexes[0]);
            }}
          />
        </>
      ) : (
        <>
          {/* Sidebar fijo (desktop / portrait) */}
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
              (window as any).__RTC_SEND__?.({ type: "prompt", payload: text });
              (window as any).__RTC_SEND__?.({ t: "prompt", room, text });
            }}
            onColorsFromImage={(hexes) => {
              if (hexes[0]) setColor(hexes[0]);
            }}
          />

          {/* Canvas a la derecha */}
          <div style={canvasBoxStyle}>
            <div style={canvasSquareStyle}>
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
        </>
      )}
    </div>
  );
}
