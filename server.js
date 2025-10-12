// server.js
const path = require("path");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const DIST_DIR = path.resolve(__dirname, "dist");

const app = express();
app.disable("x-powered-by");
app.use(express.static(DIST_DIR, { fallthrough: true }));

// healthcheck simple
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// HTTP + WS
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws", perMessageDeflate: false });

// ---- ROOMS ----
/** Map<roomId, Set<WebSocket>> */
const rooms = new Map();

/** Sanitiza room y role para evitar rarezas en logs/keys */
function sanitize(str, def, max = 64) {
  str = (str || def || "").toString().slice(0, max);
  // A–Z a–z 0–9 _ - (evita espacios y URL garbage)
  return str.replace(/[^A-Za-z0-9_-]/g, "") || def;
}

wss.on("connection", (ws, req) => {
  // Ejemplo de URL:
  //   /ws?room=PC_A&role=td
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const room = sanitize(url.searchParams.get("room"), "default");
  const role = sanitize(url.searchParams.get("role"), "client", 16); // 'canvas' | 'td' | 'client'

  ws._room = room;
  ws._role = role;

  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);

  console.log(`WS connected -> room="${room}" role="${role}" (room size: ${rooms.get(room).size})`);

  // Mensaje de bienvenida (útil para debug)
  try {
    ws.send(JSON.stringify({ type: "welcome", payload: Date.now(), room, role }));
  } catch {}

  ws.on("message", (data, isBinary) => {
    // Reenvío SOLO dentro de la misma room.
    const peers = rooms.get(ws._room);
    if (!peers) return;

    // Enrutado dirigido por rol (evita eco entre canvases, etc.)
    // - Si emite 'canvas' -> entrega a 'td'
    // - Si emite 'td'     -> entrega a 'canvas'
    // - Otros roles       -> entrega a todos menos al emisor
    const fromRole = ws._role;

    for (const client of peers) {
      if (client === ws || client.readyState !== 1) continue;

      if (fromRole === "canvas" && client._role === "td") {
        client.send(data, { binary: isBinary });
      } else if (fromRole === "td" && client._role === "canvas") {
        client.send(data, { binary: isBinary });
      } else if (fromRole !== "canvas" && fromRole !== "td") {
        client.send(data, { binary: isBinary });
      }
    }
  });

  ws.on("close", () => {
    const set = rooms.get(ws._room);
    if (set) {
      set.delete(ws);
      if (set.size === 0) rooms.delete(ws._room);
    }
    console.log(`WS closed    -> room="${ws._room}" role="${ws._role}"`);
  });

  ws.on("error", (e) => console.warn("WS error:", e?.message));
});

// SPA fallback
app.get("*", (_req, res) => res.sendFile(path.join(DIST_DIR, "index.html")));

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP on :${PORT}`);
  console.log(`WS   on :${PORT}/ws?room=<ID>&role=<canvas|td>`);
});
