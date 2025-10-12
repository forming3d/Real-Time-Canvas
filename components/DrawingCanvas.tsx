import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";

type Point = { x: number; y: number; t?: number };
type Stroke = { points: Point[]; color: string; brushSize: number };

export type DrawingCanvasProps = {
  width?: number;
  height?: number;
  color?: string;
  brushSize?: number;

  // callbacks
  onStroke?: (stroke: Stroke) => void;
  onFrame?: (dataUrl: string) => void;

  // control de rasterización
  rasterMax?: number;     // lado mayor máximo (por defecto 512)
  rasterFps?: number;     // frames/seg para onFrame (por defecto 8)
  jpegQuality?: number;   // calidad JPEG 0..1 (por defecto 0.7)
};

export type DrawingCanvasRef = {
  clear: () => void;
};

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  (
    {
      width = 800,
      height = 500,
      color = "#ffffff",
      brushSize = 8,
      onStroke,
      onFrame,
      rasterMax = 512,
      rasterFps = 8,
      jpegQuality = 0.7,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const offscreenRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

    const drawingRef = useRef(false);
    const lastPtRef = useRef<Point | null>(null);
    const strokePtsRef = useRef<Point[]>([]);
    const colorRef = useRef(color);
    const sizeRef = useRef(brushSize);

    const lastFrameTimeRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      clear() {
        const c = canvasRef.current;
        const ctx = ctxRef.current;
        if (!c || !ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
      },
    }));

    useLayoutEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
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

    const getCanvasPoint = useCallback((e: PointerEvent): Point => {
      const c = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      return {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
        t: performance.now(),
      };
    }, []);

    const drawSegment = useCallback((p0: Point, p1: Point) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = sizeRef.current * (window.devicePixelRatio || 1);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }, []);

    useEffect(() => {
      const c = canvasRef.current!;
      if (!c) return;

      const onDown = (ev: PointerEvent) => {
        c.setPointerCapture(ev.pointerId);
        drawingRef.current = true;
        const p = getCanvasPoint(ev);
        lastPtRef.current = p;
        strokePtsRef.current = [p];
      };
      const onMove = (ev: PointerEvent) => {
        if (!drawingRef.current) return;
        const p = getCanvasPoint(ev);
        const lp = lastPtRef.current;
        if (lp) drawSegment(lp, p);
        lastPtRef.current = p;
        strokePtsRef.current.push(p);
      };
      const onUp = (ev: PointerEvent) => {
        if (!drawingRef.current) return;
        drawingRef.current = false;

        // emitir stroke si lo piden
        if (onStroke && strokePtsRef.current.length > 0) {
          onStroke({
            points: [...strokePtsRef.current],
            color: colorRef.current,
            brushSize: sizeRef.current,
          });
        }
        strokePtsRef.current = [];
        lastPtRef.current = null;

        // snapshot "a prueba de balas" al terminar trazo
        if (onFrame && canvasRef.current) {
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
          const q = Math.min(1, Math.max(0.1, jpegQuality || 0.7));
          const dataUrl = off.toDataURL("image/jpeg", q);
          onFrame(dataUrl);
        }
      };

      c.addEventListener("pointerdown", onDown);
      c.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);

      return () => {
        c.removeEventListener("pointerdown", onDown);
        c.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
    }, [getCanvasPoint, drawSegment, onStroke, onFrame, rasterMax, jpegQuality]);

    // bucle de rasterización periódica
    useEffect(() => {
      if (!onFrame) return;

      const loop = () => {
        rafRef.current = requestAnimationFrame(loop);
        const now = performance.now();
        const minDelta = 1000 / (rasterFps || 8);
        if (now - lastFrameTimeRef.current < minDelta) return;
        lastFrameTimeRef.current = now;

        const src = canvasRef.current;
        if (!src) return;

        if (!offscreenRef.current) offscreenRef.current = document.createElement("canvas");
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

        const q = Math.min(1, Math.max(0.1, jpegQuality || 0.7));
        const dataUrl = off.toDataURL("image/jpeg", q);
        onFrame(dataUrl);
      };

      rafRef.current = requestAnimationFrame(loop);
      return () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
    }, [onFrame, rasterFps, rasterMax, jpegQuality]);

    return (
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: `${width}px`,
          height: `${height}px`,
          touchAction: "none",
          backgroundColor: "transparent",
        }}
      />
    );
  }
);

DrawingCanvas.displayName = "DrawingCanvas";
export default DrawingCanvas;
