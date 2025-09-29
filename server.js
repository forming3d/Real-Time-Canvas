const path = require("path");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);

// WebSocket en /ws
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  ws.send("connected");
  ws.on("message", (msg) => {
    for (const c of wss.clients) {
      if (c !== ws && c.readyState === ws.OPEN) c.send(msg.toString());
    }
  });
});

// servir Vite compilado (dist/)
const dist = path.join(__dirname, "dist");
app.use(express.static(dist));
app.get("/healthz", (_, res) => res.send("ok"));
// SPA fallback
app.get("*", (_, res) => res.sendFile(path.join(dist, "index.html")));

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log("listening", PORT));
