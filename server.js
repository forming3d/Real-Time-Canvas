const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

// Static (dist) si usas build de Vite
app.use(express.static(path.join(__dirname, 'dist')));

// WS en /ws
const wss = new WebSocket.Server({ server, path: '/ws' });

// Mapa de salas
const rooms = new Map(); // room -> Set<ws>

function joinRoom(ws, room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  ws._room = room;
}

function leaveRoom(ws) {
  const r = ws._room;
  if (!r) return;
  const set = rooms.get(r);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(r);
  }
  ws._room = undefined;
}

wss.on('connection', (ws, req) => {
  // ?room=XXXX
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = (url.searchParams.get('room') || 'DEFAULT').toUpperCase();
  joinRoom(ws, room);

  // hello
  try {
    ws.send(JSON.stringify({ type: 'hello', payload: { room } }));
  } catch { }

  ws.on('message', (data, isBinary) => {
    const set = rooms.get(room);
    if (!set) return;

    // reenvía tal cual a los demás de la sala
    for (const client of set) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    }
  });

  ws.on('close', () => leaveRoom(ws));
});

// puerto (Render usa PORT)
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`HTTP+WS server listening on ${PORT} (path /ws)`);
});
