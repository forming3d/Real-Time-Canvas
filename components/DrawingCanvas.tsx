import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';

type Point = { x: number; y: number; t?: number };
type Stroke = { points: Point[]; color: string; brushSize: number };

export type DrawingCanvasProps = {
  // tamaño CSS del lienzo (en px). Internamente se multiplica por DPR para nitidez.
  width?: number;
  height?: number;

  // apariencia del trazo
  color?: string;
  brushSize?: number;

  // callbacks opcionales
  onStroke?: (stroke: Stroke) => void;
  onFrame?: (dataUrl: string) => void;

  // control de rasterización para onFrame
  rasterMax?: number;       // lado mayor máx del frame (default 512)
  rasterFps?: number;       // frames por segundo (default 8)
  jpegQuality?: number;     // calidad JPEG 0..1 (default 0.7)
};

export type DrawingCanvasRef = {
  clear: () => void;
};

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  (
    {
      width = 800,
      height = 500,
      color = '#ffffff',
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

    // API pública
    useImperativeHandle(ref, () => ({
      clear() {
        if (!canvasRef.current || !ctxRef.current) return;
        const c = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        ctxRef.current.clearRect(0, 0, c.width, c.height);
        // Fondo transparente, si quieres negro: pinta rect negro
        // ctxRef.current.fillStyle = '#000';
        // ctxRef.current.fillRect(0, 0, c.width, c.height);
      },
    }));

    // preparar canvas con DPR
    useLayoutEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;

      const ctx = c.getContext('2d', { desynchronized: true });
      if (!ctx) return;
      ctxRef.current = ctx;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.imageSmoothingEnabled = true;
      // si quisieras fondo negro:
      // ctx.fillStyle = '#000';
      // ctx.fillRect(0, 0, c.width, c.height);
    }, [width, height]);

    // mantener refs actualizados
    useEffect(() => {
      colorRef.current = color;
    }, [color]);
    useEffect(() => {
      sizeRef.current = brushSize;
    }, [brushSize]);

    // utilidades de coordenadas
    const getCanvasPoint = useCallback((e: PointerEvent | Touch | MouseEvent): Point => {
      const c = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const clientX = (e as PointerEvent).clientX ?? (e as Touch).clientX ?? 0;
      const clientY = (e as PointerEvent).clientY ?? (e as Touch).clientY ?? 0;
      return {
        x: (clientX - rect.left) * dpr,
        y: (clientY - rect.top) * dpr,
        t: performance.now(),
      };
    }, []);

    // dibujo del segmento
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

    // eventos de puntero
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
        if (lp) {
          drawSegment(lp, p);
        }
        lastPtRef.current = p;
        strokePtsRef.current.push(p);
      };
      const onUp = (_ev: PointerEvent) => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        // emite stroke si lo piden
        if (onStroke && strokePtsRef.current.length > 0) {
          onStroke({
            points: [...strokePtsRef.current],
            color: colorRef.current,
            brushSize: sizeRef.current,
          });
        }
        strokePtsRef.current = [];
        lastPtRef.current = null;
      };

      c.addEventListener('pointerdown', onDown);
      c.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);

      return () => {
        c.removeEventListener('pointerdown', onDown);
        c.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
    }, [getCanvasPoint, drawSegment, onStroke]);

    // bucle de rasterización (envío de frames comprimidos)
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

        if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
        const off = offscreenRef.current;
        const sw = src.width, sh = src.height;
        const maxSide = Math.max(64, rasterMax || 512);
        const k = sw >= sh ? maxSide / sw : maxSide / sh;
        const tw = Math.max(1, Math.round(sw * k));
        const th = Math.max(1, Math.round(sh * k));
        if (off.width !== tw || off.height !== th) {
          off.width = tw;
          off.height = th;
        }
        const octx = off.getContext('2d')!;
        octx.clearRect(0, 0, tw, th);
        octx.drawImage(src, 0, 0, tw, th);

        const q = Math.min(1, Math.max(0.1, jpegQuality || 0.7));
        const dataUrl = off.toDataURL('image/jpeg', q);
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
          display: 'block',
          width: `${width}px`,
          height: `${height}px`,
          touchAction: 'none',
          backgroundColor: 'transparent',
        }}
      />
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';
export default DrawingCanvas;
