# 🎨 Real-Time Canvas - Optimized Edition

Aplicación Vite/React para dibujar en un lienzo y enviar tanto fotogramas en vivo (JPEG reducidos) como capturas finales (PNG 1:1) a un servidor WebSocket. El flujo está diseñado para integrarse con TouchDesigner mediante un `WebSocket DAT` + `Movie File In TOP`.

## ✨ Características principales

### 🎨 Diseño Optimizado para Tablets
- **Panel lateral compacto** (240-320px) para maximizar espacio del canvas
- **Canvas centrado responsive** usando 90vmin del viewport
- **Animaciones sutiles** en todos los elementos interactivos
- **Feedback visual constante**: status animado, hover effects, valores en tiempo real
- **Layout inteligente**: Grid 2x2 para toolbar, paleta de 8 columnas
- **Todo visible sin scroll** en tablets horizontales

### 🔌 WebSocket Estable y Debuggeable
- **Conexión persistente** sin bucles de reconexión
- **Logging completo** con emojis para fácil debugging (📤 📥 ✅ ❌)
- **Salas aleatorias**: cada cliente recibe un código alfanumérico
- **Streaming en vivo**: JPEG reducidos con throttling inteligente
- **PNG final**: binario de alta calidad al terminar el trazo

### 📱 Responsive Completo
- **Touch-optimized**: `touch-action: none` y gestión multi-touch
- **Pointer events**: continuidad del trazo sin cortes
- **Adaptive DPR**: optimización automática según dispositivo
- **3 breakpoints**: Desktop (>1200px), Tablet (768-1200px), Mobile (<768px)

## 📁 Estructura del proyecto

```
App.tsx                       # Controles, WebSocket y stage responsive
components/
  DrawingCanvas.tsx           # Canvas, pointer events y throttling live
  ColorPickerPro.tsx          # Selector de color avanzado
  ControlPanel.tsx            # Panel de controles
  icons.tsx                   # Iconos SVG
hooks/
  useWebSocket.ts             # WebSocket con refs estables (fix reconnect loop)
  useHistory.ts               # Undo/Redo para canvas
server.js                     # Node + ws con rooms y logging detallado
app.css                       # Layout optimizado para tablets + animaciones
types.ts                      # TypeScript types
```

## 📚 Documentación

- **[DESIGN_GUIDE.md](./DESIGN_GUIDE.md)** - Guía completa del diseño optimizado
- **[DESIGN_CHANGES_SUMMARY.md](./DESIGN_CHANGES_SUMMARY.md)** - Resumen visual de cambios
- **[TESTING.md](./TESTING.md)** - Guía de testing y troubleshooting WebSocket
- **[CAMBIOS_REALIZADOS.md](./CAMBIOS_REALIZADOS.md)** - Fix del bucle de reconexión
- **[RESPONSIVE_DESIGN.md](./RESPONSIVE_DESIGN.md)** - Guía de UX y breakpoints
- **[TOUCHDESIGNER_INTEGRATION.md](./TOUCHDESIGNER_INTEGRATION.md)** - Integración con TD

## Protocolo WebSocket
- **hello**: el servidor responde `{"type":"hello","payload":{"room":"XXXXXX"}}` al conectar.
- **draw**: frames live → `{"type":"draw","payload":"data:image/jpeg;base64,..."}` (JPEG o PNG reducido).
- **state**: `{"type":"state","payload":"drawing:start|drawing:end"}` para bloquear/desbloquear JPEG en TouchDesigner.
- **proc/prompt**: `{"type":"proc","payload":"texto"}` para compartir prompts o comandos.
- **Final PNG**: frame binario (`ArrayBuffer`) enviado con `ws.send(arrayBuffer)`; el servidor reenvía solo dentro de la sala.

> Consejo: antes de enviar un frame live, comprueba `ws.bufferedAmount` y descarta si excede `256 kB` en móvil/tablet.

