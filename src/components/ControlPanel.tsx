import React from 'react';
import ColorPickerPro from './ColorPickerPro';

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
  recent?: string[];
  onPickRecent?: (hex: string) => void;
};

export const ControlPanel: React.FC<Props> = ({
  connected, room, setRoom, brushColor, setBrushColor,
  brushSize, setBrushSize, eraser, setEraser,
  clearCanvas, prompt, setPrompt, sendPrompt, recent = [], onPickRecent
}) => {
  return (
    <aside role="complementary" aria-label="Panel de control" className="panel">
      <div className="row">
        <label>
          Sala
          <input value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Nombre de la sala" />
        </label>
        <span>Conexión: {connected ? 'activa' : 'inactiva'}</span>
      </div>

      <div className="col">
        <h3>Color</h3>
        <ColorPickerPro
          value={brushColor}
          onChange={setBrushColor}
          recent={recent}
          onPickRecent={onPickRecent}
        />
      </div>

      <div className="col">
        <h3>Pincel</h3>
        <label>Grosor
          <input type="range" min={1} max={80} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))} />
        </label>
        <div className="row" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button className={`tool-button ${!eraser ? 'active' : ''}`} onClick={() => setEraser(false)}>Pincel</button>
          <button className={`tool-button ${eraser ? 'active' : ''}`} onClick={() => setEraser(true)}>Borrador</button>
        </div>
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
