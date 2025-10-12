import React, {
  useRef, useEffect, useLayoutEffect, useCallback,
  forwardRef, useImperativeHandle
} from "react";

type Point = { x: number; y: number; t?: number };
type Stroke = { points: Point[]; color: string; brushSize: number };

export type DrawingCanvasProps = {
  width?: number;
  height?: number;
  color?: string;
  brushSize?: number;
  mode?: "brush" | "eraser";
  onStroke?: (stroke: Stroke) => void;
  onFrame?: (dataUrl: string) => void;
  rasterMax?: number;
  rasterFps?: number;
  jpegQuality?: number;
};

export type DrawingCanvasRef = {
  clear: () => string | undefined;             // limpia y devuelve snapshot
  snapshot: (mime?: string, q?: number) => string | undefined; // devuelve dataURL actual
  setColor: (hex: string) => void;
  setBrushSize: (v: number) => void;
};

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  width = 900,
  height = 560,
  color = "#ff4d4d",
  brushSize = 16,
  mode = "brush",
  onStroke,
  onFrame,
  rasterMax = 512,
  rasterFps = 8,
  jpegQuality = 0.7,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const drawingRef = useRef(false);
  const lastPtRef = useRef<Point | null>(null);
  const strokePtsRef = useRef<Point[]>([]);
  const colorRef = useRef(color);
  const sizeRef = useRef(brushSize);
  const modeRef = useRef<"brush" | "eraser">(mode);

  const lastFrameTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    clear() {
      const c = canvasRef.current, ctx = ctxRef.current;
      if (!c || !ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      return makeSnapshot(); // devolvemos el dataURL por si quieren enviarlo
    },
    snapshot(mime = "image/jpeg", q = jpegQuality ?? 0.7) {
      return makeSnapshot(mime, q);
    },
    setColor(hex: string) { colorRef.current = hex; },
    setBrushSize(v: number) { sizeRef.current = v; },
  }));

  useLayoutEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    const ctx = c.getContext("2d", { desynchronized: true });
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.imageSmoothingEnabled = true;
  }, [width, height]);

  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const getPoint = useCallback((e: PointerEvent): Point => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr, t: performance.now() };
  }, []);

  const drawSeg = useCallback((a: Point, b: Point) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = modeRef.current === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = sizeRef.current;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }, []);

  // snapshot reducido para enviar al WS
  const makeSnapshot = (mime = "image/jpeg", q = jpegQuality ?? 0.7): string | undefined => {
    if (!canvasRef.current) return;
    if (!offscreenRef.current) offscreenRef.current = document.createElement("canvas");
    const src = canvasRef.current;
    const off = offscreenRef.current;
    const sw = src.width, sh = src.height;
    const maxSide = Math.max(64, rasterMax || 512);
    const k = sw >= sh ? maxSide / sw : maxSide / sh;
    const tw = Math.max(1, Math.round(sw * k));
    const th = Math.max(1, Math.round(sh * k));
    if (off.width !== tw || off.height !== th) { off.width = tw; off.height = th; }
    const octx = off.getContext("2d")!;
    octx.clearRect(0, 0, tw, th);
    octx.drawImage(src, 0, 0, tw, th);
    const quality = Math.min(1, Math.max(0.1, q));
    return off.toDataURL(mime, quality);
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const onDown = (ev: PointerEvent) => {
      ev.preventDefault();
      drawingRef.current = true;
      lastPtRef.current = getPoint(ev);
      strokePtsRef.current = [lastPtRef.current];
      c.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      if (!drawingRef.current) return;
      const p = getPoint(ev);
      const lp = lastPtRef.current;
      if (lp) drawSeg(lp, p);
      lastPtRef.current = p;
      strokePtsRef.current.push(p);
    };
    const onUp = (_ev: PointerEvent) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      if (onStroke && strokePtsRef.current.length > 0) {
        onStroke({ points: [...strokePtsRef.current], color: colorRef.current, brushSize: sizeRef.current });
      }
      strokePtsRef.current = [];
      lastPtRef.current = null;
      if (onFrame) {
        const d = makeSnapshot();
        if (d) onFrame(d);
      }
    };

    c.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      c.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drawSeg, getPoint, onFrame, onStroke, jpegQuality, rasterMax]);

  // raster periódico mientras dibujas
  useEffect(() => {
    if (!onFrame) return;
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      if (!drawingRef.current) return;
      const now = performance.now();
      const minDelta = 1000 / (rasterFps || 8);
      if (now - lastFrameTimeRef.current < minDelta) return;
      lastFrameTimeRef.current = now;
      const d = makeSnapshot();
      if (d) onFrame(d);
    };
    loop();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [onFrame, rasterFps, jpegQuality, rasterMax]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Área de dibujo"
      style={{ display: "block", width: `${width}px`, height: `${height}px`, touchAction: "none", background: "transparent" }}
    />
  );
});

DrawingCanvas.displayName = "DrawingCanvas";
export default DrawingCanvas;
