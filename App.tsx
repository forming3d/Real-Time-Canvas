import { useEffect, useMemo, useState } from "react";
import DrawingCanvas from "./components/DrawingCanvas";
import ControlPanel from "./components/ControlPanel";
import ColorPicker from "./components/ColorPicker";

// --- Utils -------------------------------------------------------------
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
  if (room) url.searchParams.set("room", room);
  return url.toString();
}

// Tipos del “bridge” que expone el canvas en window
type CanvasAPI = {
  mode: "draw" | "erase";
  setMode: (m: "draw" | "erase") => void;
  clearAll: () => void;
  saveBefore: () => void;
  setShowCompare: (b: boolean) => void;
  revertBefore: () => void;
  hasBefore: boolean;
};

// Helper para leer el bridge de forma segura
function getCanvasAPI(): CanvasAPI | undefined {
  // @ts-ignore
  return (window as any).__RTC_CANVAS_API__ as CanvasAPI | undefined;
}

// --- Componente --------------------------------------------------------
export default function App() {
  const [color, setColor] = useState<string>("#ffcc00");
  const [size, setSize] = useState<number>(6);

  // Estado reflejado desde el canvas (para resaltar botones y deshabilitar)
  const [mode, setModeState] = useState<"draw" | "erase">("draw");
  const [hasBefore, setHasBefore] = useState<boolean>(false);

  // Sincroniza cada ~200 ms con el bridge del canvas para mantener el UI al día
  useEffect(() => {
    const id = setInterval(() => {
      const api = getCanvasAPI();
      if (!api) return;
      setModeState((prev) => (prev !== api.mode ? api.mode : prev));
      setHasBefore((prev) => (prev !== api.hasBefore ? api.hasBefore : prev));
    }, 200);
    return () => clearInterval(id);
  }, []);

  // ROOM y URL del WS
  const room = useMemo(() => getQueryParam(["room", "r"], "room-default"), []);
  const wsUrl = useMemo(() => buildWsUrl(room), [room]);

  return (
    <div
      style={{
        height: "100dvh",
        width: "100vw",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        background: "#0b0b0f",
        color: "#eaeaea",
      }}
    >
      <header style={{ padding: "8px 12px", borderBottom: "1px solid #1f1f26" }}>
        <strong>Real-Time Canvas</strong> — room: <code>{room}</code>
      </header>

      <main style={{ position: "relative", overflow: "hidden" }}>
        <DrawingCanvas color={color} size={size} wsUrl={wsUrl} room={room} />
      </main>

      <footer
        style={{
          padding: "10px 12px",
          borderTop: "1px solid #1f1f26",
          display: "grid",
          gap: 8,
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
        }}
      >
        {/* Selector de color */}
        <ColorPicker value={color} onChange={setColor} />

        {/* Panel de controles con Erase + Before/After */}
        <ControlPanel
          size={size}
          onSizeChange={setSize}
          mode={mode}
          onModeChange={(m) => getCanvasAPI()?.setMode(m)}
          onClear={() => getCanvasAPI()?.clearAll()}
          onSaveBefore={() => getCanvasAPI()?.saveBefore()}
          onToggleCompare={(b) => getCanvasAPI()?.setShowCompare(b)}
          onRevertBefore={() => getCanvasAPI()?.revertBefore()}
          hasBefore={hasBefore}
        />
      </footer>
    </div>
  );
}
