import React, { useEffect, useMemo, useRef, useState } from "react";

/** ========= Utiles de color ========= */
type RGB = { r: number; g: number; b: number };
type HSV = { h: number; s: number; v: number };

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function hsvToRgb({ h, s, v }: HSV): RGB {
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r=0, g=0, b=0;
  if (0 <= hh && hh < 1) { r = c; g = x; b = 0; }
  else if (1 <= hh && hh < 2) { r = x; g = c; b = 0; }
  else if (2 <= hh && hh < 3) { r = 0; g = c; b = x; }
  else if (3 <= hh && hh < 4) { r = 0; g = x; b = c; }
  else if (4 <= hh && hh < 5) { r = x; g = 0; b = c; }
  else if (5 <= hh && hh < 6) { r = c; g = 0; b = x; }
  const m = v - c;
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}
function rgbToHex({ r, g, b }: RGB) {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function hexToRgb(hex: string): RGB {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return { r: 255, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function rgbToHsv({ r, g, b }: RGB): HSV {
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rf: h = 60 * (((gf - bf) / d) % 6); break;
      case gf: h = 60 * ((bf - rf) / d + 2); break;
      case bf: h = 60 * ((rf - gf) / d + 4); break;
    }
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

/** ========= Picker ========= */

export type ColorPickerProps = {
  color: string;               // HEX controlado
  onChange: (hex: string) => void;
  showHistory?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

const RING_THICKNESS = 18;     // grosor de la rueda
const PADDING = 6;             // separación rueda/cuadro SV

export default function ColorPicker({
  color,
  onChange,
  showHistory = true,
  className,
  style
}: ColorPickerProps) {
  const [hsv, setHSV] = useState<HSV>(() => rgbToHsv(hexToRgb(color)));
  const [history, setHistory] = useState<string[]>(() => [color]);
  const [imagePalette, setImagePalette] = useState<string[]>([]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const wheelRef = useRef<HTMLCanvasElement | null>(null);
  const svRef = useRef<HTMLCanvasElement | null>(null);
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  // sincroniza si cambia color desde arriba
  useEffect(() => {
    const cur = rgbToHsv(hexToRgb(color));
    setHSV(cur);
    setHistory((h) => (h[0] === color ? h : [color, ...h.filter(c => c !== color)].slice(0, 10)));
  }, [color]);

  // dibuja rueda + cuadro SV (y redimensiona)
  useEffect(() => {
    const wrap = wrapRef.current;
    const wheel = wheelRef.current;
    const sv = svRef.current;
    if (!wrap || !wheel || !sv) return;

    const paintAll = () => {
      const rect = wrap.getBoundingClientRect();
      const size = Math.min(rect.width, 260);
      [wheel, sv].forEach((c) => {
        c.width = Math.round(size * dpr);
        c.height = Math.round(size * dpr);
        c.style.width = `${size}px`;
        c.style.height = `${size}px`;
      });
      drawWheel(wheel, hsv.h);
      drawSV(sv, hsv);
      drawMarkers(wheel, sv, hsv);
    };

    paintAll();
    const ro = new ResizeObserver(paintAll);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [hsv.h, dpr]); // eslint-disable-line

  // ======== interacciones: eventos SOLO en wheel (touch-action none) ========
  useEffect(() => {
    const wheel = wheelRef.current!;
    const sv = svRef.current!;
    if (!wheel || !sv) return;

    let dragging: "hue" | "sv" | null = null;

    const geom = () => {
      const size = wheel.width;
      const cx = size / 2, cy = size / 2;
      const outer = (size / 2) - PADDING * dpr;
      const inner = outer - RING_THICKNESS * dpr;
      const side  = Math.min(inner * Math.SQRT2, outer * 2 - (RING_THICKNESS * dpr));
      const start = (size - side) / 2;
      return { size, cx, cy, outer, inner, side, start };
    };

    const getXY = (ev: PointerEvent) => {
      const rect = wheel.getBoundingClientRect();
      return { x: (ev.clientX - rect.left) * dpr, y: (ev.clientY - rect.top) * dpr };
    };

    const updateHue = (x: number, y: number) => {
      const { cx, cy, outer, inner } = geom();
      const dx = x - cx, dy = y - cy;
      const r = Math.sqrt(dx*dx + dy*dy);
      if (r < inner || r > outer) return false; // fuera del anillo
      let deg = Math.atan2(dy, dx) * 180 / Math.PI;
      if (deg < 0) deg += 360;
      const next = { ...hsv, h: deg };
      setHSV(next);
      onChange(rgbToHex(hsvToRgb(next)));
      drawWheel(wheel, next.h);
      drawSV(sv, next);
      drawMarkers(wheel, sv, next);
      return true;
    };

    const updateSV = (x: number, y: number) => {
      const { side, start } = geom();
      if (x < start || y < start || x > start + side || y > start + side) return false;
      const s = clamp01((x - start) / side);
      const v = clamp01(1 - (y - start) / side);
      const next = { ...hsv, s, v };
      setHSV(next);
      onChange(rgbToHex(hsvToRgb(next)));
      drawSV(sv, next);
      drawMarkers(wheel, sv, next);
      return true;
    };

    const onDown = (ev: PointerEvent) => {
      const { x, y } = getXY(ev);
      if (updateSV(x, y)) dragging = "sv";
      else if (updateHue(x, y)) dragging = "hue";
      else dragging = null;

      if (dragging) {
        try { (wheel as any).setPointerCapture?.(ev.pointerId); } catch {}
        ev.preventDefault();
      }
    };

    const onMove = (ev: PointerEvent) => {
      if (!dragging) return;
      ev.preventDefault(); // evita scroll/zoom durante el drag en mobile
      const { x, y } = getXY(ev);
      if (dragging === "sv") updateSV(x, y); else updateHue(x, y);
    };

    const endDrag = (ev: PointerEvent) => {
      dragging = null;
      try { (wheel as any).releasePointerCapture?.(ev.pointerId); } catch {}
    };

    wheel.addEventListener("pointerdown", onDown, { passive: false });
    window.addEventListener("pointermove", onMove as any, { passive: false });
    window.addEventListener("pointerup", endDrag as any);
    window.addEventListener("pointercancel", endDrag as any);

    return () => {
      wheel.removeEventListener("pointerdown", onDown as any);
      window.removeEventListener("pointermove", onMove as any);
      window.removeEventListener("pointerup", endDrag as any);
      window.removeEventListener("pointercancel", endDrag as any);
    };
  }, [hsv, onChange, dpr]);

  // ======== dibujo ========
  function drawWheel(canvas: HTMLCanvasElement, hueDeg: number) {
    const ctx = canvas.getContext("2d")!;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2, cy = height / 2;
    const outer = (Math.min(width, height) / 2) - PADDING * dpr;
    const inner = outer - RING_THICKNESS * dpr;

    for (let a = 0; a < 360; a += 1) {
      const grad = ctx.createLinearGradient(
        cx + Math.cos((a - 1) * Math.PI / 180) * outer, cy + Math.sin((a - 1) * Math.PI / 180) * outer,
        cx + Math.cos((a + 1) * Math.PI / 180) * outer, cy + Math.sin((a + 1) * Math.PI / 180) * outer
      );
      grad.addColorStop(0, rgbToHex(hsvToRgb({ h: a - 1, s: 1, v: 1 })));
      grad.addColorStop(1, rgbToHex(hsvToRgb({ h: a + 1, s: 1, v: 1 })));
      ctx.beginPath();
      ctx.strokeStyle = grad as any;
      ctx.lineWidth = (outer - inner);
      ctx.arc(cx, cy, (outer + inner) / 2, (a - 1) * Math.PI / 180, (a + 1) * Math.PI / 180);
      ctx.stroke();
    }
  }

  function drawSV(canvas: HTMLCanvasElement, { h }: HSV) {
    const ctx = canvas.getContext("2d")!;
    const { width, height } = canvas;
    const size = Math.min(width, height);
    const outer = (Math.min(width, height) / 2) - PADDING * dpr;
    const inner = outer - RING_THICKNESS * dpr;
    const side = Math.min(inner * Math.SQRT2, outer * 2 - (RING_THICKNESS * dpr));
    const start = (size - side) / 2;

    const hueHex = rgbToHex(hsvToRgb({ h, s: 1, v: 1 }));

    ctx.clearRect(0, 0, width, height);

    const g1 = ctx.createLinearGradient(start, start, start + side, start);
    g1.addColorStop(0, "#ffffff");
    g1.addColorStop(1, hueHex);
    ctx.fillStyle = g1;
    ctx.fillRect(start, start, side, side);

    const g2 = ctx.createLinearGradient(start, start, start, start + side);
    g2.addColorStop(0, "rgba(0,0,0,0)");
    g2.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = g2;
    ctx.fillRect(start, start, side, side);

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1 * dpr;
    ctx.strokeRect(start - 0.5, start - 0.5, side + 1, side + 1);
  }

  function drawMarkers(wheel: HTMLCanvasElement, sv: HTMLCanvasElement, { h, s, v }: HSV) {
    const wctx = wheel.getContext("2d")!;
    const sctx = sv.getContext("2d")!;
    const { width, height } = wheel;
    const cx = width / 2, cy = height / 2;
    const outer = (Math.min(width, height) / 2) - PADDING * dpr;
    const inner = outer - RING_THICKNESS * dpr;

    // marcador HUE (rueda)
    const ang = h * Math.PI / 180;
    const rMid = (outer + inner) / 2;
    const wx = cx + Math.cos(ang) * rMid;
    const wy = cy + Math.sin(ang) * rMid;
    wctx.save();
    wctx.beginPath();
    wctx.strokeStyle = "#fff";
    wctx.lineWidth = 2 * dpr;
    wctx.arc(wx, wy, 6 * dpr, 0, Math.PI * 2);
    wctx.stroke();
    wctx.beginPath();
    wctx.strokeStyle = "#000";
    wctx.lineWidth = 1 * dpr;
    wctx.arc(wx, wy, 8 * dpr, 0, Math.PI * 2);
    wctx.stroke();
    wctx.restore();

    // marcador SV (cuadro)
    const size = sv.width;
    const side = Math.min(inner * Math.SQRT2, outer * 2 - (RING_THICKNESS * dpr));
    const start = (size - side) / 2;
    const sx = start + s * side;
    const sy = start + (1 - v) * side;
    sctx.save();
    sctx.beginPath();
    sctx.strokeStyle = "#fff";
    sctx.lineWidth = 2 * dpr;
    sctx.arc(sx, sy, 6 * dpr, 0, Math.PI * 2);
    sctx.stroke();
    sctx.beginPath();
    sctx.strokeStyle = "#000";
    sctx.lineWidth = 1 * dpr;
    sctx.arc(sx, sy, 8 * dpr, 0, Math.PI * 2);
    sctx.stroke();
    sctx.restore();
  }

  /** ====== paleta desde imagen (cuantización simple 12x12x12) ====== */
  const onPickImage = async (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d")!;
      const W = 64, H = 64;
      c.width = W; c.height = H;
      ctx.drawImage(img, 0, 0, W, H);
      const { data } = ctx.getImageData(0, 0, W, H);
      const bins = new Map<string, number>();
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 32) continue;
        const R = Math.floor(r / 21), G = Math.floor(g / 21), B = Math.floor(b / 21);
        const key = `${R},${G},${B}`;
        bins.set(key, (bins.get(key) || 0) + 1);
      }
      const top = [...bins.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([k]) => {
          const [R, G, B] = k.split(",").map(Number);
          return rgbToHex({ r: R * 21 + 10, g: G * 21 + 10, b: B * 21 + 10 });
        });
      setImagePalette(top);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const curHex = useMemo(() => rgbToHex(hsvToRgb(hsv)), [hsv]);

  return (
    <div className={className} style={style}>
      <div ref={wrapRef} style={{ display: "grid", placeItems: "center" }}>
        <div style={{ position: "relative" }}>
          {/* Eventos SOLO en wheel; SV dibuja por encima pero no captura */}
          <canvas
            ref={wheelRef}
            aria-label="Rueda de color (tono)"
            style={{ touchAction: "none" }}   // importante para drag táctil
          />
          <canvas
            ref={svRef}
            aria-label="Cuadro Saturación/Valor"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          />
        </div>
      </div>

      {/* Color actual */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <div aria-label="Color actual" title={curHex}
             style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #334155", background: curHex }} />
        <span style={{ fontFamily: "monospace" }}>{curHex}</span>
      </div>

      {/* Historial */}
      {showHistory && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <strong style={{ fontSize: 12, opacity: .85 }}>Historial</strong>
            <button
              onClick={() => setHistory([])}
              style={{ fontSize: 12, background: "transparent", color: "#93c5fd", border: "none", cursor: "pointer" }}
              aria-label="Limpiar historial"
            >
              Clear
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
            {history.map((c) => (
              <button
                key={c}
                onClick={() => onChange(c)}
                aria-label={`Usar ${c}`}
                style={{ height: 22, borderRadius: 6, border: "1px solid #334155", background: c, cursor: "pointer" }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {/* Paleta desde imagen */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <strong style={{ fontSize: 12, opacity: .85 }}>Paleta desde imagen</strong>
          <label style={{ fontSize: 12, color: "#93c5fd", cursor: "pointer" }}>
            Subir…
            <input
              type="file"
              accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickImage(f); }}
              style={{ display: "none" }}
            />
          </label>
        </div>
        {imagePalette.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 6 }}>
            {imagePalette.map((c) => (
              <button
                key={c}
                onClick={() => onChange(c)}
                aria-label={`Usar ${c} de imagen`}
                style={{ height: 22, borderRadius: 6, border: "1px solid #334155", background: c, cursor: "pointer" }}
                title={c}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
