import React, {
  useRef, useEffect, useLayoutEffect, useCallback,
  forwardRef, useImperativeHandle
} from "react";

type Point = { x: number; y: number; t?: number };
type Mode = "brush" | "eraser";
type Stroke = { points: Point[]; color: string; brushSize: number; mode: Mode };

export type DrawingCanvasProps = {
  /** El canvas ahora rellena el contenedor padre: ponle tamaño al wrapper */
  color?: string;
  brushSize?: number;
  mode?: Mode;
  onStroke?: (stroke: Stroke) => void;
  onFrame?: (dataUrl: string) => void; // PNG
  rasterMax?: number;                   // tamaño máx del snapshot
  rasterFps?: number;                   // snapshots/segundo mientras dibujas
};

export type DrawingCanvasRef = {
  clear: () => string | undefined;      // limpia y devuelve snapshot (PNG)
  snapshot: () => string | undefined;   // snapshot actual (PNG)
  setColor: (hex: string) => void;
  setBrushSize: (v: number) => void;
  undo: () => string | undefined;       // devuelve dataURL para enviar a TD
  redo: () => string | undefined;       // idem
};

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  color = "#ff4d4d",
  brushSize = 16,
  mode = "brush",
  onStroke,
  onFrame,
  rasterMax = 1024,
  rasterFps = 8,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Estado “runtime”
  const drawingRef = useRef(false);
  const lastPtRef = useRef<Point | null>(null);
  const currentStrokeRef = useRef<Point[]>([]);
  const colorRef = useRef(color);
  const sizeRef = useRef(brushSize);
  const modeRef = useRef<Mode>(mode);

  // Historial
  const historyRef = useRef<Stroke[]>([]);
  const redoRef = useRef<Stroke[]>([]);

  // Throttle para snapshots durante el trazo
  const lastFrameTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    clear() {
      const c = canvasRef.current, ctx = ctxRef.current;
      if (!c || !ctx) return;
      historyRef.current = [];
      redoRef.current = [];
      ctx.clearRect(0, 0, c.width, c.height);
      return makeSnapshot();
    },
    snapshot() { return makeSnapshot(); },
    setColor(hex: string) { colorRef.current = hex; },
    setBrushSize(v: number) { sizeRef.current = v; },
    undo() {
      const c = canvasRef.current, ctx = ctxRef.current;
      if (!c || !ctx || historyRef.current.length === 0) return;
      const s = historyRef.current.pop()!;
      redoRef.current.push(s);
      redrawAll();
      return makeSnapshot();
    },
    redo() {
      const c = canvasRef.current, ctx = ctxRef.current;
      if (!c || !ctx || redoRef.current.length === 0) return;
      const s = redoRef.current.pop()!;
      historyRef.current.push(s);
      redrawAll();
      return makeSnapshot();
    },
  }));

  // Ajuste a tamaño visible (rellena el contenedor)
  useLayoutEffect(() => {
    const c = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const rect = c.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { desynchronized: true });
        if (ctx) {
          ctxRef.current = ctx;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.imageSmoothingEnabled = true;
        }
        // al redimensionar, re-pintamos historial
        redrawAll();
        if (onFrame) {
          const d = makeSnapshot();
          if (d) onFrame(d);
        }
      }
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [onFrame]);

  // Sincroniza props → refs
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const getPoint = useCallback((e: PointerEvent): Point => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr, t: performance.now() };
  }, []);

  const drawSeg = useCallback((a: Point, b: Point, stroke: Stroke | null = null) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const m = stroke ? stroke.mode : modeRef.current;
    const col = stroke ? stroke.color : colorRef.current;
    const w = stroke ? stroke.brushSize : sizeRef.current;
    ctx.save();
    ctx.globalCompositeOperation = (m === "eraser") ? "destination-out" : "source-over";
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }, []);

  const redrawAll = useCallback(() => {
    const c = canvasRef.current, ctx = ctxRef.current;
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const strokes = historyRef.current;
    for (const s of strokes) {
      for (let i = 1; i < s.points.length; i++) {
        drawSeg(s.points[i - 1], s.points[i], s);
      }
    }
  }, [drawSeg]);

  const makeSnapshot = (): string | undefined => {
    const src = canvasRef.current;
    if (!src) return;
    // Reducimos para red (rasterMax)
    const off = offscreenRef.current ?? (offscreenRef.current = document.createElement("canvas"));
    const sw = src.width, sh = src.height;
    const maxSide = Math.max(64, rasterMax || 1024);
    const k = sw >= sh ? maxSide / sw : maxSide / sh;
    const tw = Math.max(1, Math.round(sw * k));
    const th = Math.max(1, Math.round(sh * k));
    if (off.width !== tw || off.height !== th) { off.width = tw; off.height = th; }
    const octx = off.getContext("2d")!;
    octx.clearRect(0, 0, tw, th);
    octx.drawImage(src, 0, 0, tw, th);
    return off.toDataURL("image/png"); // PNG con alfa
  };

  // Input pointer
  useEffect(() => {
    const c = canvasRef.current!;
    c.style.width = "100%";
    c.style.height = "100%";
    c.style.touchAction = "none";
    c.style.background = "transparent";

    const onDown = (ev: PointerEvent) => {
      ev.preventDefault();
      drawingRef.current = true;
      lastPtRef.current = getPoint(ev);
      currentStrokeRef.current = [lastPtRef.current];
      c.setPointerCapture(ev.pointerId);
      // cortar rama de redo cuando inicio un trazo nuevo
      redoRef.current = [];
    };
    const onMove = (ev: PointerEvent) => {
      if (!drawingRef.current) return;
      const p = getPoint(ev);
      const lp = lastPtRef.current;
      if (lp) drawSeg(lp, p);
      lastPtRef.current = p;
      currentStrokeRef.current.push(p);
    };
    const onUp = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const pts = [...currentStrokeRef.current];
      currentStrokeRef.current = [];
      lastPtRef.current = null;
      if (pts.length > 0) {
        const stroke: Stroke = { points: pts, color: colorRef.current, brushSize: sizeRef.current, mode: modeRef.current };
        historyRef.current.push(stroke);
        if (onStroke) onStroke(stroke);
        if (onFrame) {
          const d = makeSnapshot();
          if (d) onFrame(d);
        }
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
  }, [drawSeg, getPoint, onStroke, onFrame, rasterMax]);

  // Snapshots mientras dibujas (throttle por FPS)
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
  }, [onFrame, rasterFps, rasterMax]);

  return <canvas ref={canvasRef} aria-label="Área de dibujo" />;
});

DrawingCanvas.displayName = "DrawingCanvas";
export default DrawingCanvas;
