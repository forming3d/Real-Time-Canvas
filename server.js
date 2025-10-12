const path = require("path");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const DIST_DIR = path.resolve(__dirname, "dist");

const app = express();
app.disable("x-powered-by");
app.use(express.static(DIST_DIR, { fallthrough: true }));
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

const server = http.createServer(app);

// ---------- WS HUB con broadcast y keep-alive ----------
const wss = new WebSocketServer({
  server,
  path: "/ws",
  perMessageDeflate: false,
});

let nextId = 1;

// ping/pong para limpiar conexiones muertas
function heartbeat() { this.isAlive = true; }
const KA_INTERVAL = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  });
}, 30000);
wss.on("close", () => clearInterval(KA_INTERVAL));

wss.on("connection", (ws, req) => {
  ws.id = nextId++;
  ws.isAlive = true;
  ws.on("pong", heartbeat);

  const ua = req.headers["user-agent"] || "";
  const ip = req.socket.remoteAddress;
  console.log(`WS #${ws.id} connected from ${ip} ${ua.includes("TouchDesigner") ? "(TD)" : ""}`);

  // envía un welcome
  try { ws.send(JSON.stringify({ type: "welcome", payload: Date.now() })); } catch {}

  ws.on("message", (data, isBinary) => {
    const text = isBinary ? data : data.toString();
    // Log útil: tipo + tamaño
    try {
      const m = JSON.parse(text);
      console.log(`WS #${ws.id} -> ${m.type}  (${text.length} bytes)`);
    } catch {
      console.log(`WS #${ws.id} -> text (${text.length} bytes)`);
    }

    // *** BROADCAST: reenvía a TODOS menos al emisor ***
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(text, { binary: isBinary });
      }
    });
  });

  ws.on("close", () => console.log(`WS #${ws.id} closed`));
  ws.on("error", (e) => console.warn(`WS #${ws.id} error:`, e?.message));
});

// SPA fallback
app.get("*", (_req, res) => res.sendFile(path.join(DIST_DIR, "index.html")));

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP on :${PORT}`);
  console.log(`WS    on :${PORT}/ws`);
});
