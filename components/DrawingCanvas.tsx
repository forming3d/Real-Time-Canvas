import React, { useRef, useEffect, useLayoutEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Point, StrokeData } from '../types';

export interface DrawingCanvasRef {
  getCanvasState: () => ImageData | null;
  getCurrentStroke: () => StrokeData | null;
  clearCanvas: () => void;
}

interface DrawingCanvasProps {
  color: string;
  brushSize: number;
  isEraser: boolean;
  onStrokeComplete: (strokeData: StrokeData) => void;
  onStrokeEnd: () => void;
  onFrame?: (dataUrl: string) => void;
  canvasStateToRestore: ImageData | null;
  config?: {
    maxPointsPerStroke: number;
    sendFrequency: number;
    rasterFps?: number;
  };
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  color,
  brushSize,
  isEraser,
  onStrokeComplete,
  onStrokeEnd,
  canvasStateToRestore,
  config = { maxPointsPerStroke: 1000, sendFrequency: 16, rasterFps: 8 }
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  
  // Estados de dibujo
  const isDrawingRef = useRef(false);
  const lastPositionRef = useRef<Point | null>(null);
  const currentStrokeRef = useRef<Point[]>([]);
  const strokeStartTimeRef = useRef<number>(0);
  const lastSendTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    getCanvasState: () => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (canvas && context) {
        return context.getImageData(0, 0, canvas.width, canvas.height);
      }
      return null;
    },
    getCurrentStroke: () => {
      if (currentStrokeRef.current.length > 0) {
        return {
          points: [...currentStrokeRef.current],
          color,
          brushSize,
          timestamp: strokeStartTimeRef.current
        };
      }
      return null;
    },
    clearCanvas: () => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (canvas && context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }));

  // ResizeObserver + HiDPI optimization
  const resizeToContainer = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const container = containerRef.current;
    if (!canvas || !ctx || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    
    if (canvas.width !== w || canvas.height !== h) {
      // Preservar contenido anterior
      const prevCanvas = document.createElement("canvas");
      prevCanvas.width = canvas.width;
      prevCanvas.height = canvas.height;
      if (canvas.width && canvas.height) {
        const prevCtx = prevCanvas.getContext("2d")!;
        prevCtx.drawImage(canvas, 0, 0);
      }

      // Actualizar dimensiones del canvas
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      // Configurar contexto con DPR
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = isEraser ? "rgba(0,0,0,1)" : color;
      ctx.lineWidth = brushSize;
      ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";

      // Restaurar contenido anterior
      if (prevCanvas.width && prevCanvas.height) {
        ctx.drawImage(prevCanvas, 0, 0, prevCanvas.width, prevCanvas.height, 0, 0, w, h);
      }
    }
  }, [color, brushSize, isEraser]);

  // Inicializar canvas y ResizeObserver
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    contextRef.current = ctx;
    resizeToContainer();
    
    // ResizeObserver para cambios de tamaño
    const resizeObserver = new ResizeObserver(resizeToContainer);
    resizeObserver.observe(container);
    
    return () => {
      resizeObserver.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [resizeToContainer]);

  // Actualizar propiedades del contexto cuando cambien
  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx) return;
    
    ctx.strokeStyle = isEraser ? "rgba(0,0,0,1)" : color;
    ctx.lineWidth = brushSize;
    ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
  }, [color, brushSize, isEraser]);

  // Restaurar estado del canvas
  useEffect(() => {
    const context = contextRef.current;
    const canvas = canvasRef.current;
    if (context && canvas && canvasStateToRestore) {
      context.putImageData(canvasStateToRestore, 0, 0);
    }
  }, [canvasStateToRestore]);

  // Obtener posición del pointer event (unificado para mouse/touch/pen)
  const getPointerPosition = useCallback((e: PointerEvent | React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { 
      x: e.clientX - rect.left, 
      y: e.clientY - rect.top 
    };
  }, []);

  // Iniciar dibujo
  const startDrawing = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Capturar el pointer para eventos posteriores
    canvas.setPointerCapture(e.pointerId);
    
    const pos = getPointerPosition(e);
    if (!pos) return;
    
    isDrawingRef.current = true;
    lastPositionRef.current = pos;
    currentStrokeRef.current = [pos];
    strokeStartTimeRef.current = Date.now();
    lastSendTimeRef.current = Date.now();
  }, [getPointerPosition]);

  // Dibujar con throttling inteligente
  const draw = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    
    const pos = getPointerPosition(e);
    if (!pos || !lastPositionRef.current) return;
    
    const context = contextRef.current;
    if (context) {
      context.beginPath();
      context.moveTo(lastPositionRef.current.x, lastPositionRef.current.y);
      context.lineTo(pos.x, pos.y);
      context.stroke();
    }
    
    // Agregar punto al trazo actual
    currentStrokeRef.current.push(pos);
    
    // RAF on-demand + throttling inteligente
    const now = performance.now();
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        
        // Enviar datos si ha pasado suficiente tiempo y no excede el límite
        if (now - lastSendTimeRef.current >= config.sendFrequency && 
            currentStrokeRef.current.length < config.maxPointsPerStroke) {
          
          const partialStroke: StrokeData = {
            points: [...currentStrokeRef.current],
            color,
            brushSize,
            timestamp: strokeStartTimeRef.current
          };
          onStrokeComplete(partialStroke);
          lastSendTimeRef.current = now;
        }

        // Enviar frame rasterizado para TouchDesigner (fallback si no hay Pillow)
        if (typeof onFrame === 'function' && canvasRef.current) {
          const minInterval = 1000 / (config.rasterFps || 8);
          if (now - lastFrameTimeRef.current >= minInterval) {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            onFrame(dataUrl);
            lastFrameTimeRef.current = now;
          }
        }
      });
    }
    
    lastPositionRef.current = pos;
  }, [getPointerPosition, color, brushSize, config.sendFrequency, config.maxPointsPerStroke, onStrokeComplete]);

  // Finalizar dibujo
  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;
    
    isDrawingRef.current = false;
    
    // Enviar trazo completo si tiene puntos
    if (currentStrokeRef.current.length > 0) {
      const completeStroke: StrokeData = {
        points: [...currentStrokeRef.current],
        color,
        brushSize,
        timestamp: strokeStartTimeRef.current
      };
      onStrokeComplete(completeStroke);
    }
    
    lastPositionRef.current = null;
    currentStrokeRef.current = [];
    onStrokeEnd();
  }, [onStrokeEnd, color, brushSize, onStrokeComplete]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas
        ref={canvasRef}
        className="block touch-none select-none"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={stopDrawing}
      />
    </div>
  );
});