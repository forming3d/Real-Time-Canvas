import React, { useState } from 'react';
import { ConnectionStatus } from '../types';
import { ClearIcon, ConnectIcon, DisconnectIcon, ChevronDownIcon, ChevronUpIcon, UndoIcon, RedoIcon, SendIcon, BrushIcon, PromptIcon, ActionsIcon } from './icons';

interface ControlPanelProps {
  color: string;
  setColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  isEraser: boolean;
  setIsEraser: (isEraser: boolean) => void;
  clearCanvas: () => void;
  wsUrl: string;
  setWsUrl: (url: string) => void;
  connectionStatus: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  reconnectAttempts: number;
  resetReconnection: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  prompt: string;
  setPrompt: (prompt: string) => void;
  sendPrompt: () => void;
}

const StatusIndicator: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const statusConfig = {
    [ConnectionStatus.DISCONNECTED]: { color: 'bg-slate-500', text: 'Disconnected' },
    [ConnectionStatus.CONNECTING]: { color: 'bg-amber-500', text: 'Connecting...' },
    [ConnectionStatus.CONNECTED]: { color: 'bg-green-500', text: 'Connected' },
    [ConnectionStatus.ERROR]: { color: 'bg-red-500', text: 'Error' },
  };

  const { color, text } = statusConfig[status];

  return (
    <div className="flex items-center space-x-2">
      <div className={"w-3 h-3 rounded-full " + color + " animate-pulse"}></div>
      <span className="text-sm text-slate-400">{text}</span>
    </div>
  );
};

const PREDEFINED_COLORS = [
  { name: 'White', value: '#FFFFFF', className: 'bg-white' },
  { name: 'Light Gray', value: '#C1C1C1', className: 'bg-gray-300' },
  { name: 'Gray', value: '#636363', className: 'bg-gray-600' },
  { name: 'Black', value: '#000000', className: 'bg-black' },
  { name: 'Red', value: '#ef4444', className: 'bg-red-500' },
  { name: 'Orange', value: '#f97316', className: 'bg-orange-500' },
  { name: 'Yellow', value: '#eab308', className: 'bg-yellow-500' },
  { name: 'Lime', value: '#84cc16', className: 'bg-lime-500' },
  { name: 'Green', value: '#22c55e', className: 'bg-green-500' },
  { name: 'Teal', value: '#14b8a6', className: 'bg-teal-500' },
  { name: 'Cyan', value: '#06b6d4', className: 'bg-cyan-500' },
  { name: 'Blue', value: '#3b82f6', className: 'bg-blue-500' },
  { name: 'Purple', value: '#8b5cf6', className: 'bg-purple-500' },
  { name: 'Fuchsia', value: '#d946ef', className: 'bg-fuchsia-500' },
  { name: 'Pink', value: '#ec4899', className: 'bg-pink-500' }
];

const PREDEFINED_BRUSH_SIZES = [5, 10, 20, 40];

const CollapsibleSection: React.FC<{ title: string; icon: React.ReactNode; isOpen: boolean; onToggle: () => void; children: React.ReactNode; }> = ({ title, icon, isOpen, onToggle, children }) => (
    <div className="border-b border-slate-700/50">
        <button
            onClick={onToggle}
            className="w-full flex justify-between items-center py-3 text-lg font-semibold focus:outline-none text-slate-200 hover:text-white transition-colors"
        >
            <div className="flex items-center space-x-3">
                {icon}
                <span className="text-base font-semibold">{title}</span>
            </div>
            {isOpen ? <ChevronUpIcon className="w-5 h-5 text-slate-400" /> : <ChevronDownIcon className="w-5 h-5 text-slate-400" />}
        </button>
        {isOpen && <div className="pb-4 pt-2 flex flex-col space-y-4">{children}</div>}
    </div>
);

