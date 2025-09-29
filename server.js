const path = require("path");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);

// WS en /ws
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "welcome", ts: Date.now() })); // TD lo ve al instante

  ws.on("message", (msg) => {
    for (const c of wss.clients) {
      if (c.readyState === ws.OPEN) c.send(msg.toString()); // eco a TODOS
    }
  });
});

// servir Vite compilado
const dist = path.join(__dirname, "dist");
console.log("Serving static from:", dist);
app.use(express.static(dist));

// healthcheck (para Render)
app.get("/healthz", (_, res) => res.send("ok"));

// SPA fallback
app.get("*", (_, res) => res.sendFile(path.join(dist, "index.html")));

const PORT = process.env.PORT || 443;
server.listen(PORT, "0.0.0.0", () => console.log("listening", PORT));
