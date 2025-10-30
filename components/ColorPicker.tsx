// components/ColorPicker.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

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
  @@ -20, 14 + 21, 10 @@function hsvToRgb({ h, s, v }: HSV): RGB {
    const m = v - c;
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  }
  const rgbToHex = ({ r, g, b }: RGB) => `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  function hexToRgb(hex: string): RGB {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 255, g: 0, b: 0 };
  }
  function rgbToHsv({ r, g, b }: RGB): HSV {
    const rf = r / 255, gf = g / 255, bf = b / 255;
    @@ -48, 24 + 45, 23 @@function rgbToHsv({ r, g, b }: RGB): HSV {
    }

      /** ========= Picker ========= */
      export type ColorPickerProps = {
        color: string;
        onChange: (hex: string) => void;
        showHistory?: boolean;
        className?: string;
        style?: React.CSSProperties;
      };

    const RING_THICKNESS = 18;
    const PADDING = 6;

    export default function ColorPicker({
      color,
      onChange,
      showHistory = true,
      className,
      style,
    }: ColorPickerProps) {
      const [hsv, setHSV] = useState<HSV>(() => rgbToHsv(hexToRgb(color)));
      const [history, setHistory] = useState<string[]>(() => [color]);
      @@ -76, 18 + 72, 16 @@ export default function ColorPicker({
        const svRef = useRef<HTMLCanvasElement | null>(null);
        const dpr = Math.max(1, window.devicePixelRatio || 1);

        // Sync externo
        useEffect(() => {
          const cur = rgbToHsv(hexToRgb(color));
          setHSV(cur);
          setHistory((h) => (h[0] === color ? h : [color, ...h.filter((c) => c !== color)].slice(0, 10)));
        }, [color]);

      // Pintado + resize
      useEffect(() => {
        const wrap = wrapRef.current, wheel = wheelRef.current, sv = svRef.current;
        if (!wrap || !wheel || !sv) return;

        const paintAll = () => {
          @@ -110, 7 + 104, 7 @@ export default function ColorPicker({
            return () => ro.disconnect();
        }, [hsv.h, dpr]); // eslint-disable-line

      // ===== Interacciones (drag robusto) =====
      useEffect(() => {
        const wheel = wheelRef.current!;
        const sv = svRef.current!;
        @@ -123, 7 + 117, 7 @@ export default function ColorPicker({
          const cx = size / 2, cy = size / 2;
        const outer = (size / 2) - PADDING * dpr;
        const inner = outer - RING_THICKNESS * dpr;
        const side = Math.min(inner * Math.SQRT2, outer * 2 - (RING_THICKNESS * dpr));
        const start = (size - side) / 2;
        return { size, cx, cy, outer, inner, side, start };
      };
      @@ -133, 11 + 127, 10 @@ export default function ColorPicker({
        return { x: (ev.clientX - rect.left) * dpr, y: (ev.clientY - rect.top) * dpr
    };
  };

  // Actualiza HUE (en drag no exigimos estar en el anillo, solo usamos el ángulo)
  const setHueByXY = (x: number, y: number) => {
    const { cx, cy } = geom();
    const dx = x - cx, dy = y - cy;
    let deg = Math.atan2(dy, dx) * 180 / Math.PI;
    if (deg < 0) deg += 360;
    const next = { ...hsv, h: deg };
    @@ -146, 12 + 139, 19 @@ export default function ColorPicker({
      drawWheel(wheel, next.h);
    drawSV(sv, next);
    drawMarkers(wheel, sv, next);
  };

  const tryStartHue = (x: number, y: number) => {
    const { cx, cy, outer, inner } = geom();
    const dx = x - cx, dy = y - cy;
    const r = Math.sqrt(dx * dx + dy * dy);
    return r >= inner && r <= outer;
  };

  const setSVByXY = (x: number, y: number) => {
    const { side, start } = geom();
    const sOk = x >= start && x <= start + side && y >= start && y <= start + side;
    if (!sOk) return false;
    const s = clamp01((x - start) / side);
    const v = clamp01(1 - (y - start) / side);
    const next = { ...hsv, s, v };
    @@ -164, 42 + 164, 45 @@ export default function ColorPicker({

      const onDown = (ev: PointerEvent) => {
        const { x, y } = getXY(ev);
        // prioridad: SV si está dentro del cuadrado; si no, HUE si está en el anillo
        if (setSVByXY(x, y)) dragging = "sv";
        else if (tryStartHue(x, y)) { setHueByXY(x, y); dragging = "hue"; }
        else dragging = null;

        if (dragging) {
          try { wheel.setPointerCapture(ev.pointerId); } catch { }
          ev.preventDefault();
        }
      };

    const onMove = (ev: PointerEvent) => {
      if (!dragging) return;
      ev.preventDefault();
      const { x, y } = getXY(ev);
      if (dragging === "sv") setSVByXY(x, y);
      else setHueByXY(x, y); // ← no comprobamos radio durante el drag
    };

    const endDrag = (ev: PointerEvent) => {
      if (!dragging) return;
      dragging = null;
      try { wheel.releasePointerCapture(ev.pointerId); } catch { }
    };

    wheel.addEventListener("pointerdown", onDown, { passive: false });
    wheel.addEventListener("pointermove", onMove, { passive: false });
    wheel.addEventListener("pointerup", endDrag);
    wheel.addEventListener("pointercancel", endDrag);

    return () => {
      wheel.removeEventListener("pointerdown", onDown as any);
      wheel.removeEventListener("pointermove", onMove as any);
      wheel.removeEventListener("pointerup", endDrag as any);
      wheel.removeEventListener("pointercancel", endDrag as any);
    };
  }, [hsv, onChange, dpr]);

  // ===== Dibujo =====
  function drawWheel(canvas: HTMLCanvasElement, hueDeg: number) {
    const ctx = canvas.getContext("2d")!;
    const { width, height } = canvas;
    @@ -256, 9 + 259, 9 @@ export default function ColorPicker({
      function drawMarkers(wheel: HTMLCanvasElement, sv: HTMLCanvasElement, { h, s, v }: HSV) {
        const wctx = wheel.getContext("2d")!;
        const sctx = sv.getContext("2d")!;
        const { width } = wheel;
        const cx = width / 2, cy = width / 2;
        const outer = (width / 2) - PADDING * dpr;
        const inner = outer - RING_THICKNESS * dpr;

        // marcador HUE (rueda)
        @@ -299, 7 + 302, 7 @@ export default function ColorPicker({
          sctx.restore();
      }

    /** ===== Paleta desde imagen (cuantización simple) ===== */
    const onPickImage = async (file: File) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      @@ -335, 13 + 338, 16 @@ export default function ColorPicker({

        return (
          <div className={className} style={style}>
            <div
              ref={wrapRef}
              style={{ display: "grid", placeItems: "center", userSelect: "none" }}
            >
              <div style={{ position: "relative" }}>
                {/* Eventos SOLO en wheel; SV dibuja por encima pero no captura */}
                <canvas
                  ref={wheelRef}
                  aria-label="Rueda de color (tono)"
                  style={{ touchAction: "none", userSelect: "none" }}
                />
                <canvas
                  ref={svRef}
	@@ -353,16 +359,19 @@ export default function ColorPicker({

                  {/* Color actual */ }
                  < div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <div
                  aria-label="Color actual"
                  title={curHex}
                  style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #334155", background: curHex }}
                />
                <span style={{ fontFamily: "monospace" }}>{curHex}</span>
              </div>

              {/* Historial */}
              {showHistory && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <strong style={{ fontSize: 12, opacity: 0.85 }}>Historial</strong>
                    <button
                      onClick={() => setHistory([])}
                      style={{ fontSize: 12, background: "transparent", color: "#93c5fd", border: "none", cursor: "pointer" }}
	@@ -388,7 +397,7 @@ export default function ColorPicker({
                      {/* Paleta desde imagen */ }
                      < div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <strong style={{ fontSize: 12, opacity: 0.85 }}>Paleta desde imagen</strong>
                      <label style={{ fontSize: 12, color: "#93c5fd", cursor: "pointer" }}>
                        Subir…
                        <input