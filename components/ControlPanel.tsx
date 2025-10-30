type Props = {
  size: number;
  onSizeChange: (n: number) => void;
  mode: "draw" | "erase";
  onModeChange: (m: "draw" | "erase") => void;
  onClear: () => void;
  onSaveBefore: () => void;
  onToggleCompare: (show: boolean) => void; // mostrar/ocultar overlay del BEFORE
  onRevertBefore: () => void;
  hasBefore: boolean;
};

export default function ControlPanel({
  size,
  onSizeChange,
  mode,
  onModeChange,
  onClear,
  onSaveBefore,
  onToggleCompare,
  onRevertBefore,
  hasBefore,
}: Props) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
      {/* Grosor */}
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>Grosor</span>
        <input
          type="range"
          min={1}
          max={40}
          value={size}
          onChange={(e) => onSizeChange(parseInt(e.target.value, 10))}
        />
        <code>{size}px</code>
      </label>

      {/* Modo */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          onClick={() => onModeChange("draw")}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #2a2a33",
            background: mode === "draw" ? "#1e1e27" : "transparent",
            cursor: "pointer",
          }}
          title="Dibujar"
        >
          ✏️ Dibujar
        </button>
        <button
          onClick={() => onModeChange("erase")}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #2a2a33",
            background: mode === "erase" ? "#1e1e27" : "transparent",
            cursor: "pointer",
          }}
          title="Borrar"
        >
          🩹 Borrar
        </button>
      </div>

      {/* Limpiar */}
      <button
        onClick={onClear}
        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #2a2a33", cursor: "pointer" }}
        title="Limpiar todo"
      >
        🗑️ Limpiar
      </button>

      {/* Before / After */}
      <button
        onClick={onSaveBefore}
        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #2a2a33", cursor: "pointer" }}
        title="Guardar estado como BEFORE"
      >
        📌 Guardar ‘Before’
      </button>

      <button
        disabled={!hasBefore}
        onMouseDown={() => onToggleCompare(true)}
        onMouseUp={() => onToggleCompare(false)}
        onMouseLeave={() => onToggleCompare(false)}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid #2a2a33",
          cursor: hasBefore ? "pointer" : "not-allowed",
          opacity: hasBefore ? 1 : 0.5,
        }}
        title="Mantén pulsado para ver el BEFORE sobre el lienzo"
      >
        👁️ Ver Before (mantener)
      </button>

      <button
        disabled={!hasBefore}
        onClick={onRevertBefore}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid #2a2a33",
          cursor: hasBefore ? "pointer" : "not-allowed",
          opacity: hasBefore ? 1 : 0.5,
        }}
        title="Revertir lienzo al BEFORE"
      >
        ↩️ Revertir a Before
      </button>
    </div>
  );
}
