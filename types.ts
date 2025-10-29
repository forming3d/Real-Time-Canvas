export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

export type StrokePoint = { x: number; y: number; p: number };
export type Stroke = {
  id: string;
  color: string;
  size: number;
  points: StrokePoint[];
  mode: 'brush' | 'eraser';
};

export type CanvasMessage =
  | { type: 'stroke'; payload: Stroke }
  | { type: 'canvas'; payload: string } // dataURL
  | { type: 'prompt'; payload: string };
