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
const wss = new WebSocketServer({ server, path: "/ws", perMessageDeflate: false });

let nextId = 1;

wss.on("connection", (ws, req) => {
  ws.id = nextId++;
  const ip = req.socket.remoteAddress;
  console.log(`WS #${ws.id} connected from ${ip}`);

  try { ws.send(JSON.stringify({ type: "welcome", payload: Date.now() })); } catch {}

  ws.on("message", (data, isBinary) => {
    // reenvía a todos menos al emisor
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) client.send(data, { binary: isBinary });
    });
  });

  ws.on("close", () => console.log(`WS #${ws.id} closed`));
  ws.on("error", (e) => console.warn(`WS #${ws.id} error:`, e?.message));
});

app.get("*", (_req, res) => res.sendFile(path.join(DIST_DIR, "index.html")));
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP on :${PORT}`);
  console.log(`WS    on :${PORT}/ws`);
});
