import { useEffect, useRef, useState } from "react";
import useWebSocket from "../hooks/useWebSocket";

type Props = {
  color: string;
  size: number;
  wsUrl: string;
  room: string;
};

type DrawMsg = {
  t: "draw";
  room: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  size: number;
  mode: "draw" | "erase";
};

export default function DrawingCanvas({ color, size, wsUrl, room }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null); // para ver el BEFORE
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [isDown, setIsDown] = useState(false);
  const [lastPt, setLastPt] = useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<"draw" | "erase">("draw");

  const [beforeImg, setBeforeImg] = useState<string | null>(null); // dataURL del BEFORE
  const [showCompare, setShowCompare] = useState(false);

  const { send, onMessage, readyState } = useWebSocket(wsUrl);

  // Resize canvas & overlay
  const resizeCanvas = () => {
    const cvs = canvasRef.current!;
    const ov = overlayRef.current!;
    const wrap = wrapperRef.current!;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;

    for (const el of [cvs, ov]) {
      el.width = Math.max(1, Math.floor(w * dpr));
      el.height = Math.max(1, Math.floor(h * dpr));
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      const ctx = el.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // si hay BEFORE, redibujar en overlay si está activo
    if (beforeImg && showCompare) drawBeforeOverlay();
  };

  useEffect(() => {
    resizeCanvas();
    const obs = new ResizeObserver(resizeCanvas);
    if (wrapperRef.current) obs.observe(wrapperRef.current);
    window.addEventListener("orientationchange", resizeCanvas);
    return () => {
      obs.disconnect();
      window.removeEventListener("orientationchange", resizeCanvas);
    };
  }, [beforeImg, showCompare]);

  // Dibujo de un segmento
  const drawSegment = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    c: string,
    s: number,
    m: "draw" | "erase"
  ) => {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = s;
    if (m === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = c;
    }
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  };

  // Entrada de otros clientes
  useEffect(() => {
    return onMessage((raw) => {
      try {
        const msg: DrawMsg = JSON.parse(raw.data);
        if (msg.t !== "draw" || msg.room !== room) return;
        const cvs = canvasRef.current!;
        const rect = cvs.getBoundingClientRect();
        const ctx = cvs.getContext("2d")!;
        drawSegment(
          ctx,
          { x: msg.x0 * rect.width, y: msg.y0 * rect.height },
          { x: msg.x1 * rect.width, y: msg.y1 * rect.height },
          msg.color,
          msg.size,
          msg.mode
        );
      } catch {}
    });
  }, [onMessage, room]);

  // Normaliza coords 0..1
  const norm = (ev: MouseEvent | TouchEvent) => {
    const cvs = canvasRef.current!;
    const rect = cvs.getBoundingClientRect();
    const pt = "touches" in ev ? ev.touches[0] : (ev as MouseEvent);
    const x = (pt.clientX - rect.left) / rect.width;
    const y = (pt.clientY - rect.top) / rect.height;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  };

  const handleDown = (ev: React.MouseEvent | React.TouchEvent) => {
    ev.preventDefault();
    setIsDown(true);
    const p = norm(ev.nativeEvent as any);
    setLastPt(p);
  };

  const handleMove = (ev: React.MouseEvent | React.TouchEvent) => {
    if (!isDown) return;
    const p = norm(ev.nativeEvent as any);
    if (lastPt) {
      const cvs = canvasRef.current!;
      const rect = cvs.getBoundingClientRect();
      const ctx = cvs.getContext("2d")!;
      drawSegment(
        ctx,
        { x: lastPt.x * rect.width, y: lastPt.y * rect.height },
        { x: p.x * rect.width, y: p.y * rect.height },
        color,
        size,
        mode
      );

      // broadcast
      const msg: DrawMsg = {
        t: "draw",
        room,
        x0: lastPt.x,
        y0: lastPt.y,
        x1: p.x,
        y1: p.y,
        color,
        size,
        mode,
      };
      send(msg);
    }
    setLastPt(p);
  };

  const handleUp = () => {
    setIsDown(false);
    setLastPt(null);
  };

  // --- API expuesta al panel ---
  const clearAll = () => {
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext("2d")!;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
  };

  const saveBefore = () => {
    const cvs = canvasRef.current!;
    setBeforeImg(cvs.toDataURL("image/png"));
  };

  const drawBeforeOverlay = () => {
    const ov = overlayRef.current!;
    const ctx = ov.getContext("2d")!;
    ctx.clearRect(0, 0, ov.width, ov.height);
    if (!beforeImg) return;
    const img = new Image();
    img.onload = () => {
      ctx.globalAlpha = 0.65; // opacidad del BEFORE
      // Ajusta al tamaño CSS actual
      const rect = ov.getBoundingClientRect();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = beforeImg;
  };

  useEffect(() => {
    if (showCompare) drawBeforeOverlay();
    else {
      const ov = overlayRef.current!;
      ov.getContext("2d")!.clearRect(0, 0, ov.width, ov.height);
    }
  }, [showCompare]);

  const revertBefore = () => {
    if (!beforeImg) return;
    const img = new Image();
    img.onload = () => {
      const cvs = canvasRef.current!;
      const ctx = cvs.getContext("2d")!;
      const rect = cvs.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = beforeImg;
  };

  // Render
  return (
    <div ref={wrapperRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
        style={{ display: "block", touchAction: "none", background: "#0e0e14", position: "absolute", inset: 0 }}
        aria-label={`canvas ${room} (${readyState})`}
      />
      {/* Overlay para ver el BEFORE al mantener pulsado el botón */}
      <canvas
        ref={overlayRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />

      {/* Controles (se comunican con App a través de props mediante el footer) */}
      {/* Nota: El panel está en App; solo exponemos funciones via callbacks */}
      <ControlsBridge
        mode={mode}
        setMode={setMode}
        clearAll={clearAll}
        saveBefore={saveBefore}
        setShowCompare={setShowCompare}
        revertBefore={revertBefore}
        hasBefore={!!beforeImg}
      />
    </div>
  );
}

/**
 * Pequeño bridge para pasar handlers a ControlPanel sin cambiar App.tsx.
 * App “escucha” custom events del DOM y los reinyecta en ControlPanel.
 */
function ControlsBridge(props: {
  mode: "draw" | "erase";
  setMode: (m: "draw" | "erase") => void;
  clearAll: () => void;
  saveBefore: () => void;
  setShowCompare: (b: boolean) => void;
  revertBefore: () => void;
  hasBefore: boolean;
}) {
  // Publica funciones en window para que App.tsx las consuma
  // (más simple que levantar mucho estado ahora mismo)
  // @ts-ignore
  window.__RTC_CANVAS_API__ = props;
  return null;
}
