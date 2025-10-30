import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import useHistory from '../hooks/useHistory';

export type DrawingCanvasRef = {
  undo: () => void;
  redo: () => void;
  clear: () => void;
};

type Point = { x: number; y: number; p: number; color: string; size: number; };
type Stroke = { id: string; points: Point[]; color: string; size: number; mode: 'brush' | 'eraser' };

export interface DrawingCanvasProps {
  color: string;
  brushSize: number;
  mode?: 'brush' | 'eraser';
  onStroke?: (stroke: Stroke) => void;
  onFrame?: (dataUrl: string) => void;
  rasterFps?: number;
  targetSize?: number; // lado del PNG enviado
}

function getDpr() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(function DrawingCanvas(
  { color, brushSize, mode = 'brush', onStroke, onFrame, rasterFps = 6, targetSize = 512 },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const history = useHistory<HTMLCanvasElement>();

  const strokeRef = useRef<Stroke | null>(null);
  const ctx = useMemo(() => canvasRef.current?.getContext('2d') ?? null, [canvasRef.current]);

  // Resize + DPR
  const resize = useCallback(() => {
    const c = canvasRef.current!;
    const dpr = getDpr();
    const { clientWidth, clientHeight } = c.parentElement!;
    c.style.width = `${clientWidth}px`;
    c.style.height = `${clientHeight}px`;
    c.width = Math.round(clientWidth * dpr);
    c.height = Math.round(clientHeight * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawFromHistory();
  }, []);

  // Redraw all strokes from history snapshot
  const redrawFromHistory = useCallback(() => {
    const c = canvasRef.current!;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    for (const s of history.getAll()) {
      drawStroke(g, s);
    }
  }, [history]);

  const drawStroke = (g: CanvasRenderingContext2D, s: Stroke) => {
    if (s.points.length < 1) return;
    g.save();
    if (s.mode === 'eraser') {
      g.globalCompositeOperation = 'destination-out';
    } else {
      g.globalCompositeOperation = 'source-over';
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = s.color;
    g.lineWidth = s.size;

    g.beginPath();
    const [p0, ...rest] = s.points;
    g.moveTo(p0.x, p0.y);
    for (const p of rest) g.lineTo(p.x, p.y);
    g.stroke();
    g.restore();
  };

  // Pointer handlers
  const start = useCallback((e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s: Stroke = {
      id: crypto.randomUUID(),
      points: [{ x, y, p: 0.5, color, size: brushSize }],
      color,
      size: brushSize,
      mode,
    };
    strokeRef.current = s;
    setIsDrawing(true);
  }, [color, brushSize, mode]);

  const move = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !strokeRef.current) return;
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = strokeRef.current;
    s.points.push({ x, y, p: 0.5, color: s.color, size: s.size });
    const g = c.getContext('2d')!;
    drawStroke(g, { ...s, points: s.points.slice(-2) });
  }, [isDrawing]);

  const end = useCallback(() => {
    if (!isDrawing || !strokeRef.current) return;
    setIsDrawing(false);
    history.push(strokeRef.current);
    onStroke?.(strokeRef.current);
    strokeRef.current = null;
  }, [isDrawing, history, onStroke]);

  // Raster sender
  useEffect(() => {
    if (!onFrame) return;
    const id = setInterval(() => {
      const c = canvasRef.current!;
      if (!c) return;
      const off = document.createElement('canvas');
      const side = targetSize;
      off.width = side;
      off.height = side;
      const g = off.getContext('2d')!;
      g.fillStyle = '#0b1220';
      g.fillRect(0, 0, side, side);
      g.drawImage(c, 0, 0, side, side);
      onFrame(off.toDataURL('image/jpeg', 0.75));
    }, Math.max(1000 / rasterFps, 60));
    return () => clearInterval(id);
  }, [onFrame, rasterFps, targetSize]);

  // Resize observer
  useEffect(() => {
    const obs = new ResizeObserver(resize);
    if (canvasRef.current?.parentElement) obs.observe(canvasRef.current.parentElement);
    resize();
    return () => obs.disconnect();
  }, [resize]);

  useImperativeHandle(ref, () => ({
    undo() {
      history.undo();
      redrawFromHistory();
    },
    redo() {
      history.redo();
      redrawFromHistory();
    },
    clear() {
      history.clear();
      redrawFromHistory();
    },
  }), [history, redrawFromHistory]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerLeave={end}
      style={{ touchAction: 'none', display: 'block', width: '100%', height: '100%' }}
    />
  );
});

export default DrawingCanvas;
