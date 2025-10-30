import { useMemo, useRef, useState } from "react";

type Props = {
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

const PRESETS = ["#ffffff", "#ffcc00", "#ff5a5f", "#36cfc9", "#1677ff", "#9c27b0", "#00e676", "#222833"];

export default function Sidebar({
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
  const [prompt, setPrompt] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [history, setHistory] = useState<string[]>([]);
  const histShown = useMemo(() => history.slice(-10).reverse(), [history]);

  const [imgPalette, setImgPalette] = useState<string[]>([]); // ← aquí guardamos la paleta extraída

  const pushHistory = (hex: string) => setHistory((h) => [...h, hex].slice(-60));
  const pickFile = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d")!;
      const W = 96, H = 96; // reduce para performance
      c.width = W; c.height = H;
      ctx.drawImage(img, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;

      const cube = 16; // 4 bits por canal
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

      setImgPalette(colors);
      onColorsFromImage(colors);
    };
    img.src = URL.createObjectURL(f);
    e.target.value = "";
  };

  return (
    <aside
      style={{
        height: "100%",
        borderRight: "1px solid #141a22",
        padding: 12,
        display: "grid",
        gridTemplateRows: "auto auto auto 1fr auto",
        gap: 12,
        background: "#0c1218",
        minWidth: 0,
      }}
    >
      {/* Estado conexión */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: 999,
            background: connected ? "#22c55e" : "#ef4444",
          }}
        />
        <strong>Conexión</strong>
        <span style={{ opacity: 0.7, marginLeft: 6 }}>(ver sala)</span>
        <span style={{ marginLeft: "auto", opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          room: {room}
        </span>
      </div>

      {/* Prompt */}
      <div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Aviso de IA (PROC/PROMPT)</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Escribe tu prompt..."
          style={{
            width: "100%",
            height: 84,
            borderRadius: 8,
            border: "1px solid #1b2330",
            background: "#0a0f15",
            color: "#e9eef3",
            padding: 8,
            resize: "none",
          }}
        />
        <button
          onClick={() => onSendPrompt(prompt)}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #243041",
            background: "linear-gradient(90deg,#6a5cff,#a855f7)",
            color: "white",
            cursor: "pointer",
          }}
        >
          Enviar mensaje
        </button>
      </div>

      {/* Color */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Color</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input
            type="color"
            value={color}
            onChange={(e) => {
              onColor(e.target.value);
              pushHistory(e.target.value);
            }}
            style={{ width: 120, height: 120, border: "1px solid #1b2330", borderRadius: 999, background: "none" }}
          />
          <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{color}</div>

            {/* Presets */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESETS.map((c) => (
                <button
                  key={c}
                  title={c}
                  onClick={() => {
                    onColor(c);
                    pushHistory(c);
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: "1px solid #2a3546",
                    background: c,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>

            {/* Historial */}
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Historial</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: "100%" }}>
              {histShown.map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  onClick={() => onColor(c)}
                  title={c}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: "1px solid #2a3546",
                    background: c,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>

            {/* Paleta desde imagen */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} hidden />
              <button
                onClick={pickFile}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #243041",
                  background: "#0a0f15",
                  color: "#e9eef3",
                  cursor: "pointer",
                }}
              >
                Subir imagen → paleta
              </button>
              {!!imgPalette.length && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {imgPalette.map((c, i) => (
                    <button
                      key={`${c}-${i}`}
                      onClick={() => {
                        onColor(c);
                        pushHistory(c);
                      }}
                      title={c}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        border: "1px solid #2a3546",
                        background: c,
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div />

      {/* Ajustes + acciones */}
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Ajustes del pincel</div>
        <input type="range" min={1} max={60} value={brushSize} onChange={(e) => onBrushSize(parseInt(e.target.value, 10))} />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onMode("draw")}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #243041",
              background: mode === "draw" ? "#1a2330" : "#0a0f15",
              color: "#e9eef3",
              cursor: "pointer",
            }}
          >
            ✏️ Pincel
          </button>
          <button
            onClick={() => onMode("erase")}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #243041",
              background: mode === "erase" ? "#1a2330" : "#0a0f15",
              color: "#e9eef3",
              cursor: "pointer",
            }}
          >
            🧽 Borrador
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onUndo}
            style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #243041", background: "#0a0f15", color: "#e9eef3", cursor: "pointer" }}
          >
            ⬅️ Deshacer
          </button>
          <button
            onClick={onRedo}
            style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #243041", background: "#0a0f15", color: "#e9eef3", cursor: "pointer" }}
          >
            ➡️ Rehacer
          </button>
        </div>

        <button
          onClick={onClear}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #3a475c",
            background: "#121a24",
            color: "#e9eef3",
            cursor: "pointer",
          }}
        >
          🗑️ Borrar canvas
        </button>
      </div>
    </aside>
  );
}
