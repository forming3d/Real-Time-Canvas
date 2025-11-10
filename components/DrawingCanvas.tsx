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

    // Multi-touch: un punto por pointerId
    const lastPts = useRef<Map<number, { x: number; y: number }>>(new Map());
    const drawing = useRef(false);

    // Throttle para live
    const lastLiveMs = useRef(0);
    const LIVE_INTERVAL_MS = 80;

    useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

    // Inicializa por DPR cuando cambia tamaño lógico
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

      // Coordenadas lógicas (CSS px)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctxRef.current = ctx;
    }, [width, height]);

    const getPos = (e: PointerEvent) => {
      const c = canvasRef.current!;
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
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

    const drawDot = (p: { x: number; y: number }) => {
      const ctx = ctxRef.current!;
      applyBrush();
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, brushSize / 2), 0, Math.PI * 2);
      if (eraser) {
        ctx.fillStyle = "#000";
        ctx.fill();
      } else {
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.fill();
      }
    };

    useEffect(() => {
      const c = canvasRef.current!;
      const onDown = (e: PointerEvent) => {
        e.preventDefault();
        c.setPointerCapture?.(e.pointerId);
        const p = getPos(e);
        lastPts.current.set(e.pointerId, p);

        // Punto inmediato para "tap"
        drawDot(p);

        if (!drawing.current) {
          drawing.current = true;
          console.log('✏️ DrawingCanvas: Iniciando dibujo');
          onDrawStart?.();
        }

        // Frame live inmediato
        if (connected && onLiveFrame) {
          console.log('🎨 DrawingCanvas: Enviando frame onDown');
          onLiveFrame(c);
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
          console.log('✅ DrawingCanvas: Finalizando dibujo');
          onDrawEnd?.();
          if (onFinalBlob) {
            console.log('🖼️ DrawingCanvas: Generando blob final');
            c.toBlob((b) => b && onFinalBlob(b), "image/png", 1);
          }
        }
      };

      // Listeners no pasivos para poder preventDefault
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

    return <canvas ref={canvasRef} className="canvas" role="img" aria-label="Área de dibujo" />;
  }
);
DrawingCanvas.displayName = "DrawingCanvas";