## Integración con TouchDesigner
1. Añade un **WebSocket DAT** apuntando a `wss://TU_DOMINIO_RENDER.onrender.com/ws?room=XXXXXX` (usa `wss://` para conexiones seguras en Render).
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

## 🚀 Despliegue en Render

La aplicación está configurada para ejecutarse en **Render** como servicio web. El servidor sirve automáticamente el build de producción y maneja las conexiones WebSocket.

### Configuración en Render:
1. **Build Command**: `npm install && npm run build`
2. **Start Command**: `npm start` (ejecuta `node server.js`)
3. **Puerto**: Render asigna automáticamente el puerto via `process.env.PORT`

### Acceso:
- La aplicación estará disponible en tu URL de Render (ej: `https://tu-app.onrender.com`)
- El WebSocket se conecta automáticamente usando `wss://` en producción
- Los logs aparecen en:
  - **Navegador (F12)**: Mensajes enviados/recibidos
  - **Logs de Render**: Conexiones y reenvíos del servidor
  - **Panel LOG (tecla L)**: Eventos de la aplicación

## 🐛 Troubleshooting

### WebSocket no conecta o se desconecta constantemente
✅ **SOLUCIONADO** en esta versión. Si aún ocurre:
1. Verifica que la aplicación esté desplegada correctamente en Render
2. Revisa los logs de Render para ver errores del servidor
3. Revisa la consola del navegador (F12) para ver logs detallados
4. Consulta [TESTING.md](./TESTING.md) para diagnóstico completo

### No se envían datos al dibujar
✅ **SOLUCIONADO** - El hook useWebSocket ahora usa refs estables
- Verifica en consola: debe ver "📤 Enviando JSON: draw" al dibujar
- En el servidor debe aparecer: "📥 Recibido TEXTO"
- Si no aparecen estos logs, consulta [CAMBIOS_REALIZADOS.md](./CAMBIOS_REALIZADOS.md)

### Diseño no se ve bien en tablet
✅ **OPTIMIZADO** en esta versión
- Panel lateral ahora ocupa 26vw (antes 34vw)
- Canvas usa 90vmin del viewport
- Todo visible sin scroll en tablets horizontales
- Consulta [DESIGN_GUIDE.md](./DESIGN_GUIDE.md) para detalles

### Otros problemas
- **No recibo PNG final en TD** → Revisa [TOUCHDESIGNER_INTEGRATION.md](./TOUCHDESIGNER_INTEGRATION.md)
- **El trazo en tablet se corta** → Usa la última versión (pointer events optimizados)
- **Lag en streaming** → Reduce `liveMax` o `liveJpegQ` en `App.tsx`

## 🎯 Mejoras Recientes

### v2.0 - Optimización Tablet + WebSocket Fix (Nov 2025)
- ✅ **Fix crítico**: Bucle de reconexión WebSocket solucionado
- ✅ **Diseño tablet**: Panel -18%, canvas +45% espacio, sin scroll
- ✅ **Logging**: Console logs detallados con emojis para debug
- ✅ **Animaciones**: Pulsos, hover effects, feedback visual
- ✅ **UX**: Valores de sliders visibles, toolbar en grid 2x2
- ✅ **Paleta**: 8 columnas (antes 6), hover scale 1.1x
- ✅ **Performance**: Transiciones optimizadas con transform

## 📝 Características Técnicas

- **React 18** + **TypeScript** + **Vite**
- **WebSocket nativo** con reconexión automática
- **Pointer Events API** para multi-touch
- **Canvas API** con DPR adaptativo
- **CSS Grid + Flexbox** layout responsive
- **Media Queries** orientadas a características
- **Backdrop Filter** para UI translúcida

## 🤝 Contribuir

¿Mejoras? ¡Pull requests bienvenidos!
Para cambios grandes, abre un issue primero.

## 📄 Licencia

MIT - [Ver LICENSE](./LICENSE)
