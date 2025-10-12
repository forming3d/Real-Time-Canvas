const path = require("path");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const DIST_DIR = path.resolve(__dirname, "dist");

const app = express();
app.disable("x-powered-by");

// sirve los estáticos del build de Vite
app.use(express.static(DIST_DIR, { fallthrough: true }));

// healthcheck simple para Render
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// crea HTTP server y WebSocket server en /ws
const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  path: "/ws",
  perMessageDeflate: false, // menor latencia
});

// logs básicos + eco opcional
wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log("WS connection:", ip);
  try {
    ws.send(JSON.stringify({ type: "welcome", payload: Date.now() }));
  } catch {}

  ws.on("message", (data) => {
    // Aquí puedes inspeccionar/filtrar/broadcast
    // Broadcast opcional (comenta si no quieres reenviar a todos):
    // for (const client of wss.clients) {
    //   if (client !== ws && client.readyState === 1) client.send(data);
    // }
  });

  ws.on("close", () => console.log("WS closed:", ip));
  ws.on("error", (e) => console.warn("WS error:", e?.message));
});

// fallback SPA: sirve index.html para cualquier ruta
app.get("*", (_req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP on :${PORT}`);
  console.log(`WS    on :${PORT}/ws`);
});

