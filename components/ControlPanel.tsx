import React, { useState } from 'react';
import { ConnectionStatus } from '../types';
import { ClearIcon, ConnectIcon, DisconnectIcon, ChevronDownIcon, ChevronUpIcon, UndoIcon, RedoIcon } from './icons';

interface ControlPanelProps {
  color: string;
  setColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  clearCanvas: () => void;
  wsUrl: string;
  setWsUrl: (url: string) => void;
  connectionStatus: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const StatusIndicator: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const statusConfig = {
    [ConnectionStatus.DISCONNECTED]: { color: 'bg-gray-500', text: 'Disconnected' },
    [ConnectionStatus.CONNECTING]: { color: 'bg-yellow-500', text: 'Connecting...' },
    [ConnectionStatus.CONNECTED]: { color: 'bg-green-500', text: 'Connected' },
    [ConnectionStatus.ERROR]: { color: 'bg-red-500', text: 'Error' },
  };

  const { color, text } = statusConfig[status];

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${color}`}></div>
      <span>{text}</span>
    </div>
  );
};

const PREDEFINED_COLORS = [
  '#FFFFFF', '#C1C1C1', '#636363', '#000000',
  '#FF5A5A', '#FFB85A', '#FFFF5A', '#ADFF5A',
  '#5AFFB8', '#5AFFFF', '#5AB8FF', '#5A5AFF',
  '#B85AFF', '#FF5AFF', '#FF5AB8'
];

const PREDEFINED_BRUSH_SIZES = [5, 10, 20, 40];

export const ControlPanel: React.FC<ControlPanelProps> = ({
  color,
  setColor,
  brushSize,
  setBrushSize,
  clearCanvas,
  wsUrl,
  setWsUrl,
  connectionStatus,
  connect,
  disconnect,
  undo,
  redo,
  canUndo,
  canRedo,
}) => {
  const [isConnectionPanelOpen, setIsConnectionPanelOpen] = useState(false);
  const isConnected = connectionStatus === ConnectionStatus.CONNECTED;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-2xl flex flex-col space-y-6 w-full md:w-80">
      <h2 className="text-2xl font-bold text-cyan-400">Controls</h2>

      <div className="space-y-2">
        <button
          onClick={() => setIsConnectionPanelOpen(!isConnectionPanelOpen)}
          className="w-full flex justify-between items-center text-lg font-semibold border-b border-gray-600 pb-2 focus:outline-none"
        >
          <span>Connection</span>
          {isConnectionPanelOpen ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
        </button>
        {isConnectionPanelOpen && (
          <div className="pt-4 flex flex-col space-y-4">
            <div className="flex flex-col space-y-2">
              <label htmlFor="ws-url" className="text-sm font-medium text-gray-400">WebSocket URL</label>
              <input
                id="ws-url"
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                placeholder="ws://localhost:9980"
                className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                disabled={isConnected}
              />
            </div>
            <div className="flex items-center justify-between">
              <StatusIndicator status={connectionStatus} />
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
                  className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ConnectIcon className="w-5 h-5" />
                  <span>Connect</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b border-gray-600 pb-2">Brush Settings</h3>
        
        <div className="space-y-2">
           <label className="text-sm font-medium text-gray-400">Color Palette</label>
           <div className="grid grid-cols-4 gap-2">
                {PREDEFINED_COLORS.map((c) => (
                    <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-full h-10 rounded-md cursor-pointer transition-transform duration-150 transform hover:scale-110 ${color === c ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-gray-800' : ''}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Color ${c}`}
                    />
                ))}
                <input
                    id="color-picker"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full h-10 p-1 bg-gray-700 border-0 rounded-md cursor-pointer"
                    aria-label="Custom color picker"
                />
           </div>
        </div>

        <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Brush Size</label>
            <div className="flex justify-between items-center space-x-2">
                {PREDEFINED_BRUSH_SIZES.map(size => (
                    <button
                        key={size}
                        onClick={() => setBrushSize(size)}
                        className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-200 ${brushSize === size ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                        aria-label={`Set brush size to ${size}px`}
                    >
                        <span className="text-sm font-bold">{size}</span>
                    </button>
                ))}
            </div>
        </div>
        
        <div className="flex flex-col space-y-2">
          <label htmlFor="brush-size" className="text-sm font-medium text-gray-400">Custom Size: {brushSize}px</label>
          <input
            id="brush-size"
            type="range"
            min="1"
            max="100"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b border-gray-600 pb-2">Actions</h3>
        <div className="flex space-x-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="w-full flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Undo last action"
          >
            <UndoIcon className="w-5 h-5" />
            <span>Undo</span>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="w-full flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Redo last action"
          >
            <RedoIcon className="w-5 h-5" />
            <span>Redo</span>
          </button>
        </div>
        <button
          onClick={clearCanvas}
          className="w-full flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200"
        >
          <ClearIcon className="w-5 h-5" />
          <span>Clear Canvas</span>
        </button>
      </div>
    </div>
  );
};
