import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = process.env.PORT || 3000;

// rooms: Set de sockets por room
const rooms = new Map(); // Map<string, Set<WebSocket>>

function getSearchParams(req) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams;
  } catch {
    return new URLSearchParams();
  }
}

wss.on("connection", (ws, request) => {
  const sp = getSearchParams(request);
  const room = sp.get("room") || "room-default";
  const role = sp.get("role") || "canvas";

  if (!rooms.has(room)) rooms.set(room, new Set());
  const set = rooms.get(room);
  set.add(ws);

  ws.on("message", (data) => {
    // Broadcast a los de la misma sala
    for (const client of set) {
      if (client !== ws && client.readyState === 1) {
        client.send(data);
      }
    }
  });

  ws.on("close", () => {
    set.delete(ws);
    if (set.size === 0) rooms.delete(room);
  });

  // Mensaje de bienvenida opcional
  ws.send(JSON.stringify({ t: "hello", room, role }));
});

// Upgrade HTTP->WS
server.on("upgrade", (req, socket, head) => {
  // Deja pasar todas las rutas (Render suele hacer proxy en el root)
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

// Static de producción (Vite build)
app.use(express.static(path.join(__dirname, "dist")));

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
