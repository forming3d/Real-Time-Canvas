import React from 'react';
import ColorPicker from './ColorPicker';

interface Props {
  room: string;
  connected: boolean;
  connectionStatus?: string;

  prompt: string;
  setPrompt: (v: string) => void;
  sendPrompt: () => void;

  color: string;
  setColor: (v: string) => void;

  brushSize: number;
  setBrushSize: (n: number) => void;

  mode: 'brush' | 'eraser';
  setMode: (m: 'brush' | 'eraser') => void;

  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
  canUndo: boolean;
  canRedo: boolean;

  onConnect: () => void;
  onDisconnect: () => void;
}

export default function ControlPanel(props: Props) {
  const {
    room, connected, connectionStatus,
    prompt, setPrompt, sendPrompt,
    color, setColor, brushSize, setBrushSize,
    mode, setMode,
    undo, redo, clearCanvas, canUndo, canRedo,
    onConnect, onDisconnect,
  } = props;

  return (
    <aside style={{
      padding: 16,
      borderRight: '1px solid #1e293b',
      display: 'grid',
      gap: 16
    }}>
      <div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Sala</div>
        <div style={{ fontSize: 12, opacity: 0.8, userSelect: 'all' }}>{room}</div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {!connected ? (
          <button onClick={onConnect} style={btn()}>
            Conectar
          </button>
        ) : (
          <button onClick={onDisconnect} style={btn()}>
            Desconectar
          </button>
        )}
        <span style={{ fontSize: 12, alignSelf: 'center', opacity: 0.8 }}>
          Estado: {connectionStatus}
        </span>
      </div>

      <section>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Pincel</div>
        <ColorPicker value={color} onChange={setColor} />
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Tamaño</label>
          <input
            type="range"
            min={2}
            max={64}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 12, opacity: 0.8 }}>{brushSize}px</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={() => setMode('brush')}
            style={btn(mode === 'brush')}
            aria-pressed={mode === 'brush'}
          >
            Pincel
          </button>
          <button
            onClick={() => setMode('eraser')}
            style={btn(mode === 'eraser')}
            aria-pressed={mode === 'eraser'}
          >
            Goma
          </button>
        </div>
      </section>

      <section style={{ display: 'flex', gap: 8 }}>
        <button onClick={undo} disabled={!canUndo} style={btn()}>
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo} style={btn()}>
          Redo
        </button>
        <button onClick={clearCanvas} style={btn()}>
          Limpiar
        </button>
      </section>

      <section>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Prompt → TD</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Describe lo que quieres generar…"
          style={{
            width: '100%',
            resize: 'vertical',
            background: '#0b1220',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 8
          }}
        />
        <button onClick={sendPrompt} style={{ ...btn(), marginTop: 8 }}>
          Enviar prompt
        </button>
      </section>
    </aside>
  );
}

function btn(active = true): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #334155',
    background: active ? '#0b1220' : '#0b1220',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontWeight: 600,
  };
}
