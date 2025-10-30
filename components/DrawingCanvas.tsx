import { useEffect, useRef, useState } from "react";

type Props = {
  sendJson: (m: { type: "draw"; payload: string }) => void;
  width?: number;
  height?: number;
  jpegQuality?: number;   // 0..1
  fps?: number;           // 8–15 va bien
};

export default function DrawingCanvas({
  sendJson,
  width = 512,
  height = 512,
  jpegQuality = 0.7,
  fps = 10,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const [brush, setBrush] = useState({ size: 8, color: "#ffffff" });
  const lastSent = useRef(0);
  const minInterval = 1000 / Math.max(1, fps);

  useEffect(() => {
    const c = canvasRef.current!;
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d")!;
    ctxRef.current = ctx;
    // fondo transparente negro (útil para comp)
    ctx.clearRect(0, 0, c.width, c.height);
  }, [width, height]);

  function xy(e: MouseEvent | TouchEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : (e as MouseEvent);
    return {
      x: ((t.clientX - r.left) / r.width) * c.width,
      y: ((t.clientY - r.top) / r.height) * c.height,
    };
  }

  function start(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    lastPt.current = xy(e);
  }

  function move(e: MouseEvent | TouchEvent) {
    if (!drawing.current) return;
    e.preventDefault();
    const p = xy(e);
    const ctx = ctxRef.current!;
    const lp = lastPt.current || p;

    ctx.strokeStyle = brush.color;
    ctx.lineWidth = brush.size;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(lp.x, lp.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    lastPt.current = p;

    // throttle de envío
    const now = performance.now();
    if (now - lastSent.current >= minInterval) {
      lastSent.current = now;
      const c = canvasRef.current!;
      // JPEG para bajar tamaño; Touch acepta .jpg y .png
      const dataURL = c.toDataURL("image/jpeg", jpegQuality);
      sendJson({ type: "draw", payload: dataURL as any });
    }
  }

  function end(e: MouseEvent | TouchEvent) {
    if (!drawing.current) return;
    e.preventDefault();
    drawing.current = false;
    lastPt.current = null;

    // envío final (sin throttle) para asegurar último trazo
    const c = canvasRef.current!;
    const dataURL = c.toDataURL("image/jpeg", jpegQuality);
    sendJson({ type: "draw", payload: dataURL as any });
  }

  function clear() {
    const c = canvasRef.current!;
    const ctx = ctxRef.current!;
    ctx.clearRect(0, 0, c.width, c.height);
    const dataURL = c.toDataURL("image/jpeg", jpegQuality);
    sendJson({ type: "draw", payload: dataURL as any });
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          maxWidth: 512,
          aspectRatio: `${width}/${height}`,
          border: "1px solid #333",
          background: "black",
          touchAction: "none",
        }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ color: "#aaa" }}>Brush</label>
        <input
          type="color"
          value={brush.color}
          onChange={(e) => setBrush((b) => ({ ...b, color: e.target.value }))}
        />
        <input
          type="range"
          min={1}
          max={64}
          value={brush.size}
          onChange={(e) => setBrush((b) => ({ ...b, size: Number(e.target.value) }))}
        />
        <button onClick={clear}>Clear</button>
      </div>
    </div>
  );
}
