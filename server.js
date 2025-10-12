// server.js
// Node + Express + WS con rooms + asignación de salas
const path = require("path");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

// --- Static SPA ---
const DIST_DIR = path.resolve(__dirname, "dist");
const app = express();
app.disable("x-powered-by");
app.use(express.static(DIST_DIR, { fallthrough: true }));

// Healthcheck simple
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// --- HTTP + WebSocket ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws", perMessageDeflate: false });

// ---- ROOMS (aislamiento) ----
/** Map<roomId, Set<WebSocket>> */
const rooms = new Map();

/** sanitiza (solo A–Z a–z 0–9 _ -) */
function sanitize(str, def = "", max = 64) {
  str = (str || def || "").toString().slice(0, max);
  return str.replace(/[^A-Za-z0-9_-]/g, "") || def;
}

wss.on("connection", (ws, req) => {
  // /ws?room=<id>&role=<canvas|td>
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const room = sanitize(url.searchParams.get("room"), "default");
  const role = sanitize(url.searchParams.get("role"), "client", 16);

  ws._room = room;
  ws._role = role;

  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);

  console.log(`WS connected -> room="${room}" role="${role}" (size:${rooms.get(room).size})`);
  try { ws.send(JSON.stringify({ type: "welcome", payload: Date.now(), room, role })); } catch {}

  ws.on("message", (data, isBinary) => {
    const peers = rooms.get(ws._room);
    if (!peers) return;

    // Enrutado dirigido por rol:
    // - canvas -> td
    // - td     -> canvas
    // - otros  -> todos menos emisor
    for (const client of peers) {
      if (client === ws || client.readyState !== 1) continue;
      if (ws._role === "canvas" && client._role === "td") {
        client.send(data, { binary: isBinary });
      } else if (ws._role === "td" && client._role === "canvas") {
        client.send(data, { binary: isBinary });
      } else if (ws._role !== "canvas" && ws._role !== "td") {
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

// ---------- API de asignación de salas ----------

// Helpers de URL/scheme tras proxy (Render)
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
      if (depth === len) { yield prefix; return; }
      for (const ch of ABC) yield* recur(prefix + ch, depth + 1);
    };
    for (const cand of recur("", 0)) {
      if (!rooms.has(cand)) return cand;
    }
  }
  return null;
}
function randomRoom(len = 6) {
  let s = "";
  while (s.length < len) s += Math.random().toString(36).slice(2);
  return s.slice(0, len);
}

/**
 * GET /api/new-room
 * Devuelve una sala libre + URLs listas.
 *   ?strategy=alpha|random (por defecto alpha)
 *   ?target=canvas|td|both  (informativo)
 */
app.get("/api/new-room", (req, res) => {
  res.set("Cache-Control", "no-store");
  const strategy = (req.query.strategy || "alpha").toString();

  let room = strategy === "random" ? null : nextAlphaFreeRoom();
  if (!room) {
    // fallback: aleatoria que no exista en rooms
    do { room = randomRoom(6); } while (rooms.has(room));
  }

  const origin = originFromReq(req);
  const wsScheme = wsSchemeFromReq(req);

  const canvasUrl = `${origin}/?room=${encodeURIComponent(room)}`;
  const tdUrl = `${wsScheme}://${req.headers.host}/ws?room=${encodeURIComponent(room)}&role=td`;

  res.json({ room, canvasUrl, tdUrl });
});

// ---------- Paso 3 (opcional): páginas helper ----------

/**
 * GET /open-canvas
 * Asigna sala y redirige (302) directo al Canvas.
 * Útil si quieres que el botón "Abrir" no necesite JS.
 */
app.get("/open-canvas", (req, res) => {
  res.set("Cache-Control", "no-store");
  const room = nextAlphaFreeRoom() || randomRoom(6);
  const origin = originFromReq(req);
  res.redirect(302, `${origin}/?room=${encodeURIComponent(room)}`);
});

/**
 * GET /new-canvas
 * Página intermedia que pide /api/new-room y muestra:
 *  - Link Canvas (se puede autoabrir)
 *  - URL WS para TouchDesigner con botón "Copiar"
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
  .ok{color:#22c55e}
  code{background:#111827;border:1px solid #222;padding:2px 6px;border-radius:6px}
</style>
</head>
<body>
  <div class="box">
    <h1>Asignar sala para Canvas</h1>
    <p class="muted">Esta página reserva una <strong>sala</strong> y te da dos enlaces: Canvas y WebSocket para TouchDesigner.</p>
    <div id="status">Creando sala…</div>

    <div id="content" style="display:none">
      <div class="row"><strong>Sala:</strong><code id="room"></code></div>
      <div class="row">
        <input id="canvasUrl" type="text" readonly />
        <button class="primary" id="openCanvas">Abrir Canvas</button>
      </div>
      <div class="row">
        <input id="tdUrl" type="text" readonly />
        <button id="copyTd">Copiar TD URL</button>
      </div>
    </div>
  </div>
<script>
(async function(){
  try{
    const r = await fetch('/api/new-room?strategy=alpha', {cache:'no-store'}).then(x=>x.json());
    if(!r || !r.room){ throw new Error('No room'); }
    document.getElementById('status').innerHTML = '<span class="ok">Sala creada.</span>';
    document.getElementById('content').style.display = 'block';
    document.getElementById('room').textContent = r.room;
    document.getElementById('canvasUrl').value = r.canvasUrl;
    document.getElementById('tdUrl').value = r.tdUrl;

    document.getElementById('openCanvas').onclick = ()=>{ location.href = r.canvasUrl; };
    document.getElementById('copyTd').onclick = async ()=>{
      try{
        await navigator.clipboard.writeText(r.tdUrl);
        document.getElementById('copyTd').textContent = 'Copiado ✓';
        setTimeout(()=>document.getElementById('copyTd').textContent='Copiar TD URL', 1200);
      }catch(e){}
    };
  }catch(e){
    document.getElementById('status').textContent = 'Error creando sala. Recarga.';
  }
})();
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
  console.log(`API  /api/new-room  | Page /new-canvas | 302 /open-canvas`);
});
