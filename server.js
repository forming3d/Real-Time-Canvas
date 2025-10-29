import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(compression());

// sirve estáticos de Vite
app.use(express.static(path.join(__dirname, 'dist')));

// fallback SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// rooms por query ?room=xxx
function getRoom(url) {
  try {
    const u = new URL(url, 'http://localhost');
    return u.searchParams.get('room') || 'default';
  } catch {
    return 'default';
  }
}

const rooms = new Map(); // room -> Set<ws>

wss.on('connection', (ws, req) => {
  const room = getRoom(req.url);
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);

  ws.on('message', (data) => {
    // broadcast a la misma sala
    for (const client of rooms.get(room)) {
      if (client !== ws && client.readyState === 1) {
        client.send(data);
      }
    }
  });

  ws.on('close', () => {
    const set = rooms.get(room);
    if (set) {
      set.delete(ws);
      if (set.size === 0) rooms.delete(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP on :${PORT}  WS on /ws`);
});
