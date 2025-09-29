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
  const [prompt, setPrompt] = useState<string>('');
  
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
      const message = { type: 'draw', payload: dataUrl };
      sendMessage(JSON.stringify(message));
    }
  }, [connectionStatus, sendMessage]);

  const handleSendPrompt = useCallback(() => {
    if (connectionStatus === ConnectionStatus.CONNECTED && prompt.trim() !== '') {
      const message = { type: 'prompt', payload: prompt };
      sendMessage(JSON.stringify(message));
    }
  }, [connectionStatus, sendMessage, prompt]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row items-stretch p-4 gap-4 font-sans">
      <div className="flex-shrink-0 w-full md:w-80">
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
            prompt={prompt}
            setPrompt={setPrompt}
            sendPrompt={handleSendPrompt}
          />
      </div>

      <main className="flex-grow flex flex-col">
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