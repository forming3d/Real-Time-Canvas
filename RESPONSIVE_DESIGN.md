# Responsive & Touch Guide

Esta guía resume las decisiones que implementa la app para que el lienzo de 512×512 sea usable en desktop, tablet y móvil.

## Layout
- Grid de dos columnas (`.app`) para desktop ≥960 px con panel lateral fijo.
- El panel se vuelve *sticky* en la parte superior bajo 960 px, liberando todo el alto para el canvas.
- El canvas se envuelve en `.canvas-frame` con `aspect-ratio: 1 / 1` y se redimensiona con `ResizeObserver`.
- Controles (`.row`) permiten `flex-wrap` para no comprimir inputs en pantallas estrechas.

## Canvas & eventos de puntero
- `touch-action: none` y listeners `passive: false` para impedir gestos nativos (scroll, zoom) durante el dibujo.
- Se conserva `pointerId` activo, se hace un micro-trazo inicial y se escuchan `pointermove` globales para mantener el trazo aunque el dedo salga del canvas.
- En `pointer: coarse` (tablet/móvil) se clampa `devicePixelRatio` a 1; desktop permanece ≤2 para nitidez.
- Se consumen `getCoalescedEvents()` cuando están disponibles para suavizar líneas sin inundar el main thread y se liberan capturas de puntero cuando termina el trazo.

## Rendimiento
- Live JPEG: reducción a `liveMax` (224–320 px) y FPS limitados (6–8 desktop, 2–4 móvil).
- PNG final: `canvas.toBlob('image/png')` asíncrono para no bloquear la UI.
- Backpressure: antes de enviar live, se valida `ws.bufferedAmount` (ver `useWebSocket.ts`).
- Evitamos recargas redundantes en TouchDesigner usando *locks* y hashes SHA1 en el callback Python.

## Accesibilidad
- Alto contraste, tipografía sin serif y `:focus-visible` personalizado.
- `aria-label` en controles clave (sala, color, grosor, borrar, prompt).
- `<canvas>` etiquetado como `role="img"` y `aria-label` descriptivo.

## Ajustes sugeridos
- Reducir `liveMax`/`liveFps` si la red móvil es lenta.
- Subir `brushSize` mínimo en pantallas táctiles si se necesitan trazos gruesos.
- Añadir soporte para atajos de teclado (p.ej. `E` para goma) en desktop.
