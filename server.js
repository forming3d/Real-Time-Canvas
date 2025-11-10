const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

// sirve el build de Vite
app.use(express.static(path.join(__dirname, 'dist')));

// WS en /ws
const wss = new WebSocket.Server({ server, path: '/ws' });

// room -> Set<ws>
const rooms = new Map();

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
  const url = new URL(req.url, `http://${req.headers.host}`);
  const room = (url.searchParams.get('room') || 'DEFAULT').toUpperCase();
  joinRoom(ws, room);

  // saludo
  try { ws.send(JSON.stringify({ type: 'hello', payload: { room } })); } catch { }

  // reenvía a OTROS clientes de la sala (texto o binario)
  ws.on('message', (data, isBinary) => {
    const set = rooms.get(room);
    if (!set) return;
    for (const client of set) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    }
  });

  ws.on('close', () => leaveRoom(ws));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`HTTP+WS on :${PORT} (path /ws)`));
