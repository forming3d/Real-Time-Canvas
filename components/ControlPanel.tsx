// components/ControlPanel.tsx
import React from "react";
import ColorPicker from "./ColorPicker";

type Mode = "brush" | "eraser";

export type ControlPanelProps = {
  // Conexión
  room: string;
  connected: boolean;

  // Prompt
  prompt: string;
  setPrompt: (v: string) => void;
  sendPrompt: () => void;

  // Color y pincel
  color: string;
  setColor: (hex: string) => void;
  brushSize: number;
  setBrushSize: (n: number) => void;
  mode: Mode;
  setMode: (m: Mode) => void;

  // Acciones de lienzo
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

const ControlPanel: React.FC<ControlPanelProps> = ({
  room,
  connected,

  prompt,
  setPrompt,
  sendPrompt,

  color,
  setColor,
  brushSize,
  setBrushSize,
  mode,
  setMode,

  undo,
  redo,
  clearCanvas,
  canUndo = true,
  canRedo = true,
}) => {
  return (
    <aside
      style={{
        borderRight: "1px solid #1e293b",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "auto",
        background: "#0f172a",
        color: "#e2e8f0",
      }}
    >
      {/* Conexión / Sala en desplegable (oculta por defecto) */}
      <details style={{ border: "1px solid #334155", borderRadius: 8, background: "#0b1220" }}>
        <summary
          style={{
            listStyle: "none",
            cursor: "pointer",
            userSelect: "none",
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            aria-label={connected ? "Conectado" : "Desconectado"}
            title={connected ? "Conectado" : "Desconectado"}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: connected ? "#22c55e" : "#ef4444",
            }}
          />
          <strong style={{ marginRight: 6 }}>Conexión</strong>
          <span style={{ opacity: 0.7 }}>(ver sala)</span>
        </summary>
        <div style={{ padding: "8px 12px", borderTop: "1px solid #334155", fontSize: 13 }}>
          <div style={{ marginBottom: 6 }}>
            Sala (room): <code>{room}</code>
          </div>
          <div style={{ opacity: 0.75 }}>
            Abre este canvas con <code>?room={room}</code> para enlazar con tu TouchDesigner.
          </div>
        </div>
      </details>

      {/* Prompt */}
      <div>
        <label
          htmlFor="prompt"
          style={{ fontSize: 12, opacity: 0.75, display: "block", marginBottom: 6 }}
        >
          Aviso de IA (PROC/PROMPT)
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Escribe tu prompt…"
          rows={5}
          style={{
            width: "100%",
            resize: "vertical",
            padding: "10px 12px",
            background: "#0b1220",
            color: "#fff",
            border: "1px solid #222",
            borderRadius: 8,
            outline: "none",
          }}
        />
        <button
          onClick={sendPrompt}
          style={{
            marginTop: 8,
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: 0,
            background: "#a855f7",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Enviar mensaje
        </button>
      </div>

      {/* Selector de color (rueda H + SV + historial) */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Color</div>
        <ColorPicker color={color} onChange={setColor} showHistory />
      </div>

      {/* Ajustes del pincel */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Ajustes del pincel</div>
        <input
          type="range"
          min={2}
          max={80}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.currentTarget.value))}
          aria-label="Grosor de pincel"
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", marginTop: 8, gap: 8 }}>
          <button
            onClick={() => setMode("brush")}
            aria-pressed={mode === "brush"}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: mode === "brush" ? "2px solid #22c55e" : "1px solid #334155",
              background: "#0b1220",
              color: "#e2e8f0",
              cursor: "pointer",
            }}
          >
            ✏️ Pincel
          </button>
          <button
            onClick={() => setMode("eraser")}
            aria-pressed={mode === "eraser"}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: mode === "eraser" ? "2px solid #f43f5e" : "1px solid #334155",
              background: "#0b1220",
              color: "#e2e8f0",
              cursor: "pointer",
            }}
          >
            🧽 Borrador
          </button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
          {mode === "brush" ? "Modo Pincel" : "Modo Borrador"}
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          onClick={undo}
          disabled={!canUndo}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #334155",
            background: canUndo ? "#0b1220" : "#0b1220",
            color: canUndo ? "#e2e8f0" : "#64748b",
            cursor: canUndo ? "pointer" : "not-allowed",
          }}
        >
          ↩️ Deshacer
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #334155",
            background: canRedo ? "#0b1220" : "#0b1220",
            color: canRedo ? "#e2e8f0" : "#64748b",
            cursor: canRedo ? "pointer" : "not-allowed",
          }}
        >
          ↪️ Rehacer
        </button>
      </div>

      <button
        onClick={clearCanvas}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #334155",
          background: "#0b1220",
          color: "#e2e8f0",
          cursor: "pointer",
        }}
      >
        Borrar canvas
      </button>
    </aside>
  );
};

export default ControlPanel;
