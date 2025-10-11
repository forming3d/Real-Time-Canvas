export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface Point {
  x: number;
  y: number;
}

export interface StrokeData {
  points: Point[];
  color: string;
  brushSize: number;
  timestamp: number;
}

export interface TouchDesignerMessage {
  type: 'stroke' | 'prompt' | 'canvas' | 'welcome' | 'draw';
  payload: any; // Puede ser string (draw/prompt), objeto (stroke/canvas), etc.
}

export interface TouchDesignerConfig {
  sendMode: 'vector' | 'raster' | 'hybrid';
  compressionLevel: number;
  maxPointsPerStroke: number;
  sendFrequency: number;
  enableReconnection: boolean;
  maxReconnectAttempts: number;
}