import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import { Stroke, StrokePoint } from '../types';
import useHistory from '../hooks/useHistory';

export type DrawingCanvasRef = {
  undo: () => void;
  redo: () => void;
  clear: () => void;
};

type Props = {
  color: string;
  brushSize: number;
  mode: 'brush' | 'eraser';
  targetSize?: number;   // tamaño base para raster a TD
  rasterFps?: number;    // fps para onFrame
  onStroke?: (stroke: Stroke) => void;
  onFrame?: (dataUrl: string) => void;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, Props>(function DrawingCanvas(
  { color, brushSize, mode, onStroke, onFrame, targetSize = 512, rasterFps = 6 },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes, undo, redo, clear] = useHistory<Stroke>([]);

  // Exponer API
  useImperativeHandle(ref, () => ({ undo, redo, clear }), [undo, redo, clear]);

  // Resize responsivo + DPR
  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      drawAll();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    return () => ro.disconnect();
  }, []);

  // Dibujo inmediato
  const ctx = () => canvasRef.current!.getContext('2d')!;

  function drawStroke(s: Stroke) {
    const c = ctx();
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = s.size;
    if (s.mode === 'eraser') {
      c.globalCompositeOperation = 'destination-out';
      c.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = s.color;
    }
    c.beginPath();
    for (let i = 0; i < s.points.length; i++) {
      const p = s.points[i];
      const nx = p.x * canvasRef.current!.width;
      const ny = p.y * canvasRef.current!.height;
      if (i === 0) c.moveTo(nx, ny);
      else c.lineTo(nx, ny);
    }
    c.stroke();
    c.restore();
  }

  const drawAll = () => {
    const c = ctx();
    c.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    for (const s of strokes) drawStroke(s);
  };

  useEffect(drawAll, [strokes]);

  // Ratón/táctil
  const isDown = useRef(false);
  const currStroke = useRef<Stroke | null>(null);
  const last = useRef<StrokePoint | null>(null);

  const start = (x: number, y: number) => {
    isDown.current = true;
    const p: StrokePoint = { x, y, p: 1 };
    const s: Stroke = {
      id: crypto.randomUUID(),
      color,
      size: brushSize,
      mode,
      points: [p]
    };
    currStroke.current = s;
    last.current = p;
    // dibuja punto inicial
    setStrokes((arr) => [...arr, s]);
  };

  const move = (x: number, y: number) => {
    if (!isDown.current || !currStroke.current || !last.current) return;
    const prev = last.current;
    const dx = x - prev.x;
    const dy = y - prev.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.floor(dist * 60)); // suaviza curvas
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p: StrokePoint = {
        x: lerp(prev.x, x, t),
        y: lerp(prev.y, y, t),
        p: 1
      };
      currStroke.current.points.push(p);
    }
    last.current = { x, y, p: 1 };
    // redibuja incrementalmente
    drawAll();
  };

  const end = () => {
    if (isDown.current && currStroke.current) {
      onStroke?.(currStroke.current);
    }
    isDown.current = false;
    currStroke.current = null;
    last.current = null;
  };

  // Eventos
  const toNorm = (e: MouseEvent | Touch) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ('clientX' in e ? e.clientX : 0) - rect.left;
    const y = ('clientY' in e ? e.clientY : 0) - rect.top;
    return { x: x / rect.width, y: y / rect.height };
    // Normalizamos (0..1) para independencia de resolución
  };

  useEffect(() => {
    const c = canvasRef.current!;
    const onDown = (ev: MouseEvent) => {
      const { x, y } = toNorm(ev);
      start(x, y);
    };
    const onMove = (ev: MouseEvent) => {
      const { x, y } = toNorm(ev);
      move(x, y);
    };
    const onUp = () => end();

    c.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    // táctil
    const td = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const { x, y } = toNorm(t);
      start(x, y);
    };
    const tm = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const { x, y } = toNorm(t);
      move(x, y);
    };
    const tu = (e: TouchEvent) => {
      e.preventDefault();
      end();
    };

    c.addEventListener('touchstart', td, { passive: false });
    c.addEventListener('touchmove', tm, { passive: false });
    c.addEventListener('touchend', tu, { passive: false });
    c.addEventListener('touchcancel', tu, { passive: false });

    return () => {
      c.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      c.removeEventListener('touchstart', td);
      c.removeEventListener('touchmove', tm);
      c.removeEventListener('touchend', tu);
      c.removeEventListener('touchcancel', tu);
    };
  }, [color, brushSize, mode]);

  // Raster periódico para enviar a TD
  useEffect(() => {
    if (!onFrame) return;
    const id = setInterval(() => {
      const off = document.createElement('canvas');
      const size = targetSize;
      off.width = size;
      off.height = size;
      const octx = off.getContext('2d')!;
      octx.drawImage(
        canvasRef.current!,
        0,
        0,
        off.width,
        off.height
      );
      const url = off.toDataURL('image/webp', 0.7);
      onFrame(url);
    }, 1000 / rasterFps);
    return () => clearInterval(id);
  }, [onFrame, rasterFps, targetSize, strokes]);

  return <canvas ref={canvasRef} role="img" aria-label="Canvas de dibujo" style={{ width: '100%', height: '100%', touchAction: 'none', display: 'block' }} />;
});

export default DrawingCanvas;
