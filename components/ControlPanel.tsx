import React from 'react';
import ColorPicker from './ColorPicker';

type Props = {
  room: string;
  connected: boolean;
  prompt: string;
  setPrompt: (v: string) => void;
  sendPrompt: () => void;
  color: string;
  setColor: (v: string) => void;
  brushSize: number;
  setBrushSize: (v: number) => void;
  mode: 'brush' | 'eraser';
  setMode: (m: 'brush' | 'eraser') => void;
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
};

export default function ControlPanel({
  room,
  connected,
  prompt,
  setPrompt,
  sendPrompt,
  color,
  setColor,
  brushSize,
  setBrushSize,
  mode,
  setMode,
  undo,
  redo,
  clearCanvas
}: Props) {
  return (
    <aside
      style={{
        border: '1px solid #1e293b',
        borderRadius: 12,
        padding: 16,
        display: 'grid',
        gap: 12,
        height: 'fit-content',
        background: '#0b1220'
      }}
      aria-label="Panel de control"
    >
      <h2 style={{ margin: 0, fontSize: 18 }}>Sala: {room}</h2>
      <div>WS: {connected ? 'Conectado' : 'Desconectado'}</div>

      <fieldset style={{ border: 'none' }}>
        <legend>Herramienta</legend>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            aria-pressed={mode === 'brush'}
            onClick={() => setMode('brush')}
          >
            Pincel
          </button>
          <button
            aria-pressed={mode === 'eraser'}
            onClick={() => setMode('eraser')}
          >
            Borrador
          </button>
        </div>
      </fieldset>

      <label>
        Tamaño del pincel: {brushSize}px
        <input
          aria-label="Tamaño del pincel"
          type="range"
          min={1}
          max={64}
          step={1}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
        />
      </label>

      <ColorPicker value={color} onChange={setColor} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={undo}>Deshacer</button>
        <button onClick={redo}>Rehacer</button>
        <button onClick={clearCanvas}>Limpiar</button>
      </div>

      <label>
        Prompt a TD:
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          style={{ width: '100%' }}
        />
      </label>
      <button onClick={sendPrompt} disabled={!prompt.trim()}>
        Enviar Prompt
      </button>
    </aside>
  );
}
