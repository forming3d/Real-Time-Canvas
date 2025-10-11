import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { DrawingCanvas, DrawingCanvasRef } from './components/DrawingCanvas';
import { useWebSocket } from './hooks/useWebSocket';
import { useHistory } from './hooks/useHistory';
import { ConnectionStatus, StrokeData, TouchDesignerMessage, TouchDesignerConfig, Point } from './types';

function App() {
  // Estados del canvas
  const [color, setColor] = useState<string>('#FFFFFF');
  const [brushSize, setBrushSize] = useState<number>(10);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>('');
  
  // Configuración de conexión (prioriza env; maneja dev 5173; si no, autodetección)
  const defaultWs = (import.meta as any).env?.VITE_WS_URL
    || (location.port === '5173'
        ? 'ws://localhost:3000/ws'
        : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  const [wsUrl, setWsUrl] = useState<string>(defaultWs);
  
  // Configuración optimizada para TouchDesigner
  const [tdConfig] = useState<TouchDesignerConfig>({
    sendMode: 'vector',
    compressionLevel: 0.8,
    maxPointsPerStroke: 500,
    sendFrequency: 16, // ~60fps
    enableReconnection: true,
    maxReconnectAttempts: 5
  });
  
  const { connectionStatus, connect, disconnect, sendMessage, resetReconnection, reconnectAttempts } = useWebSocket(wsUrl, {
    autoReconnect: tdConfig.enableReconnection,
    maxReconnectAttempts: tdConfig.maxReconnectAttempts,
    reconnectInterval: 1000
  });

  // Autoconectar al montar o al cambiar la URL
  useEffect(() => {
    connect();
  }, [connect, wsUrl]);
  
  const drawingCanvasRef = useRef<DrawingCanvasRef>(null);
  const { 
    state: canvasState, 
    setState: setCanvasState, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory<ImageData | null>(null);

  const handleCanvasAction = useCallback((action: 'clear' | 'undo' | 'redo') => {
    if (connectionStatus === ConnectionStatus.CONNECTED) {
      const message: TouchDesignerMessage = {
        type: 'canvas',
        payload: {
          action,
          timestamp: Date.now()
        }
      };
      sendMessage(JSON.stringify(message));
    }
  }, [connectionStatus, sendMessage]);

  const handleClearCanvas = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    if (canvas) {
        const currentState = canvas.getCanvasState();
        if (currentState) {
            const blankImageData = new ImageData(currentState.width, currentState.height);
            setCanvasState(blankImageData);
        }
    }
    handleCanvasAction('clear');
  }, [setCanvasState, handleCanvasAction]);

  const handleStrokeEnd = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const newState = canvas.getCanvasState();
      if (newState) {
        setCanvasState(newState);
      }
    }
  }, [setCanvasState]);

  const handleStrokeComplete = useCallback((strokeData: StrokeData) => {
    if (connectionStatus === ConnectionStatus.CONNECTED) {
      const message: TouchDesignerMessage = {
        type: 'stroke',
        payload: {
          points: strokeData.points,
          color: strokeData.color,
          brushSize: strokeData.brushSize,
          timestamp: strokeData.timestamp
        }
      };
      sendMessage(JSON.stringify(message));
    }
  }, [connectionStatus, sendMessage]);

  // Fallback raster para TouchDesigner sin Pillow (usa 'draw' por compatibilidad)
  const handleFrame = useCallback((dataUrl: string) => {
    if (connectionStatus === ConnectionStatus.CONNECTED) {
      const message = {
        type: 'draw',
        payload: dataUrl
      };
      sendMessage(JSON.stringify(message));
    }
  }, [connectionStatus, sendMessage]);

  const handleSendPrompt = useCallback(() => {
    if (connectionStatus === ConnectionStatus.CONNECTED && prompt.trim() !== '') {
      // Enviar payload como string simple para máxima compatibilidad con TD
      const message = {
        type: 'prompt',
        payload: prompt.trim()
      };
      sendMessage(JSON.stringify(message));
    }
  }, [connectionStatus, sendMessage, prompt]);

  return (
    <div className="h-dvh w-dvw bg-slate-900 text-slate-100 overflow-hidden">
      {/* Mobile/Tablet: panel arriba (sticky). md+: panel a la izquierda (sticky) */}
      <div className="grid h-full grid-rows-[auto_1fr] md:grid-rows-1 md:grid-cols-[320px_minmax(0,1fr)]">
        {/* Panel de Control - Siempre visible */}
        <aside className="z-10 sticky top-0 md:static md:h-dvh overflow-y-auto border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900 p-4">
          <ControlPanel
            color={color}
            setColor={setColor}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
            isEraser={isEraser}
            setIsEraser={setIsEraser}
            clearCanvas={handleClearCanvas}
            wsUrl={wsUrl}
            setWsUrl={setWsUrl}
            connectionStatus={connectionStatus}
            connect={connect}
            disconnect={disconnect}
            reconnectAttempts={reconnectAttempts}
            resetReconnection={resetReconnection}
            undo={() => { undo(); handleCanvasAction('undo'); }}
            redo={() => { redo(); handleCanvasAction('redo'); }}
            canUndo={canUndo}
            canRedo={canRedo}
            prompt={prompt}
            setPrompt={setPrompt}
            sendPrompt={handleSendPrompt}
          />
        </aside>

        {/* Área de dibujo - Protagonista */}
        <main className="relative min-h-0"> 
          {/* min-h-0 para que el hijo flex pueda contraerse correctamente */}
          <div className="absolute inset-0">
            <DrawingCanvas
              ref={drawingCanvasRef}
              color={color}
              brushSize={brushSize}
              isEraser={isEraser}
              onStrokeComplete={handleStrokeComplete}
              onStrokeEnd={handleStrokeEnd}
              onFrame={handleFrame}
              canvasStateToRestore={canvasState}
              config={{
                maxPointsPerStroke: tdConfig.maxPointsPerStroke,
                sendFrequency: tdConfig.sendFrequency,
                rasterFps: 8
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
