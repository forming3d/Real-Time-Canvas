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
  const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`.substring(0, 20);
  joinRoom(ws, room);
  ws._clientId = clientId;

  console.log(`✅ [${room}] Cliente ${clientId} conectado. Total: ${rooms.get(room)?.size}`);

  // saludo
  try { 
    ws.send(JSON.stringify({ type: 'hello', payload: { room } })); 
    console.log(`👋 [${room}] Saludo enviado a ${clientId}`);
  } catch(e) { 
    console.error(`❌ Error enviando saludo:`, e.message);
  }

  // reenvía a OTROS clientes de la sala (texto o binario)
  ws.on('message', (data, isBinary) => {
    const dataType = isBinary ? 'BINARIO' : 'TEXTO';
    const dataSize = data.length || data.byteLength || 0;
    const preview = !isBinary && dataSize < 200 ? data.toString().substring(0, 100) : '';
    
    console.log(`📥 [${room}] ${clientId} envió ${dataType} (${dataSize} bytes)${preview ? ': ' + preview : ''}`);
    
    const set = rooms.get(room);
    if (!set) {
      console.warn(`⚠️ [${room}] Sala no existe`);
      return;
    }
    
    let sent = 0;
    for (const client of set) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        try {
          client.send(data, { binary: isBinary });
          sent++;
        } catch(e) {
          console.error(`❌ Error enviando a cliente:`, e.message);
        }
      }
    }
    
    console.log(`📤 [${room}] Reenviado a ${sent} de ${set.size - 1} cliente(s)`);
  });

  ws.on('close', (code, reason) => {
    leaveRoom(ws);
    console.log(`🔌 [${room}] ${clientId} desconectado (código: ${code}). Quedan: ${rooms.get(room)?.size || 0}`);
  });

  ws.on('error', (err) => {
    console.error(`❌ [${room}] ${clientId} error:`, err.message);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`HTTP+WS on :${PORT} (path /ws)`));
