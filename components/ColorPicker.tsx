// components/ColorPicker.tsx
import React, { useEffect, useMemo, useState } from "react";

/** ========= Utils de color ========= */
type RGB = { r: number; g: number; b: number };
type HSV = { h: number; s: number; v: number };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function hsvToRgb({ h, s, v }: HSV): RGB {
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (0 <= hh && hh < 1) { r = c; g = x; b = 0; }
  else if (1 <= hh && hh < 2) { r = x; g = c; b = 0; }
  else if (2 <= hh && hh < 3) { r = 0; g = c; b = x; }
  else if (3 <= hh && hh < 4) { r = 0; g = x; b = c; }
  else if (4 <= hh && hh < 5) { r = x; g = 0; b = c; }
  else if (5 <= hh && hh < 6) { r = c; g = 0; b = x; }
  const m = v - c;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

function rgbToHex({ r, g, b }: RGB) {
  // ✅ línea corregida (sin pad...String roto)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexToRgb(hex: string): RGB {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 255, g: 0, b: 0 };
}

function rgbToHsv({ r, g, b }: RGB): HSV {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rr: h = ((gg - bb) / d) % 6; break;
      case gg: h = (bb - rr) / d + 2; break;
      case bb: h = (rr - gg) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

/** ========= Props ========= */
type ColorPickerProps = {
  color: string;                          // hex actual, ej: #ff4d4d
  onChange: (hex: string) => void;        // callback al cambiar
  showHistory?: boolean;                  // muestra paleta de recientes
};

/** ========= Componente =========
 * Minimalista, accesible y sin dependencias.
 * - Soporta input nativo <input type="color" />
 * - Slider de tamaño HS(V) básicos para UX agradable
 * - Historial opcional
 */
const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange, showHistory = false }) => {
  const [hex, setHex] = useState(color || "#ff4d4d");

  useEffect(() => { setHex(color); }, [color]);

  // Estado HSV derivado
  const hsv = useMemo<HSV>(() => rgbToHsv(hexToRgb(hex)), [hex]);

  const [h, setH] = useState(hsv.h);
  const [s, setS] = useState(hsv.s);
  const [v, setV] = useState(Math.max(0.4, hsv.v)); // evita negros totales por UX

  // Recalcular hex cuando cambien sliders
  useEffect(() => {
    const rgb = hsvToRgb({ h, s, v });
    const h2 = rgbToHex(rgb);
    setHex(h2);
  }, [h, s, v]);

  // Notificar al padre cuando hex cambie
  useEffect(() => {
    if (!hex) return;
    onChange(hex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex]);

  // Historial simple (en memoria del componente)
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    if (!showHistory) return;
    setHistory((prev) => {
      if (!hex || prev[0] === hex) return prev;
      const next = [hex, ...prev.filter(c => c !== hex)];
      return next.slice(0, 12);
    });
  }, [hex, showHistory]);

  return (
    <div aria-label="Selector de color" style={{ display: "grid", gap: 8 }}>
      {/* Color nativo (rápido) */}
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 12, opacity: .8 }}>Color</span>
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          aria-label="Color"
          style={{ width: "100%", height: 36, padding: 0, background: "transparent", border: "1px solid #334155", borderRadius: 8 }}
        />
      </label>

      {/* Controles HSV simples */}
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: .8 }}>Tono (H)</span>
          <input
            type="range" min={0} max={360} value={Math.round(h)}
            onChange={(e) => setH(Number(e.target.value))}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: .8 }}>Saturación (S)</span>
          <input
            type="range" min={0} max={100} value={Math.round(s * 100)}
            onChange={(e) => setS(clamp01(Number(e.target.value) / 100))}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: .8 }}>Valor (V)</span>
          <input
            type="range" min={0} max={100} value={Math.round(v * 100)}
            onChange={(e) => setV(clamp01(Number(e.target.value) / 100))}
          />
        </label>
      </div>

      {/* Muestra */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          aria-label="Muestra de color"
          style={{
            width: 28, height: 28, borderRadius: 6, border: "1px solid #334155",
            background: hex
          }}
        />
        <code style={{ fontSize: 12, background: "#111827", border: "1px solid #222", padding: "2px 6px", borderRadius: 6 }}>
          {hex.toUpperCase()}
        </code>
      </div>

      {/* Historial opcional */}
      {showHistory && history.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: .8 }}>Recientes</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
            {history.map((c) => (
              <button
                key={c}
                onClick={() => setHex(c)}
                aria-label={`Usar ${c}`}
                title={c}
                style={{
                  height: 22,
                  borderRadius: 6,
                  border: "1px solid #334155",
                  background: c,
                  cursor: "pointer"
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
