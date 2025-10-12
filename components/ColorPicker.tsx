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
  const svRef = useRef<HTMLCanvasElement | null>(null
