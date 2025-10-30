import { useRef, useState } from "react";

type Props = {
  height: number; // px
  room: string;
  connected: boolean;
  color: string;
  onColor: (hex: string) => void;
  brushSize: number;
  onBrushSize: (n: number) => void;
  mode: "draw" | "erase";
  onMode: (m: "draw" | "erase") => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSendPrompt: (text: string) => void;
  onColorsFromImage: (colors: string[]) => void;
};

export default function BottomBar({
  height,
  room,
  connected,
  color,
  onColor,
  brushSize,
  onBrushSize,
  mode,
  onMode,
  onClear,
  onUndo,
  onRedo,
  onSendPrompt,
  onColorsFromImage,
}: Props) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [localPalette, setLocalPalette] = useState<string[]>([]);

  const openFile = () => fileRef.current?.click();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d")!;
      const W = 96, H = 96;
      c.width = W; c.height = H;
      ctx.drawImage(img, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;

      const cube = 16;
      const map = new Map<string, number>();
      for (let i = 0; i < data.length; i += 4) {
        const r = (data[i]   * (cube - 1) / 255) | 0;
        const g = (data[i+1] * (cube - 1) / 255) | 0;
        const b = (data[i+2] * (cube - 1) / 255) | 0;
        const key = `${r}-${g}-${b}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
      const toHex = (n: number) => n.toString(16).padStart(2, "0");
      const colors = [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([k]) => {
          const [r, g, b] = k.split("-").map((v) => Math.round((parseInt(v) * 255) / (cube - 1)));
          return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        });

      setLocalPalette(colors);
      onColorsFromImage(colors);
    };
    img.src = URL.createObjectURL(f);
    e.target.value = "";
  };

  return (
    <>
      {/* Barra fija inferior */}
      <div
        style={{
          height,
          borderTop: "1px solid #141a22",
          background: "#0c1218",
          display: "grid",
          gridTemplateColumns: "auto auto 1fr auto auto auto auto",
          alignItems: "center",
          gap: 10,
          padding: "6px 10px",
        }}
      >
        {/* Estado */}
        <span
          title={connected ? "Conectado" : "Desconectado"}
          style={{
            width: 10, height: 10, borderRadius: 999,
            background: connected ? "#22c55e" : "#ef4444",
          }}
        />
        <span style={{ opacity: 0.8, fontSize: 12, whiteSpace: "nowrap" }}>
          Sala: <code>{room}</code>
        </span>

        {/* Slider de tamaño (ocupa espacio flexible) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Size</span>
          <input
            type="range"
            min={1}
            max={60}
            value={brushSize}
            onChange={(e) => onBrushSize(parseInt(e.target.value, 10))}
            style={{ width: "28vw", maxWidth: 240 }}
          />
        </div>

        {/* Color */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }} title="Color">
          <input
            type="color"
            value={color}
            onChange={(e) => onColor(e.target.value)}
            style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #243041", background: "none" }}
          />
        </label>

        {/* Pincel / Borrador */}
        <button
          onClick={() => onMode("draw")}
          style={{
            padding: "6px 10px", borderRadius: 8, border: "1px solid #243041",
            background: mode === "draw" ? "#1a2330" : "#0a0f15", color: "#e9eef3"
          }}
          title="Pincel"
        >✏️</button>
        <button
          onClick={() => onMode("erase")}
          style={{
            padding: "6px 10px", borderRadius: 8, border: "1px solid #243041",
            background: mode === "erase" ? "#1a2330" : "#0a0f15", color: "#e9eef3"
          }}
          title="Borrador"
        >🧽</button>

        {/* Undo/Redo/Clear */}
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onUndo}  style={btn()} title="Deshacer">↩️</button>
          <button onClick={onRedo}  style={btn()} title="Rehacer">↪️</button>
          <button onClick={onClear} style={btn()} title="Borrar canvas">🗑️</button>
        </div>

        {/* Botones extra: Prompt y Paleta por imagen */}
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowPrompt(true)} style={btn()} title="Enviar prompt">💬</button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} hidden />
          <button onClick={openFile} style={btn()} title="Subir imagen → paleta">🎨</button>
        </div>
      </div>

      {/* Modal Prompt */}
      {showPrompt && (
        <div
          role="dialog"
          onClick={() => setShowPrompt(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
            display: "grid", placeItems: "center", zIndex: 50
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(92vw, 560px)",
              background: "#0c1218",
              border: "1px solid #243041",
              borderRadius: 12,
              padding: 12,
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 14, opacity: 0.8 }}>Prompt IA</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Escribe tu prompt…"
              style={{
                width: "100%", height: 120, borderRadius: 8,
                border: "1px solid #1b2330", background: "#0a0f15",
                color: "#e9eef3", padding: 8, resize: "none"
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowPrompt(false)} style={btn()}>Cancelar</button>
              <button
                onClick={() => { onSendPrompt(prompt); setShowPrompt(false); }}
                style={{ ...btn(), background: "linear-gradient(90deg,#6a5cff,#a855f7)", borderColor: "#3b2ad9", color: "white" }}
              >
                Enviar
              </button>
            </div>

            {!!localPalette.length && (
              <>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Paleta detectada recientemente:</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {localPalette.map((c, i) => (
                    <button
                      key={`${c}-${i}`}
                      onClick={() => onColor(c)}
                      title={c}
                      style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid #2a3546", background: c }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function btn() {
  return {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #243041",
    background: "#0a0f15",
    color: "#e9eef3",
    cursor: "pointer",
  } as React.CSSProperties;
}
