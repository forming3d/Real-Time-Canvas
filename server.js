const path = require("path");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);

// WS en /ws
const wss = new WebSocketServer({ 
  server, 
  path: "/ws",
  perMessageDeflate: false // Mejor para TouchDesigner
});

// Estadísticas de conexión
let connectedClients = 0;
let totalMessages = 0;

wss.on("connection", (ws, req) => {
  connectedClients++;
  const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
  console.log(`TouchDesigner client connected: ${clientId} (${connectedClients} total)`);

  // Enviar mensaje de bienvenida optimizado para TouchDesigner
  ws.send(JSON.stringify({ 
    type: "welcome", 
    timestamp: Date.now(),
    clientId,
    protocol: "touchdesigner-v1"
  }));

  ws.on("message", (msg) => {
    try {
      totalMessages++;
      const message = JSON.parse(msg.toString());
      
      // Validar estructura del mensaje
      if (!message.type || !message.payload) {
        console.warn(`Invalid message format from ${clientId}:`, message);
        return;
      }

      // Log de mensajes para debugging (solo tipos específicos)
      if (message.type === 'stroke') {
        console.log(`Stroke data from ${clientId}: ${message.payload.points?.length || 0} points`);
      } else if (message.type === 'prompt') {
        console.log(`Prompt from ${clientId}: "${message.payload.prompt}"`);
      }

      // Broadcast optimizado - solo a clientes conectados
      const clientsToSend = [];
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN && client !== ws) {
          clientsToSend.push(client);
        }
      }

      // Enviar a TouchDesigner y otros clientes
      const messageToSend = JSON.stringify(message);
      clientsToSend.forEach(client => {
        try {
          client.send(messageToSend);
        } catch (error) {
          console.error(`Error sending to client:`, error);
        }
      });

      console.log(`Message broadcasted to ${clientsToSend.length} clients`);
      
    } catch (error) {
      console.error(`Error processing message from ${clientId}:`, error);
    }
  });

  ws.on("close", (code, reason) => {
    connectedClients--;
    console.log(`TouchDesigner client disconnected: ${clientId} (${connectedClients} total) - Code: ${code}, Reason: ${reason}`);
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
  });

  // Ping/Pong para mantener conexión viva
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000); // 30 segundos

  ws.on("pong", () => {
    // Cliente respondió al ping
  });
});

// Endpoint de estadísticas para monitoreo
app.get("/api/stats", (req, res) => {
  res.json({
    connectedClients,
    totalMessages,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now()
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

const PORT = process.env.PORT || 3000; // Cambiado de 443 a 3000 para desarrollo
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Real-Time Canvas Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`📊 Stats endpoint: http://localhost:${PORT}/api/stats`);
  console.log(`🎨 TouchDesigner ready for connections`);
});
