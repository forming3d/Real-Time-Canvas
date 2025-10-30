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
  x: number;
  y: number;
  drag: boolean; // arrastrando (continúa trazo)
  color: string;
  size: number;
};

export default function DrawingCanvas({ color, size, wsUrl, room }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isDown, setIsDown] = useState(false);
  const [lastPt, setLastPt] = useState<{ x: number; y: number } | null>(null);

  const { send, onMessage, readyState } = useWebSocket(wsUrl);

  // Resize físico según DPR y contenedor
  const resizeCanvas = () => {
    const cvs = canvasRef.current!;
    const wrap = wrapperRef.current!;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    cvs.width = Math.max(1, Math.floor(w * dpr));
    cvs.height = Math.max(1, Math.floor(h * dpr));
    cvs.style.width = `${w}px`;
    cvs.style.height = `${h}px`;
    const ctx = cvs.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  }, []);

  // Dibujo local
  const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }, c: string, s: number) => {
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = c;
    ctx.lineWidth = s;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  // Entrada de otros clientes
  useEffect(() => {
    return onMessage((raw) => {
      try {
        const msg: DrawMsg = JSON.parse(raw.data);
        if (msg.t !== "draw" || msg.room !== room) return;
        const cvs = canvasRef.current!;
        const rect = cvs.getBoundingClientRect();
        drawLine(
          { x: msg.x * rect.width, y: msg.y * rect.height },
          { x: msg.x * rect.width, y: msg.y * rect.height }, // punto -> pequeño segmento
          msg.color,
          msg.size
        );
      } catch {}
    });
  }, [onMessage, room]);

  // Normaliza coords 0..1 para enviar poco dato
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
    setLastPt({ x: p.x, y: p.y });
    send({ t: "draw", room, ...p, drag: false, color, size });
  };

  const handleMove = (ev: React.MouseEvent | React.TouchEvent) => {
    if (!isDown) return;
    const p = norm(ev.nativeEvent as any);
    if (lastPt) {
      // dibuja localmente para respuesta inmediata
      const cvs = canvasRef.current!;
      const rect = cvs.getBoundingClientRect();
      drawLine(
        { x: lastPt.x * rect.width, y: lastPt.y * rect.height },
        { x: p.x * rect.width, y: p.y * rect.height },
        color,
        size
      );
    }
    setLastPt(p);
    send({ t: "draw", room, ...p, drag: true, color, size });
  };

  const handleUp = () => {
    setIsDown(false);
    setLastPt(null);
  };

  return (
    <div ref={wrapperRef} style={{ width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
        style={{ display: "block", touchAction: "none", background: "#0e0e14" }}
        aria-label={`canvas ${room} (${readyState})`}
      />
    </div>
  );
}
