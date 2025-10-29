// server.js
// Node + Express + WS con rooms + asignación de salas + hardening y heartbeat
const path = require("path");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const helmet = require("helmet");
const compression = require("compression");
// const cors = require("cors"); // <- Solo si sirves UI desde otro origen

// --- Static SPA ---
const DIST_DIR = path.resolve(__dirname, "dist");
const app = express();

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false })); // Import maps/CDNs -> CSP off
app.use(compression());
// app.use(cors({ origin: ["https://TU_DOMINIO"], methods: ["GET","POST"] })); // si aplica

app.use(express.static(DIST_DIR, { fallthrough: true }));

// Healthcheck simple
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ---------- HTTP Server + WS ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

/** Map<roomId, Set<WebSocket>> */
const rooms = new Map();

/** sanitiza (solo A–Z a–z 0–9 _ -) */
function sanitize(str, def = "", max = 64) {
  str = (str || def || "").toString().slice(0, max);
  return str.replace(/[^A-Za-z0-9_-]/g, "") || def;
}

// --- Heartbeat WS ---
function heartbeat() { this.isAlive = true; }
const HEARTBEAT_INTERVAL_MS = 30_000;
const hbInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  });
}, HEARTBEAT_INTERVAL_MS);
wss.on("close", () => clearInterval(hbInterval));

wss.on("connection", (ws, req) => {
  // /ws?room=<id>&role=<canvas|td>
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const room = sanitize(url.searchParams.get("room"), "default");
  const role = sanitize(url.searchParams.get("role"), "client", 16);

  ws.isAlive = true;
  ws.on("pong", heartbeat);

  ws._room = room;
  ws._role = role;

  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);

  console.log(`WS connected -> room="${room}" role="${role}" (size:${rooms.get(room).size})`);
  try { ws.send(JSON.stringify({ type: "welcome", payload: Date.now(), room, role })); } catch {}

  ws.on("message", (data, isBinary) => {
    const set = rooms.get(ws._room);
    if (!set) return;

    // Enrutado dirigido por rol:
    // - canvas -> td
    // - td -> canvas
    // - si no hay roles, broadcast a todos menos remitente
    for (const peer of set) {
      if (peer === ws) continue;
      if (ws._role === "canvas" && peer._role !== "td") continue;
      if (ws._role === "td" && peer._role !== "canvas") continue;

      try { peer.send(data, { binary: isBinary }); } catch {}
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

// ---------- Helpers de URL/scheme tras proxy (Render) ----------
function originFromReq(req) {
  const proto = (req.headers["x-forwarded-proto"] || "").split(",")[0] || "http";
  const host = req.headers.host;
  return `${proto}://${host}`;
}
function wsSchemeFromReq(req) {
  const proto = (req.headers["x-forwarded-proto"] || "").split(",")[0] || "http";
  return proto === "https" ? "wss" : "ws";
}

// Generadores de room
const ABC = "abcdefghijklmnopqrstuvwxyz";
function nextAlphaFreeRoom() {
  // "a".."z", luego "aa".."zz", luego "aaa".."zzz"
  for (let len = 1; len <= 3; len++) {
    const recur = function* (prefix, depth) {
      if (depth === 0) { yield prefix; return; }
      for (const ch of ABC) yield* recur(prefix + ch, depth - 1);
    };
    for (const id of recur("", len)) {
      if (!rooms.has(id)) return id;
    }
  }
  // fallback
  return Math.random().toString(36).slice(2, 8);
}

// ---------- API de asignación de salas ----------
app.get("/api/new-room", (req, res) => {
  res.set("Cache-Control", "no-store");
  const id = nextAlphaFreeRoom();
  const origin = originFromReq(req);
  const wsScheme = wsSchemeFromReq(req);
  const canvasUrl = `${origin}/?room=${id}`;
  const wsUrlForTd = `${wsScheme}://${req.headers.host}/ws?room=${id}&role=td`;
  res.json({ id, canvasUrl, wsUrlForTd });
});

/**
 * GET /new-canvas
 * Página intermedia que pide /api/new-room y muestra:
 *  - Link Canvas (se puede autoabrir)
 *  - URL WS para TouchDesigner con botón "Copiar"
 *  (Evita innerHTML con user input: usamos textContent en nodos)
 */
app.get("/new-canvas", (req, res) => {
  res.set("Cache-Control", "no-store");
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Asignar sala – Real-Time Canvas</title>
<style>
  body{margin:0;background:#0f172a;color:#e2e8f0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}
  .box{max-width:760px;margin:40px auto;padding:24px;border:1px solid #1e293b;border-radius:12px;background:#0b1220}
  h1{margin:0 0 6px;font-size:20px}
  .muted{opacity:.75;font-size:13px;margin:0 0 16px}
  .row{display:flex;gap:10px;align-items:center;margin:10px 0}
  input[type=text]{flex:1;padding:10px 12px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0}
  button{padding:10px 12px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;cursor:pointer}
  .primary{border:0;background:#a855f7;color:#fff}
  code{background:#111827;border:1px solid #222;padding:2px 6px;border-radius:6px}
</style>
</head>
<body>
  <div class="box">
    <h1>Crear una sala</h1>
    <p class="muted">Genera un link de Canvas y la URL de WebSocket para TouchDesigner.</p>

    <div class="row"><button id="btnNew" class="primary">Crear sala</button></div>

    <div id="result" style="display:none">
      <div class="row">
        <span>Canvas:</span>
        <a id="aCanvas" href="#" target="_blank" rel="noopener">abrir canvas</a>
      </div>
      <div class="row">
        <span>WS TD:</span>
        <input type="text" id="wsTd" readonly />
        <button id="copy">Copiar</button>
      </div>
    </div>
  </div>
<script>
const $ = (q) => document.querySelector(q);
$("#btnNew").addEventListener("click", async () => {
  const r = await fetch("/api/new-room").then(r => r.json());
  $("#aCanvas").setAttribute("href", r.canvasUrl);
  $("#aCanvas").textContent = r.canvasUrl;
  $("#wsTd").value = r.wsUrlForTd;
  $("#result").style.display = "";
});
$("#copy").addEventListener("click", async () => {
  const el = $("#wsTd");
  el.select(); el.setSelectionRange(0, 99999);
  try { await navigator.clipboard.writeText(el.value); } catch {}
});
</script>
</body>
</html>`;
  res.type("html").send(html);
});

// ---------- SPA fallback (debe ir al final) ----------
app.get("*", (_req, res) => res.sendFile(path.join(DIST_DIR, "index.html")));

// ---------- Arranque ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP on :${PORT}`);
  console.log(`WS   on :${PORT}/ws?room=<ID>&role=<canvas|td>`);
  console.log(`API  /api/new-room  | Page /new-canvas`);
});
