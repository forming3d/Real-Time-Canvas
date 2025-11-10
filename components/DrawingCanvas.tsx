import React, { useEffect, useImperativeHandle, useRef } from "react";

type Props = {
  width: number;
  height: number;
  brushSize: number;         // px
  brushColor: string;        // #rrggbb
  brushOpacity: number;      // 1..100
  eraser: boolean;
  connected?: boolean;
  onLiveFrame?: (canvas: HTMLCanvasElement) => void;
  onFinalBlob?: (blob: Blob) => void;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
};

// Export como named para que coincida con tus imports: { DrawingCanvas }
export const DrawingCanvas = React.forwardRef<HTMLCanvasElement, Props>(
  (
    {
      width,
      height,
      brushSize,
      brushColor,
      brushOpacity,
      eraser,
      connected = false,
      onLiveFrame,
      onFinalBlob,
      onDrawStart,
      onDrawEnd,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

    // Estado por puntero (soporta multi-touch)
    const lastPts = useRef<Map<number, { x: number; y: number }>>(new Map());
    const drawing = useRef(false);

    // Throttle para enviar frames live
    const lastLiveMs = useRef(0);
    const LIVE_INTERVAL_MS = 80;

    useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

    // Inicialización / reescala por DPR
    useEffect(() => {
      const c = canvasRef.current!;
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.max(1, Math.round(width));
      const targetH = Math.max(1, Math.round(height));

      c.width = Math.round(targetW * dpr);
      c.height = Math.round(targetH * dpr);
      c.style.width = `${targetW}px`;
      c.style.height = `${targetH}px`;

      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr); // trabajar en unidades lógicas
      ctxRef.current = ctx;
    }, [width, height]);

    // Helpers
    const getPos = (e: PointerEvent) => {
      const c = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left),
        y: (e.clientY - rect.top),
      };
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

    // Eventos Pointer (fluido en ratón y táctil)
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

        // Live frame throttled
        if (connected && onLiveFrame) {
          const now = performance.now();
          if (now - lastLiveMs.current >= LIVE_INTERVAL_MS) {
            lastLiveMs.current = now;
            onLiveFrame(c);
          }
        }
      };

      const finishPointer = async (e: PointerEvent) => {
        if (!lastPts.current.has(e.pointerId)) return;
        e.preventDefault();
        lastPts.current.delete(e.pointerId);

        if (lastPts.current.size === 0 && drawing.current) {
          drawing.current = false;
          onDrawEnd?.();

          if (onFinalBlob) {
            // PNG final del trazo
            c.toBlob((blob) => blob && onFinalBlob(blob), "image/png", 1);
          }
        }
      };

      // Importante: listeners NO pasivos para poder preventDefault
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
