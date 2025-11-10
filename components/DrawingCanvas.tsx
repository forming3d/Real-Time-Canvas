// DrawingCanvas.tsx
import React, { useEffect, useImperativeHandle, useRef } from "react";

type Props = {
  width: number;
  height: number;
  brushSize: number;
  brushColor: string;
  brushOpacity: number;   // 1..100
  eraser: boolean;
  connected?: boolean;
  onLiveFrame?: (canvas: HTMLCanvasElement) => void;
  onFinalBlob?: (blob: Blob) => void;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
};

export const DrawingCanvas = React.forwardRef<HTMLCanvasElement, Props>(
  (
    {
      width, height,
      brushSize, brushColor, brushOpacity, eraser,
      connected = false,
      onLiveFrame, onFinalBlob, onDrawStart, onDrawEnd
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

    // Multi-touch: estado por pointerId
    const lastPts = useRef<Map<number, { x: number; y: number }>>(new Map());
    const drawing = useRef(false);

    // Throttle para live
    const lastLiveMs = useRef(0);
    const LIVE_INTERVAL_MS = 80;

    useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

    // Inicializa/escala por DPR una sola vez o cuando cambia width/height
    useEffect(() => {
      const c = canvasRef.current!;
      const dpr = window.devicePixelRatio || 1;

      const W = Math.max(1, Math.round(width));
      const H = Math.max(1, Math.round(height));

      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      c.style.width = `${W}px`;
      c.style.height = `${H}px`;

      const ctx = c.getContext("2d");
      if (!ctx) return;

      // Trabajamos en coordenadas lógicas (CSS px) con el ctx escalado
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctxRef.current = ctx;
    }, [width, height]);

    // Utilidades
    const getPos = (e: PointerEvent) => {
      const c = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const applyBrush = () => {
      const ctx = ctxRef.current!;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(0.5, brushSize);
      if (eraser) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = "#000";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = Math.max(0.01, Math.min(1, brushOpacity / 100));
        ctx.strokeStyle = brushColor;
      }
    };

    const drawSeg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const ctx = ctxRef.current!;
      applyBrush();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };

    // Pointer Events (ratón + táctil) — fluido + preventDefault
    useEffect(() => {
      const c = canvasRef.current!;
      const onDown = (e: PointerEvent) => {
        e.preventDefault();
        c.setPointerCapture?.(e.pointerId);
        const p = getPos(e);
        lastPts.current.set(e.pointerId, p);
        if (!drawing.current) {
          drawing.current = true;
          onDrawStart?.();
        }
      };

      const onMove = (e: PointerEvent) => {
        if (!lastPts.current.has(e.pointerId)) return;
        e.preventDefault();
        const p2 = getPos(e);
        const p1 = lastPts.current.get(e.pointerId)!;
        drawSeg(p1, p2);
        lastPts.current.set(e.pointerId, p2);

        if (connected && onLiveFrame) {
          const now = performance.now();
          if (now - lastLiveMs.current >= LIVE_INTERVAL_MS) {
            lastLiveMs.current = now;
            onLiveFrame(c);
          }
        }
      };

      const finishPointer = (e: PointerEvent) => {
        if (!lastPts.current.has(e.pointerId)) return;
        e.preventDefault();
        lastPts.current.delete(e.pointerId);

        if (lastPts.current.size === 0 && drawing.current) {
          drawing.current = false;
          onDrawEnd?.();
          if (onFinalBlob) c.toBlob((b) => b && onFinalBlob(b), "image/png", 1);
        }
      };

      // Listeners NO pasivos (para poder preventDefault)
      c.addEventListener("pointerdown", onDown, { passive: false });
      c.addEventListener("pointermove", onMove, { passive: false });
      c.addEventListener("pointerup", finishPointer, { passive: false });
      c.addEventListener("pointercancel", finishPointer, { passive: false });
      c.addEventListener("pointerout", finishPointer, { passive: false });

      return () => {
        c.removeEventListener("pointerdown", onDown);
        c.removeEventListener("pointermove", onMove);
        c.removeEventListener("pointerup", finishPointer);
        c.removeEventListener("pointercancel", finishPointer);
        c.removeEventListener("pointerout", finishPointer);
      };
    }, [brushSize, brushColor, brushOpacity, eraser, connected, onDrawStart, onDrawEnd, onFinalBlob, onLiveFrame]);

    return (
      <canvas
        ref={canvasRef}
        className="canvas"
        role="img"
        aria-label="Área de dibujo"
      />
    );
  }
);
DrawingCanvas.displayName = "DrawingCanvas";
