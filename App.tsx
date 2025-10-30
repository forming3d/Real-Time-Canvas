import { useMemo, useState } from "react";
import DrawingCanvas from "./components/DrawingCanvas";
import ControlPanel from "./components/ControlPanel";
import ColorPicker from "./components/ColorPicker";

function getQueryParam(names: string[], def = ""): string {
  const q = new URLSearchParams(window.location.search);
  for (const n of names) {
    const v = q.get(n);
    if (v && v.trim()) return v.trim();
  }
  return def;
}

function buildWsUrl(room: string) {
  // Si no hay VITE_WS_URL, se deduce del host actual
  const base =
    import.meta.env.VITE_WS_URL ||
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
  const url = new URL(base);
  // rol=canvas para que tu servidor diferencie clientes
  url.searchParams.set("role", "canvas");
  if (room) url.searchParams.set("room", room);
  return url.toString();
}

export default function App() {
  const [color, setColor] = useState<string>("#ffcc00");
  const [size, setSize] = useState<number>(6);

  // ROOM desde URL (?room=xxx o ?r=xxx). Si no, "room-default"
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
        <ColorPicker value={color} onChange={setColor} />
        <ControlPanel size={size} onSizeChange={setSize} />
      </footer>
    </div>
  );
}
