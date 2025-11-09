// DrawingCanvas.tsx
import React, { ForwardedRef, useEffect, useRef } from 'react';

type Props = {
  width: number;
  height: number;
  brushSize: number;
  brushColor: string;
  eraser?: boolean;
  liveFps?: number;         // 6–10 recomendable
  liveJpegQ?: number;       // 0.4–0.6 recomendable
  liveMax?: number;         // 224–320 recomendado (reducción para live)
  onFinalBlob?: (blob: Blob) => void;  // PNG final
  onDrawStart?: () => void;            // -> enviar state:drawing:start
  onDrawEnd?: () => void;              // -> enviar state:drawing:end
  connected?: boolean;
  onLiveFrame?: (canvas: HTMLCanvasElement, opts: { liveMax: number; liveJpegQ: number }) => void;
};

const setForwardedRef = (
  node: HTMLCanvasElement | null,
  ref: ForwardedRef<HTMLCanvasElement>
) => {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(node);
  } else {
    ref.current = node;
  }
};

export const DrawingCanvas = React.forwardRef<HTMLCanvasElement, Props>(({ 
  width,
  height,
  brushSize,
  brushColor,
  eraser = false,
  liveFps = 8,
  liveJpegQ = 0.5,
  liveMax = 256,
  onFinalBlob,
  onDrawStart,
  onDrawEnd,
  connected = false,
  onLiveFrame,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const lastSendRef = useRef(0);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const liveFpsRef = useRef(liveFps);
  const liveMaxRef = useRef(liveMax);
  const liveJpegQRef = useRef(liveJpegQ);
  const onLiveFrameRef = useRef<Props['onLiveFrame']>(onLiveFrame);
  const onFinalBlobRef = useRef<Props['onFinalBlob']>(onFinalBlob);
  const onDrawStartRef = useRef<Props['onDrawStart']>(onDrawStart);
  const onDrawEndRef = useRef<Props['onDrawEnd']>(onDrawEnd);

  useEffect(() => {
    liveFpsRef.current = liveFps;
  }, [liveFps]);

  useEffect(() => {
    liveMaxRef.current = liveMax;
  }, [liveMax]);

  useEffect(() => {
    liveJpegQRef.current = liveJpegQ;
  }, [liveJpegQ]);

  useEffect(() => {
    onLiveFrameRef.current = onLiveFrame;
  }, [onLiveFrame]);

  useEffect(() => {
    onFinalBlobRef.current = onFinalBlob;
  }, [onFinalBlob]);

  useEffect(() => {
    onDrawStartRef.current = onDrawStart;
  }, [onDrawStart]);

  useEffect(() => {
    onDrawEndRef.current = onDrawEnd;
  }, [onDrawEnd]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const coarsePointer = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
    const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const dpr = Math.max(1, Math.min(coarsePointer ? 1 : 2, rawDpr));
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;
  }, [width, height]);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
  }, [brushColor, brushSize, eraser]);

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const getPos = (ev: PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };

  const onDown = (ev: PointerEvent) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ev.preventDefault();
    const target = ev.target as HTMLElement;
    pointerIdRef.current = ev.pointerId;
    if (target && target.setPointerCapture && !target.hasPointerCapture?.(ev.pointerId)) {
      try {
        target.setPointerCapture(ev.pointerId);
      } catch (error) {
        // iOS Safari todavía no soporta pointer capture en canvas
      }
    }
    drawingRef.current = true;
    const p = getPos(ev);
    drawLine(p.x, p.y, p.x + 0.01, p.y + 0.01); // micro-draw
    lastPointRef.current = p;
    lastSendRef.current = 0;
    onDrawStartRef.current?.();
  };

  const onMove = (ev: PointerEvent) => {
    if (!drawingRef.current) return;
    if (pointerIdRef.current !== null && ev.pointerId !== pointerIdRef.current) return;
    if (ev.pointerType === 'mouse' && ev.buttons === 0) {
      onUp(ev);
      return;
    }
    ev.preventDefault();
    const c = canvasRef.current;
    if (!c) return;
    const events = (ev.getCoalescedEvents && ev.getCoalescedEvents()) || [ev];
    const r = c.getBoundingClientRect();

    let prev = lastPointRef.current;
    for (const e of events) {
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (prev) drawLine(prev.x, prev.y, x, y);
      prev = { x, y };
    }
    lastPointRef.current = prev;

    // envío en vivo throttled por FPS (se hace desde App con ws)
    const now = performance.now();
    const fps = Math.max(1, liveFpsRef.current ?? 1);
    if (now - lastSendRef.current >= 1000 / fps) {
      lastSendRef.current = now;
      const handler = onLiveFrameRef.current;
      if (handler) {
        handler(c, { liveMax: liveMaxRef.current, liveJpegQ: liveJpegQRef.current });
      }
    }
  };

  const onUp = (ev: PointerEvent) => {
    if (pointerIdRef.current !== null && ev.pointerId !== pointerIdRef.current) return;
    ev.preventDefault();
    if (!drawingRef.current) return;
    drawingRef.current = false;
    pointerIdRef.current = null;
    lastPointRef.current = null;

    // PNG final (sin bloquear UI)
    const c = canvasRef.current;
    if (!c) return;
    if (c.releasePointerCapture && c.hasPointerCapture?.(ev.pointerId)) {
      try {
        c.releasePointerCapture(ev.pointerId);
      } catch (error) {
        // navegadores legacy pueden lanzar si pointer capture no está soportado
      }
    }
    c.toBlob((blob) => {
      const finalHandler = onFinalBlobRef.current;
      if (blob && finalHandler) finalHandler(blob);
      onDrawEndRef.current?.();
    }, 'image/png');

  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const opts: AddEventListenerOptions = { passive: false };
    c.addEventListener('pointerdown', onDown, opts);
    c.addEventListener('pointermove', onMove, opts);
    window.addEventListener('pointermove', onMove, opts);
    window.addEventListener('pointerup', onUp, opts);
    window.addEventListener('pointercancel', onUp, opts);
    return () => {
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <canvas
      ref={(node) => {
        canvasRef.current = node;
        setForwardedRef(node, ref);
      }}
      role="img"
      aria-label="Lienzo interactivo para dibujo en tiempo real"
      tabIndex={0}
      className="canvas"
      data-connected={connected ? 'true' : 'false'}
    />
  );
});
