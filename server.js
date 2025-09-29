const { WebSocketServer } = require('ws');
const http = require('http');

// Create a simple HTTP server. Render needs this to perform health checks.
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running');
});

// Create a WebSocket server and attach it to the HTTP server.
const wss = new WebSocketServer({ server });

console.log('WebSocket server started...');

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    // When a message is received, broadcast it to all other clients.
    wss.clients.forEach((client) => {
      // Check if the client is not the sender and is ready to receive messages.
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(message.toString());
      }
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start the HTTP server. Render will provide the PORT environment variable.
const PORT = process.env.PORT || 9980;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
