import React, {
  useRef, useEffect, useLayoutEffect, useCallback,
  forwardRef, useImperativeHandle
} from "react";
type Point = { x: number; y: number; t?: number };
type Mode = "brush" | "eraser";
type Stroke = { points: Point[]; color: string; brushSize: number; mode: Mode };

export type DrawingCanvasProps = {
  /** El canvas rellena su contenedor. Dale tamaño al wrapper (en App.tsx lo ponemos 512×512). */
  color?: string;
  brushSize?: number;
  mode?: Mode;

  onStroke?: (stroke: Stroke) => void;
  onFrame?: (dataUrl: string) => void;   // PNG

  /** FPS de snapshots mientras dibujas */
  rasterFps?: number;

  /** Tamaño cuadrado forzado del snapshot (por defecto 512 → 512×512) */
  targetSize?: number;
};

export type DrawingCanvasRef = {
  clear: () => string | undefined;       // limpia y devuelve snapshot (PNG)
  snapshot: () => string | undefined;    // snapshot actual (PNG)
  setColor: (hex: string) => void;
  setBrushSize: (v: number) => void;
  undo: () => string | undefined;        // devuelve dataURL para enviar a TD
  redo: () => string | undefined;        // idem
};

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
	@@ - 33, 14 + 38, 14 @@ const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  mode = "brush",
  onStroke,
  onFrame,
  rasterFps = 8,
  targetSize = 512,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Estado runtime
  const drawingRef = useRef(false);
  const lastPtRef = useRef<Point | null>(null);
  const currentStrokeRef = useRef<Point[]>([]);
  @@ -52, 7 + 57, 7 @@ const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
    const historyRef = useRef<Stroke[]>([]);
    const redoRef = useRef<Stroke[]>([]);

    // Throttle de snapshots
    const lastFrameTimeRef = useRef(0);
    const rafRef = useRef<number | null>(null);

	@@ - 104, 7 + 109, 7 @@ const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
      ctx.lineCap = "round";
      ctx.imageSmoothingEnabled = true;
    }
        // re-pintar historial tras resize
        redrawAll();
  if (onFrame) {
    const d = makeSnapshot();
    @@ -137, 7 + 142, 7 @@ const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
      ctx.save();
      ctx.globalCompositeOperation = (m === "eraser") ? "destination-out" : "source-over";
      ctx.strokeStyle = col;
      ctx.lineWidth = w * (window.devicePixelRatio || 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
	@@ - 157, 21 + 162, 33 @@ const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
      }
  }, [drawSeg]);

/** Snapshot EXACTO targetSize×targetSize con letterbox */
const makeSnapshot = (): string | undefined => {
  const src = canvasRef.current;
  if (!src) return;

  const T = Math.max(16, Math.round(targetSize)); // seguridad
  const off = offscreenRef.current ?? (offscreenRef.current = document.createElement("canvas"));
  if (off.width !== T || off.height !== T) { off.width = T; off.height = T; }
  const octx = off.getContext("2d")!;
  octx.clearRect(0, 0, T, T);

  // Escalamos la imagen manteniendo aspecto y centramos (letterbox)
  const sw = src.width, sh = src.height;
  const scale = Math.min(T / sw, T / sh);
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);
  const dx = Math.floor((T - dw) / 2);
  const dy = Math.floor((T - dh) / 2);

  // Fondo opcional (negro). Si quieres transparencia, déjalo comentado.
  // octx.fillStyle = "#000";
  // octx.fillRect(0, 0, T, T);

  octx.imageSmoothingEnabled = true;
  octx.drawImage(src, 0, 0, sw, sh, dx, dy, dw, dh);

  return off.toDataURL("image/png"); // PNG 512×512 exacto
};

// Input pointer
@@ -188, 7 + 205, 7 @@ const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  lastPtRef.current = getPoint(ev);
  currentStrokeRef.current = [lastPtRef.current];
  c.setPointerCapture(ev.pointerId);
  // al empezar un nuevo trazo, invalidamos la rama de redo
  redoRef.current = [];
};
const onMove = (ev: PointerEvent) => {
  @@ -224, 9 + 241, 9 @@ const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
}, [drawSeg, getPoint, onStroke, onFrame, targetSize]);

// Snapshots periódicos mientras dibujas (throttle por FPS)
useEffect(() => {
  if (!onFrame) return;
  const loop = () => {
    @@ -241, 7 + 258, 7 @@ const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
    };
    loop();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [onFrame, rasterFps, targetSize]);

return <canvas ref={canvasRef} aria-label="Área de dibujo" />;
});