export const ControlPanel: React.FC<ControlPanelProps> = ({
  color,
  setColor,
  brushSize,
  setBrushSize,
  isEraser,
  setIsEraser,
  clearCanvas,
  wsUrl,
  setWsUrl,
  connectionStatus,
  connect,
  disconnect,
  reconnectAttempts,
  resetReconnection,
  undo,
  redo,
  canUndo,
  canRedo,
  prompt,
  setPrompt,
  sendPrompt,
}) => {
  const [openSections, setOpenSections] = useState({
    connection: true,
    prompt: true,
    brush: true,
    actions: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const isConnected = connectionStatus === ConnectionStatus.CONNECTED;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-4 rounded-xl shadow-2xl flex flex-col space-y-2 w-full h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-center mb-4 bg-gradient-to-r from-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">
        Control Panel
      </h2>

      <CollapsibleSection title="Connection" icon={<ConnectIcon className="w-5 h-5 text-cyan-400" />} isOpen={openSections.connection} onToggle={() => toggleSection('connection')}>
        <div className="flex flex-col space-y-2">
            <label htmlFor="ws-url" className="text-sm font-medium text-slate-400">WebSocket URL</label>
            <input
            id="ws-url"
            type="text"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            placeholder="wss://real-time-canvas-ok.onrender.com/ws"
            className="bg-slate-700/50 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isConnected}
            />
        </div>
        <div className="flex items-center justify-between">
            <div className="flex flex-col">
                <StatusIndicator status={connectionStatus} />
                {reconnectAttempts > 0 && connectionStatus === ConnectionStatus.CONNECTING && (
                    <span className="text-xs text-amber-400 mt-1">
                        Reconnecting... ({reconnectAttempts}/5)
                    </span>
                )}
            </div>
            <div className="flex space-x-2">
                {isConnected ? (
                    <button
                        onClick={disconnect}
                        className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200"
                    >
                        <DisconnectIcon className="w-5 h-5" />
                        <span>Disconnect</span>
                    </button>
                ) : (
                    <button
                        onClick={connect}
                        disabled={connectionStatus === ConnectionStatus.CONNECTING}
                        className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ConnectIcon className="w-5 h-5" />
                        <span>Connect</span>
                    </button>
                )}
                {reconnectAttempts > 0 && (
                    <button
                        onClick={resetReconnection}
                        className="flex items-center space-x-2 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-3 rounded-md transition-colors duration-200"
                        title="Reset reconnection attempts"
                    >
                        <span className="text-xs">Reset</span>
                    </button>
                )}
            </div>
        </div>
          {/* Cierre del contenedor space-y-4 */}
      </CollapsibleSection>

      <CollapsibleSection title="AI Prompt" icon={<PromptIcon className="w-5 h-5 text-fuchsia-400"/>} isOpen={openSections.prompt} onToggle={() => toggleSection('prompt')}>
        <textarea
            id="ai-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A vibrant landscape, masterpiece..."
            className="bg-slate-700/50 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 h-28 resize-none"
            aria-label="AI Prompt for Stable Diffusion"
        />
        <button
            onClick={sendPrompt}
            disabled={!isConnected || prompt.trim() === ''}
            className="flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <SendIcon className="w-5 h-5" />
            <span>Send Prompt</span>
        </button>
      </CollapsibleSection>

      <CollapsibleSection title="Brush Settings" icon={<BrushIcon className="w-5 h-5 text-green-400"/>} isOpen={openSections.brush} onToggle={() => toggleSection('brush')}>
        <div className="space-y-4">
           {/* Paleta de colores con mejor accesibilidad */}
            import ColorPicker from "./ColorPicker";
            ...
            <ColorPicker color={color} onChange={setColor} showHistory />


           {/* Herramientas */}
           <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-400">Tools</h3>
              
              {/* Toggle Borrador/Pincel */}
              <button
                type="button"
                aria-pressed={isEraser}
                onClick={() => setIsEraser(!isEraser)}
                className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${isEraser ? 'bg-fuchsia-500 text-black' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                aria-label={isEraser ? "Switch to brush mode" : "Switch to eraser mode"}
              >
                {isEraser ? "🧽 Eraser Mode" : "🖌️ Brush Mode"}
              </button>
           </div>

           {/* Tamaño del pincel/borrador */}
           <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-400">Size</h3>
              <div className="grid grid-cols-4 gap-2">
                  {PREDEFINED_BRUSH_SIZES.map(size => (
                      <button
                          key={size}
                          onClick={() => setBrushSize(size)}
                          className={`w-full aspect-square flex items-center justify-center rounded-full transition-colors duration-200 ${brushSize === size ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                          aria-label={`Set ${isEraser ? 'eraser' : 'brush'} size to ${size}px`}
                          title={`${size}px`}
                      >
                          <span className="text-sm font-bold">{size}</span>
                      </button>
                  ))}
              </div>
              
              <div className="flex flex-col space-y-2">
                <label htmlFor="brush-size" className="text-sm font-medium text-slate-400">
                  Custom Size: {brushSize}px
                </label>
                <input
                  id="brush-size"
                  type="range"
                  min="1"
                  max="100"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="accent-purple-500"
                  aria-label={`Adjust ${isEraser ? 'eraser' : 'brush'} size`}
                />
              </div>
           </div>
        </div>
      </CollapsibleSection>
      
      <CollapsibleSection title="Canvas Actions" icon={<ActionsIcon className="w-5 h-5 text-amber-400" />} isOpen={openSections.actions} onToggle={() => toggleSection('actions')}>
        <div className="space-y-3">
          {/* Historial */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Undo last action"
              title="Undo last action"
            >
              <UndoIcon className="w-4 h-4" />
              <span className="text-sm">Undo</span>
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Redo last action"
              title="Redo last action"
            >
              <RedoIcon className="w-4 h-4" />
              <span className="text-sm">Redo</span>
            </button>
          </div>
          
          {/* Limpiar canvas */}
          <button
            onClick={clearCanvas}
            className="w-full flex items-center justify-center space-x-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 font-medium py-2 px-3 rounded-lg transition-colors duration-200"
            aria-label="Clear the entire canvas"
            title="Clear canvas"
          >
            <ClearIcon className="w-4 h-4" />
            <span className="text-sm">Clear Canvas</span>
          </button>
        </div>
      </CollapsibleSection>
    </div>
  );
};
