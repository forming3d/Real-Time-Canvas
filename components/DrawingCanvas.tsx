import React, { useEffect, useRef, useState } from "react";
import { useWS } from "./useWebSocket";

type Point = { x: number; y: number };

const SIZE = 512; // lienzo 512x512 como acordamos

export default function DrawingCanvas() {
  const { send, status, room } = useWS();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(12);
  const [color, setColor] = useState("#ffffff");
  const [prompt, setPrompt] = useState("");

  // init canvas
  useEffect(() => {
    const c = canvasRef.current!;
    c.width = SIZE;
    c.height = SIZE;
    const ctx = c.getContext("2d")!;
    ctxRef.current = ctx;
    // fondo negro
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    return { x, y };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const { x, y } = getPos(e);
    const ctx = ctxRef.current!;
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const { x, y } = getPos(e);
    const ctx = ctxRef.current!;
    ctx.lineTo(x, y);
    ctx.stroke();
    throttledSendFrame(); // <- manda cada N ms
  }

  function endDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    setIsDrawing(false);
    const ctx = ctxRef.current!;
    ctx.closePath();
    throttledSendFrame.flush?.(); // última imagen al soltar
  }

  // throttle “manual” simple
  let throttleFlag = useRef(false);
  const throttledSendFrame: any = () => {
    if (throttleFlag.current) return;
    throttleFlag.current = true;
    window.setTimeout(() => {
      throttleFlag.current = false;
      sendFrame();
    }, 140); // ~7 fps de envío
  };
  throttledSendFrame.flush = () => sendFrame();

  function sendFrame() {
    const c = canvasRef.current!;
    // ya estamos en 512x512 → directo
    const dataURL = c.toDataURL("image/jpeg", 0.7); // pequeño y suficiente
    send("draw", dataURL); // <<<<<<<<<< {type:'draw', payload:'data:image/jpeg;base64,...'}
  }

  function clear() {
    const ctx = ctxRef.current!;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();
    sendFrame();
  }

  function sendPrompt() {
    send("proc", prompt); // también acepta 'prompt'
  }

  const ledColor = status === "open" ? "#22c55e" : status === "connecting" ? "#eab308" : "#ef4444";

  return (
    <div style={{display:"grid", gap:12, gridTemplateColumns:"1fr", color:"#ddd"}}>
      <div style={{display:"flex", alignItems:"center", gap:10}}>
        <span style={{
          width:10, height:10, borderRadius:9999, background:ledColor,
          boxShadow:`0 0 10px ${ledColor}`
        }}/>
        <span style={{fontFamily:"monospace"}}>room=<b>{room}</b> | ws=<b>{status}</b></span>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"auto 1fr auto", alignItems:"center", gap:12}}>
        <label>Brush</label>
        <input
          type="range" min={1} max={64} value={brushSize}
          onChange={e => setBrushSize(parseInt(e.target.value))}
        />
        <span style={{width:42, textAlign:"right"}}>{brushSize}px</span>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"auto auto 1fr", alignItems:"center", gap:12}}>
        <label>Color</label>
        <input type="color" value={color} onChange={e => setColor(e.target.value)} />
        <button onClick={clear} style={btnStyle}>Clear</button>
      </div>

      <div style={{
        width: SIZE, height: SIZE, border:"1px solid #333",
        borderRadius:12, background:"#111", placeSelf:"start"
      }}>
        <canvas
          ref={canvasRef}
          style={{ width: SIZE, height: SIZE, cursor:"crosshair", touchAction:"none" }}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr auto", gap:12}}>
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Escribe PROC / prompt…"
          style={inputStyle}
        />
        <button onClick={sendPrompt} style={btnStyle}>Enviar PROC</button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "#2a2a2a",
  border: "1px solid #3a3a3a",
  borderRadius: 8,
  color: "#eee",
  cursor: "pointer"
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  background: "#0d0d0d",
  border: "1px solid #333",
  borderRadius: 8,
  color: "#ddd",
  outline: "none"
};
