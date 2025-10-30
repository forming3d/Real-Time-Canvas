import { useEffect, useRef } from "react";
import useWebSocket from "../hooks/useWebSocket";

type Props = {
  wsUrl: string;
  room: string;
  color: string;
  size: number;
  mode: "draw" | "erase";
  onApiReady: (api: any) => void;
  onConnectionChange?: (isOpen: boolean) => void;
};

type DrawMsg = {
  t: "draw";
  room: string;
  x0: number; y0: number;
  x1: number; y1: number;
  color: string;
  size: number;
  mode: "draw" | "erase";
};

export default function DrawingCanvas({
  wsUrl, room, color, size, mode, onApiReady, onConnectionChange
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);

  const { send, onMessage, readyState } = useWebSocket(wsUrl);

  // exponer un pequeño API a App/Sidebar
  useEffect(() => {
    const api = {
      setMode: (m: "draw" | "erase") => { current.mode = m; },
      getMode: () => current.mode,
      clearAll: () => clearAll(),
      undo: () => undo(),
      redo: () => redo(),
      setBrushSize: (n: number) => { current.size = n; },
      getBrushSize: () => current.size,
    };
    onApiReady(api);
    // también exponer un sender global para prompts
    (window as any).__RTC_SEND__ = (o: any) => send(o);
  }, []);

  // mantener estado actual “fuera de React”
  const current = useRef({ color, size, mode });
  useEffect(() => { current.current = { color, size, mode }; }, [color, size, mode]);

  useEffect(() => {
    onConnectionChange?.(readyState === "OPEN");
  }, [readyState]);

  // preparar canvas 512×512 con DPR
  useEffect(() => {
    const cvs = canvasRef.current!;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = 512, H = 512;
    cvs.width = Math.floor(W * dpr);
    cvs.height = Math.floor(H * dpr);
    cvs.style.width = `${W}px`;
    cvs.style.height = `${H}px`;
    const ctx = cvs.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // fondo transparente; si quieres gris oscuro:
    // ctx.fillStyle = "#0e1319"; ctx.fillRect(0,0,W,H);
    pushUndo(); // estado inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recepción WS
  useEffect(() => {
    return onMessage((raw) => {
      try {
        const msg = JSON.parse(raw.data) as DrawMsg;
        if (msg.t !== "draw" || msg.room !== room) return;
        drawSegment(
          { x: msg.x0, y: msg.y0 },
          { x: msg.x1, y: msg.y1 },
          msg.color, msg.size, msg.mode
        );
      } catch {}
    });
  }, [onMessage, room]);

  // helpers
  const getCtx = () => canvasRef.current!.getContext("2d")!;
  const toLocal = (ev: MouseEvent | TouchEvent) => {
    const cvs = canvasRef.current!;
    const rect = cvs.getBoundingClientRect();
    const pt = "touches" in ev ? ev.touches[0] : (ev as MouseEvent);
    return {
      x: (pt.clientX - rect.left),
      y: (pt.clientY - rect.top),
    };
  };

  const drawSegment = (
    from: {x:number;y:number},
    to: {x:number;y:number},
    col: string, sz: number, md: "draw"|"erase"
  ) => {
    const ctx = getCtx();
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = sz;
    if (md === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = col;
    }
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  };

  // input
  const last = useRef<{x:number;y:number}|null>(null);
  const mdown = (e: React.MouseEvent|React.TouchEvent) => {
    e.preventDefault();
    last.current = toLocal(e.nativeEvent as any);
  };
  const mmove = (e: React.MouseEvent|React.TouchEvent) => {
    if (!last.current) return;
    const p = toLocal(e.nativeEvent as any);
    drawSegment(last.current, p, current.current.color, current.current.size, current.current.mode);
    // broadcast normalizado (0..1 relativas al 512x512)
    const x0 = last.current.x/512, y0 = last.current.y/512;
    const x1 = p.x/512, y1 = p.y/512;
    send({
      t: "draw", room,
      x0, y0, x1, y1,
      color: current.current.color,
      size: current.current.size,
      mode: current.current.mode
    });
    last.current = p;
  };
  const mup = () => {
    if (last.current) pushUndo();
    last.current = null;
  };

  // historial
  const pushUndo = () => {
    const ctx = getCtx();
    const img = ctx.getImageData(0, 0, 512, 512);
    undoStack.current.push(img);
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  };
  const undo = () => {
    if (undoStack.current.length <= 1) return;
    const ctx = getCtx();
    const last = undoStack.current.pop()!; // actual
    redoStack.current.push(last);
    const prev = undoStack.current[undoStack.current.length - 1];
    ctx.putImageData(prev, 0, 0);
  };
  const redo = () => {
    if (!redoStack.current.length) return;
    const ctx = getCtx();
    const img = redoStack.current.pop()!;
    ctx.putImageData(img, 0, 0);
    undoStack.current.push(img);
  };
  const clearAll = () => {
    const ctx = getCtx();
    ctx.clearRect(0, 0, 512, 512);
    pushUndo();
  };

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        width: 540,
        height: 540,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(1000px 600px at 60% 50%, rgba(168,85,247,0.08), transparent 60%), #0b0e12",
        border: "1px solid #101826",
        borderRadius: 12,
        boxShadow: "0 0 0 1px #0d1622 inset, 0 10px 30px rgba(0,0,0,.35)",
      }}
    >
      <div style={{ padding: 10, borderRadius: 12, background: "#0d131a", boxShadow: "0 0 0 1px #172232 inset" }}>
        <canvas
          ref={canvasRef}
          onMouseDown={mdown}
          onMouseMove={mmove}
          onMouseUp={mup}
          onMouseLeave={mup}
          onTouchStart={mdown}
          onTouchMove={mmove}
          onTouchEnd={mup}
          style={{
            width: 512,
            height: 512,
            background: "#0f151d",
            border: "1px solid #1b2432",
            borderRadius: 8,
            touchAction: "none",
            display: "block",
          }}
          aria-label={`canvas ${room} (${readyState})`}
        />
      </div>
    </div>
  );
}
