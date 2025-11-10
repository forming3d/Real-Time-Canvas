// ControlPanel.tsx
import React from 'react';

type Props = {
  connected: boolean;
  room: string;
  setRoom: (r: string) => void;
  brushColor: string;
  setBrushColor: (c: string) => void;
  brushSize: number;
  setBrushSize: (n: number) => void;
  eraser: boolean;
  setEraser: (b: boolean) => void;
  clearCanvas: () => void;
  prompt: string;
  setPrompt: (s: string) => void;
  sendPrompt: () => void;
};

export const ControlPanel: React.FC<Props> = ({
  connected, room, setRoom, brushColor, setBrushColor,
  brushSize, setBrushSize, eraser, setEraser,
  clearCanvas, prompt, setPrompt, sendPrompt
}) => {
  return (
    <aside role="complementary" aria-label="Panel de control" className="panel">
      <div className="row">
        <label>
          Sala
          <input value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Nombre de la sala" />
        </label>
        <span aria-live="polite" aria-label={connected ? 'Conectado' : 'Desconectado'}>
          {connected ? '🟢' : '🔴'}
        </span>
      </div>

      <div className="row">
        <label>
          Color
          <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} aria-label="Color de brocha" />
        </label>
        <label>
          Grosor
          <input type="range" min={1} max={64} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            aria-label="Grosor de brocha"
            aria-valuemin={1} aria-valuemax={64} aria-valuenow={brushSize} />
        </label>
        <button type="button" className="btn" onClick={() => setEraser(!eraser)} aria-pressed={eraser} aria-label="Alternar goma">
          {eraser ? 'Goma ON' : 'Goma OFF'}
        </button>
        <button type="button" className="btn" onClick={clearCanvas} aria-label="Borrar lienzo">Borrar</button>
      </div>

      <div className="col">
        <label>
          Prompt
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Texto de prompt" />
        </label>
        <button type="button" className="btn" onClick={sendPrompt}>Enviar prompt</button>
      </div>
    </aside>
  );
};
