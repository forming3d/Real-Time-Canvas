import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';

export interface DrawingCanvasRef {
  getCanvasState: () => ImageData | null;
}

interface DrawingCanvasProps {
  color: string;
  brushSize: number;
  onDraw: (dataUrl: string) => void;
  onStrokeEnd: () => void;
  canvasStateToRestore: ImageData | null;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  color,
  brushSize,
  onDraw,
  onStrokeEnd,
  canvasStateToRestore
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    getCanvasState: () => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (canvas && context) {
        return context.getImageData(0, 0, canvas.width, canvas.height);
      }
      return null;
    }
  }));

  useEffect(() => {
    const context = contextRef.current;
    const canvas = canvasRef.current;
    if (context && canvas) {
      if (canvasStateToRestore) {
        context.putImageData(canvasStateToRestore, 0, 0);
      } else {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [canvasStateToRestore]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = contextRef.current;
    if (!context) return;

    const { width, height } = canvas.getBoundingClientRect();
    if (canvas.width !== width || canvas.height !== height) {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      if (tempCtx) tempCtx.drawImage(canvas, 0, 0);

      canvas.width = width;
      canvas.height = height;
      
      context.strokeStyle = color;
      context.lineWidth = brushSize;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      
      if (tempCtx) context.drawImage(tempCanvas, 0, 0);
    }
  }, [brushSize, color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [resizeCanvas]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
      contextRef.current.lineWidth = brushSize;
    }
  }, [color, brushSize]);

  const getEventPosition = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const touch = e instanceof TouchEvent ? e.touches[0] : null;
    const mouse = e instanceof MouseEvent ? e : null;
    
    const clientX = touch ? touch.clientX : (mouse ? mouse.clientX : 0);
    const clientY = touch ? touch.clientY : (mouse ? mouse.clientY : 0);

    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    const pos = getEventPosition(e);
    if (!pos) return;
    isDrawingRef.current = true;
    lastPositionRef.current = pos;
  }, [getEventPosition]);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const pos = getEventPosition(e);
    if (!pos || !lastPositionRef.current) return;
    const context = contextRef.current;
    if (context) {
      context.beginPath();
      context.moveTo(lastPositionRef.current.x, lastPositionRef.current.y);
      context.lineTo(pos.x, pos.y);
      context.stroke();
    }
    lastPositionRef.current = pos;
  }, [getEventPosition]);

  const stopDrawing = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPositionRef.current = null;
      onStrokeEnd();
    }
  }, [onStrokeEnd]);

  const sendCanvasData = useCallback(() => {
    if (isDrawingRef.current && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.5);
      onDraw(dataUrl);
    }
    animationFrameIdRef.current = requestAnimationFrame(sendCanvasData);
  }, [onDraw]);
  
  useEffect(() => {
    animationFrameIdRef.current = requestAnimationFrame(sendCanvasData);
    return () => {
      if(animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [sendCanvasData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    document.addEventListener('mouseup', stopDrawing);
    
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    document.addEventListener('touchend', stopDrawing);
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      document.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      document.removeEventListener('touchend', stopDrawing);
    };
  }, [startDrawing, draw, stopDrawing]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full bg-gray-900 border-2 border-gray-700 rounded-lg shadow-inner touch-none"
    />
  );
});
