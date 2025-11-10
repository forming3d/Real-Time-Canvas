# Real-Time Canvas

Aplicación Vite/React para dibujar en un lienzo de 512×512 y enviar tanto fotogramas en vivo (JPEG reducidos) como capturas finales (PNG 1:1) a un servidor WebSocket. El flujo está diseñado para integrarse con TouchDesigner mediante un `WebSocket DAT` + `Movie File In TOP`.

## Características principales
- **Salas aleatorias**: cada cliente recibe un código alfanumérico (sin 0/O/I/1) y lo sincroniza con la UI al conectar.
- **Streaming en vivo**: durante el trazo se generan JPEG reducidos con FPS configurable y control de backpressure.
- **PNG final**: al soltar el puntero se emite un PNG 512×512 como binario (`ArrayBuffer`).
- **Compatibilidad TouchDesigner**: callbacks Python preparados para priorizar el PNG final y reducir recargas innecesarias.
- **Responsive completo**: el lienzo se escala con `ResizeObserver`, bloquea gestos táctiles por CSS y conserva la continuidad del trazo en tablet/móvil mediante listeners globales y `pointerId` persistente.

## Estructura del proyecto
```
App.tsx                      # Controles, WebSocket y stage responsive
components/
  DrawingCanvas.tsx          # Canvas, pointer events y throttling live
hooks/
  useWebSocket.ts            # Reconexión ligera + heartbeat + backpressure
server.js                    # Node + ws con rooms y límites de tamaño
app.css                      # Layout oscuro responsive y accesible
RESPONSIVE_DESIGN.md         # Guía de UX y breakpoints
TOUCHDESIGNER_INTEGRATION.md # Pasos detallados + script Python
```

## Protocolo WebSocket
- **hello**: el servidor responde `{"type":"hello","payload":{"room":"XXXXXX"}}` al conectar.
- **draw**: frames live → `{"type":"draw","payload":"data:image/jpeg;base64,..."}` (JPEG o PNG reducido).
- **state**: `{"type":"state","payload":"drawing:start|drawing:end"}` para bloquear/desbloquear JPEG en TouchDesigner.
- **proc/prompt**: `{"type":"proc","payload":"texto"}` para compartir prompts o comandos.
- **Final PNG**: frame binario (`ArrayBuffer`) enviado con `ws.send(arrayBuffer)`; el servidor reenvía solo dentro de la sala.

> Consejo: antes de enviar un frame live, comprueba `ws.bufferedAmount` y descarta si excede `256 kB` en móvil/tablet.

## Integración con TouchDesigner
1. Añade un **WebSocket DAT** apuntando a `ws://TU_HOST:8080?room=XXXXXX` (o `wss://` en producción).
2. Crea un **Movie File In TOP** y nómbralo `canvas_in` (o deja que el script busque el primero disponible).
3. Copia el archivo `websocket1_callbacks.py` incluido en este repositorio (ver documento inferior) en el DAT. Este script:
   - Prioriza el PNG final y mantiene un *lock* para ignorar JPEG en idle.
   - Escribe los frames en ubicaciones persistentes (`Project/inbox`, `Documents/Real-Time-Canvas`, `%TEMP%`).
   - Reemplaza el archivo por lotes (write + rename) para evitar lecturas parciales.
   - Throttlea recargas del Movie File In TOP y evita recargar si la imagen no cambió.

El script completo actualizado está disponible en [TOUCHDESIGNER_INTEGRATION.md](./TOUCHDESIGNER_INTEGRATION.md).

## Diseño responsive y accesibilidad
- El lienzo usa `touch-action: none` y listeners `passive: false` para capturar gestos táctiles sin hacer scroll ni gestos del navegador.
- Se preserva el `pointerId` activo y se escuchan `pointermove` globales para no cortar el trazo si el dedo sale del canvas.
- En dispositivos con `pointer: coarse` se clampa `devicePixelRatio` a 1 para evitar buffers gigantes.
- `ResizeObserver` recalcula el tamaño real del canvas, manteniendo la relación 1:1 y reconfigurando el contexto.
- Se procesan `getCoalescedEvents()` cuando están disponibles para suavizar el trazo.

Más recomendaciones prácticas en [RESPONSIVE_DESIGN.md](./RESPONSIVE_DESIGN.md).

## Troubleshooting
- **No recibo PNG final en TD** → asegúrate de usar el script actualizado y revisa la consola de TouchDesigner por errores de escritura (permisos/rutas).
- **El trazo en tablet se corta** → revisa que la app corra con la última versión; mantenemos `pointerId`, usamos micro-draw inicial y escuchamos `pointermove` global.
- **Cambio de sala no conecta** → envía el formulario “Cambiar”, espera al ícono verde y copia la URL `?room=XXXXXX`.
- **Lag en streaming** → baja `liveMax` (224) o `liveFps` (2–4) desde `App.tsx` para reducir ancho de banda.

## Licencia
MIT.
