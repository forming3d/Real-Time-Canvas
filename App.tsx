import React, { useState, useCallback, useRef } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { DrawingCanvas, DrawingCanvasRef } from './components/DrawingCanvas';
import { useWebSocket } from './hooks/useWebSocket';
import { useHistory } from './hooks/useHistory';
import { ConnectionStatus } from './types';

function App() {
  const [color, setColor] = useState<string>('#FFFFFF');
  const [brushSize, setBrushSize] = useState<number>(10);
  const [wsUrl, setWsUrl] = useState<string>('ws://localhost:9980');
  
  const { connectionStatus, connect, disconnect, sendMessage } = useWebSocket(wsUrl);
  
  const drawingCanvasRef = useRef<DrawingCanvasRef>(null);
  const { 
    state: canvasState, 
    setState: setCanvasState, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory<ImageData | null>(null);

  const handleClearCanvas = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    if (canvas) {
        const currentState = canvas.getCanvasState();
        if (currentState) {
            const blankImageData = new ImageData(currentState.width, currentState.height);
            setCanvasState(blankImageData);
        }
    }
  }, [setCanvasState]);

  const handleStrokeEnd = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const newState = canvas.getCanvasState();
      if (newState) {
        setCanvasState(newState);
      }
    }
  }, [setCanvasState]);

  const handleDraw = useCallback((dataUrl: string) => {
    if (connectionStatus === ConnectionStatus.CONNECTED) {
      sendMessage(dataUrl);
    }
  }, [connectionStatus, sendMessage]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col md:flex-row items-stretch p-4 gap-4">
      <header className="md:hidden flex flex-col items-center pb-4">
        <h1 className="text-2xl font-bold text-cyan-300">Real-time Canvas</h1>
        <p className="text-sm text-gray-400">Draw and stream to TouchDesigner</p>
      </header>
      
      <div className="flex-shrink-0">
         <ControlPanel
            color={color}
            setColor={setColor}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
            clearCanvas={handleClearCanvas}
            wsUrl={wsUrl}
            setWsUrl={setWsUrl}
            connectionStatus={connectionStatus}
            connect={connect}
            disconnect={disconnect}
            undo={undo}
            redo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
      </div>

      <main className="flex-grow flex flex-col bg-gray-800 p-4 rounded-lg shadow-2xl">
        <div className="hidden md:flex flex-col items-center pb-4">
          <h1 className="text-3xl font-bold text-cyan-300">Real-time Canvas</h1>
          <p className="text-md text-gray-400">Draw and stream to TouchDesigner</p>
        </div>
        <div className="flex-grow w-full h-full min-h-[300px] md:min-h-0">
          <DrawingCanvas
            ref={drawingCanvasRef}
            color={color}
            brushSize={brushSize}
            onDraw={handleDraw}
            onStrokeEnd={handleStrokeEnd}
            canvasStateToRestore={canvasState}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
