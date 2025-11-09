// server.js — sirve /dist y WebSocket con rooms + diagnóstico de build
const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
app.disable("x-powered-by");

const DIST_DIR = path.resolve(__dirname, "dist");

// ---- Diagnóstico de /dist al arrancar ----
try {
  const exists = fs.existsSync(DIST_DIR);
  console.log("[DIST] path =", DIST_DIR, "exists =", exists);
  if (exists) {
    const files = fs.readdirSync(DIST_DIR);
    console.log("[DIST] files =", files);
  }
} catch (e) {
  console.log("[DIST] error reading dist:", e);
}

// Endpoint de diagnóstico
app.get("/__diag", (_req, res) => {
  try {
    const exists = fs.existsSync(DIST_DIR);
    const files = exists ? fs.readdirSync(DIST_DIR) : [];
    res.json({ distDir: DIST_DIR, exists, files });
  } catch (e) {
    res.json({ distDir: DIST_DIR, error: String(e) });
  }
});

// Salud
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// Archivos estáticos de la build
app.use(express.static(DIST_DIR, { fallthrough: true }));

// Fallback SPA
app.get("*", (_req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

const server = http.createServer(app);

// ---------------- WS con rooms ----------------
const wss = new WebSocketServer({
  server,
  perMessageDeflate: false, // PNG ya va comprimido
});

const rooms = new Map(); // roomId -> Set<ws>

function sanitizeRoom(r) {
  if (typeof r !== "string") return null;
  r = r.trim();
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(r)) return null;
  return r;
}

function joinRoom(ws, roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add(ws);
}

function leaveRoom(ws) {
  const room = ws.room;
  if (!room) return;
  const set = rooms.get(room);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(room);
  }
}

function broadcast(roomId, data, isBinary) {
  const set = rooms.get(roomId);
  if (!set) return;
  for (const client of set) {
    if (client.readyState === client.OPEN) {
      // Backpressure básico: si hay mucha cola, salta este envío
      if (client.bufferedAmount > 512 * 1024) continue;
      client.send(data, { binary: isBinary });
    }
  }
}

wss.on("connection", (ws, req) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let room = sanitizeRoom(url.searchParams.get("room"));
    if (!room) {
      room = Math.random().toString(36).slice(2, 8).toUpperCase();
    }
    ws.room = room;
    joinRoom(ws, room);

    ws.isAlive = true;
    ws.on("pong", () => (ws.isAlive = true));

    ws.on("message", (data, isBinary) => {
      const len = isBinary ? (data.byteLength || data.length) : Buffer.byteLength(data);
      if (!isBinary && len > 1_000_000) return; // 1 MB texto
      if (isBinary && len > 2_000_000) return;  // 2 MB binario
      broadcast(ws.room, data, isBinary);
    });

    ws.on("close", () => leaveRoom(ws));
    ws.on("error", () => leaveRoom(ws));

    ws.send(JSON.stringify({ type: "hello", payload: { room } }));
  } catch {
    try { ws.close(); } catch { }
  }
});

// Heartbeat
const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      leaveRoom(ws);
    } else {
      ws.isAlive = false;
      ws.ping();
    }
  }
}, 30000);

wss.on("close", () => clearInterval(interval));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP+WS on http://0.0.0.0:${PORT}`);
});
