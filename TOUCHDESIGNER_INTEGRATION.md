# Integración con TouchDesigner

Este documento resume la configuración recomendada para recibir el canvas en un proyecto TouchDesigner y refrescar un `Movie File In TOP` sin saturar la GPU.

## Topología mínima
1. **WebSocket DAT** (`Active = On`, `Callbacks DAT = websocket1_callbacks.py`).
2. **Movie File In TOP** llamado `canvas_in` (o deja que el script busque el primero disponible).
3. Opcional: un **Text TOP/DAT** llamado `prompt` para mostrar los prompts enviados desde la app.

El WebSocket debe apuntar a `ws://HOST:PUERTO?room=XXXXXX` (o `wss://` en producción). Puedes reutilizar el código de sala que muestra la interfaz web.

## Script de callbacks (`websocket1_callbacks.py`)
```python
# websocket1_callbacks.py — prioridad PNG final + idle sin recargas
# - EN VIVO:  {"type":"draw","payload":"data:image/jpeg;base64,..."} (JPEG)
# - FINAL :   frame binario PNG (onReceiveBinary) -> fuerza recarga y BLOQUEA JPEG
# - PROMPT:   {"type":"proc","payload":"texto"}
# - ESTADO:   {"type":"state","payload":"drawing:start|drawing:end"}

import json, os, tempfile, base64, time, hashlib

# ---------- paths ----------
def _writable_dir(path):
    try:
        os.makedirs(path, exist_ok=True)
        test_path = os.path.join(path, '.td_write_test')
        with open(test_path, 'wb') as f: f.write(b'1')
        os.remove(test_path); return True
    except Exception as e:
        print('PATH not writable:', path, e); return False

def _ensure_targets():
    targets = []
    proj = project.folder or ''
    inbox_dir = os.path.join(proj, 'inbox') if proj else ''
    if inbox_dir and _writable_dir(inbox_dir): targets.append(os.path.join(inbox_dir, 'canvas'))
    docs = os.path.join(os.path.expanduser('~'), 'Documents', 'Real-Time-Canvas')
    if _writable_dir(docs): targets.append(os.path.join(docs, 'canvas'))
    tmp_dir = os.path.join(tempfile.gettempdir(), 'Real-Time-Canvas')
    if _writable_dir(tmp_dir): targets.append(os.path.join(tmp_dir, 'canvas'))
    print('destinos base =', targets)
    return targets

TARGETS_BASE = _ensure_targets()

def _write_atomic(target_path, data_bytes):
    tmp_path = target_path + '.tmp'
    with open(tmp_path, 'wb') as f:
        f.write(data_bytes); f.flush(); os.fsync(f.fileno())
    os.replace(tmp_path, target_path); return target_path

# ---------- Movie File In cache ----------
_MOVIE_CACHE = None
def _is_moviefilein(o):
    try:
        ty = getattr(o, 'OPType', '') or str(getattr(o, 'type', ''))
        return 'moviefilein' in str(ty).lower()
    except Exception: return False

def _find_movie_in():
    global _MOVIE_CACHE
    try:
        if _MOVIE_CACHE and _MOVIE_CACHE.valid: return _MOVIE_CACHE
    except Exception: pass
    m = op('canvas_in')
    if m: _MOVIE_CACHE = m; return m
    for o in ops('*'):
        if _is_moviefilein(o): _MOVIE_CACHE = o; return o
    return None

# ---------- prompt/proc ----------
def _write_text_atomic(path, text):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as f: f.write(text)
    os.replace(tmp, path)

def _proc_file():
    base = TARGETS_BASE[0] if TARGETS_BASE else os.path.join(tempfile.gettempdir(), 'td_canvas')
    d = os.path.dirname(base); os.makedirs(d, exist_ok=True)
    return os.path.join(d, 'proc.txt')

def _set_text_comp(text):
    tgt = op('prompt') or op('promp')
    if not tgt:
        hits = [o for o in ops('*') if o.name.lower() in ('prompt','promp')]
        tgt = hits[0] if hits else None
    if tgt and hasattr(tgt.par, 'text'):
        tgt.par.text = str(text); print('PROMPT ->', tgt.path)
    else: print('PROMPT: no Text comp con par "text"')

# ---------- estado, throttle y de-dup ----------
_last_reload_ms = 0.0
_min_interval_ms = 80.0     # ~12.5 Hz (ajustable)
_lock_png = False           # True = ignorar JPEG en vivo
_last_digest = None         # sha1 de los últimos bytes cargados
_last_ext = None            # '.png' o '.jpg'

def _digest(b: bytes):
    return hashlib.sha1(b).digest()

def _save_and_reload(img_bytes: bytes, ext: str, force=False):
    """Guarda imagen y recarga Movie File In con throttle, evitando recargar si es idéntica."""
    global _last_reload_ms, _last_digest, _last_ext
    # de-dup: si viene EXACTAMENTE la misma imagen y misma extensión, no recargues
    dig = _digest(img_bytes)
    if _last_digest == dig and _last_ext == ext:
        return  # nada nuevo -> PC en idle sin trabajo

    written = None
    for base in TARGETS_BASE:
        target = base + ext
        try: _write_atomic(target, img_bytes); written = target; break
        except Exception as e: print('write fail:', base+ext, e)
    if not written:
        target = os.path.join(tempfile.gettempdir(), 'td_canvas' + ext)
        _write_atomic(target, img_bytes); written = target

    now_ms = time.time()*1000.0
    if (not force) and (now_ms - _last_reload_ms < _min_interval_ms):
        # Guarda estado pero no recargues aún; próxima llamada podrá recargar
        _last_digest = dig; _last_ext = ext
        return

    _last_reload_ms = now_ms
    _last_digest = dig
    _last_ext = ext

    movie = _find_movie_in()
    if movie:
        try:
            movie.par.file = written.replace('\\','/')
            if hasattr(movie.par,'reloadpulse'): movie.par.reloadpulse.pulse()
            elif hasattr(movie.par,'reload'):    movie.par.reload.pulse()
            if hasattr(movie.par,'index'):       movie.par.index = 0
            if hasattr(movie.par,'cuepulse'):    movie.par.cuepulse.pulse()
        except Exception as e: print('Movie reload error:', e)
    else:
        print('No Movie File In TOP encontrado')

# ---------- WebSocket callbacks ----------
def onReceiveBinary(dat, contents):
    """PNG final (binario) -> guarda, recarga inmediato y BLOQUEA JPEG hasta nuevo trazo."""
    global _lock_png
    try:
        img = bytes(contents)
        _lock_png = True
        _save_and_reload(img, '.png', force=True)  # bypass throttle: PNG manda
    except Exception as e:
        print('BIN receive error:', e)
    return

def onReceiveText(dat, rowIndex, message):
    """Protocolo JSON: proc/prompt, draw (dataURL) y state (drawing:start/end)."""
    global _lock_png
    try:
        msg = json.loads(message)
    except Exception as e:
        print('JSON error:', e)
        try: print('RAW:', message[:200])
        except: pass
        return

    t = (msg.get('type') or '').lower()
    payload = msg.get('payload')

    if t in ('proc','prompt'):
        text = '' if payload is None else str(payload)
        try:
            pf = _proc_file(); _write_text_atomic(pf, text); print('PROC saved:', pf)
        except Exception as e: print('PROC write error:', e)
        _set_text_comp(text); return

    if t == 'state':
        p = str(payload or '').lower()
        if p == 'drawing:start':
            _lock_png = False   # desbloquear para permitir JPEG live
        elif p == 'drawing:end':
            _lock_png = True    # asegurar quedarse en PNG hasta nuevo trazo
        return

    if t == 'draw':
        if not (isinstance(payload, str) and payload.startswith('data:image/')):
            return
        try:
            header, b64 = payload.split(',', 1)
            h = header.lower()
            if 'png' in h:
                ext = '.png'
            else:
                if _lock_png:
                    return  # PNG bloqueado: ignora JPEG live en idle
                ext = '.jpg'
            img = base64.b64decode(b64)
        except Exception as e:
            print('DRAW decode error:', e); return

        _save_and_reload(img, ext, force=False)
        return

    # desconocidos: ignorar silenciosamente para no ensuciar la consola
    return
```

## Consejos adicionales
- Ajusta `_min_interval_ms` si necesitas más FPS en el `Movie File In TOP` (ten en cuenta la GPU).
- El bloqueo de JPEG garantiza que, tras recibir un PNG final, TouchDesigner se quede con esa imagen hasta que llegue un nuevo `state: drawing:start`.
- El script intenta escribir en una carpeta persistente (`Project/inbox`, `Documents`, `%TEMP%`); revisa la consola si ninguna es válida.

Con esta configuración, cada navegador conectado a la misma sala compartirá sus trazos en tiempo real y el TOP se actualizará solo cuando haya una imagen nueva.
