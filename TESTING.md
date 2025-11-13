# 🧪 Guía de Testing - WebSocket Debug

## Problema Encontrado y Solucionado

### ❌ Problema Original:
El WebSocket entraba en un **bucle infinito de conexión/desconexión** debido a que el `useEffect` tenía dependencias que cambiaban constantemente (`onMessage`, `addLog`, etc.), causando que la conexión se cerrara y reabriera cada vez que se recibía un mensaje.

### ✅ Solución Implementada:
1. **Usar `useRef` para callbacks** en lugar de incluirlas en las dependencias del useEffect
2. **Optimizar `addLog`** para que no cambie en cada render
3. **Mejorar logging** para diagnosticar problemas

---

## 📋 Cómo Probar

### 1. Verificar Despliegue en Render

Asegúrate de que la aplicación esté desplegada y funcionando en Render. Verifica:
- La aplicación carga correctamente en tu URL de Render
- Los logs de Render muestran que el servidor está corriendo
- El puerto se asigna automáticamente via `process.env.PORT`

### 2. Probar con la Aplicación Web

1. Abre el navegador en tu aplicación desplegada en Render (ej: `https://tu-app.onrender.com`)
2. Abre la consola del navegador (F12)
3. Presiona la tecla `L` para ver el panel de logs
4. Dibuja algo en el canvas

**En la consola del navegador deberías ver:**
```
✅ WebSocket conectado: wss://tu-app.onrender.com/ws?room=XXXXXX
📥 Mensaje recibido: string {"type":"hello","payload":{"room":"XXXXXX"}}
✏️ DrawingCanvas: Iniciando dibujo
🔄 Enviando estado: drawing:start
📤 Enviando JSON: state {"type":"state","payload":"drawing:start"}
🎨 DrawingCanvas: Enviando frame onDown
🎨 Enviando frame live (JPEG)
📤 Enviando JSON: draw {"type":"draw","payload":"data:image/jpeg;base64,/9j...
✅ DrawingCanvas: Finalizando dibujo
🔄 Enviando estado: drawing:end
📤 Enviando JSON: state {"type":"state","payload":"drawing:end"}
🖼️ DrawingCanvas: Generando blob final
🖼️ Enviando PNG final (binario): 12345 bytes
📤 Enviando binario: 12345 bytes
```

**En los logs de Render deberías ver:**
```
✅ [XXXXXX] Cliente xxxxx conectado. Total: 1
👋 [XXXXXX] Saludo enviado a xxxxx
📥 [XXXXXX] xxxxx envió TEXTO (47 bytes): {"type":"state","payload":"drawing:start"}
📤 [XXXXXX] Reenviado a 0 de 0 cliente(s)
📥 [XXXXXX] xxxxx envió TEXTO (5678 bytes): {"type":"draw","payload":"data:image/jpeg...
📤 [XXXXXX] Reenviado a 0 de 0 cliente(s)
📥 [XXXXXX] xxxxx envió TEXTO (45 bytes): {"type":"state","payload":"drawing:end"}
📤 [XXXXXX] Reenviado a 0 de 0 cliente(s)
📥 [XXXXXX] xxxxx envió BINARIO (12345 bytes)
📤 [XXXXXX] Reenviado a 0 de 0 cliente(s)
```

### 3. Probar con 2 Clientes (Verificar Broadcasting)

1. Abre la aplicación en 2 pestañas del navegador (o 2 navegadores diferentes)
2. En la primera pestaña, copia el link de la sala
3. En la segunda pestaña, pega la URL con el mismo room
4. Dibuja en la primera pestaña
5. La segunda pestaña NO verá el dibujo (solo el servidor reenvía a OTROS clientes)

**En los logs de Render deberías ver:**
```
✅ [XXXXXX] Cliente xxxxx conectado. Total: 1
✅ [XXXXXX] Cliente yyyyy conectado. Total: 2
📥 [XXXXXX] xxxxx envió TEXTO (...bytes)
📤 [XXXXXX] Reenviado a 1 de 1 cliente(s)  ← ¡Ahora sí hay destinatarios!
```

---

## 🔍 Logs Explicados

### En el Cliente (Navegador):

| Emoji | Significado |
|-------|-------------|
| ✅ | WebSocket conectado exitosamente |
| 🔌 | WebSocket desconectado |
| ❌ | Error o intento fallido de envío |
| 📤 | Enviando datos al servidor |
| 📥 | Recibiendo datos del servidor |
| ✏️ | Inicio de trazo en el canvas |
| 🎨 | Enviando frame live (JPEG) |
| 🖼️ | Enviando/generando PNG final |
| 🔄 | Enviando cambio de estado |
| 💬 | Enviando prompt |
| ⚠️ | Advertencia (ej: no conectado) |

### En el Servidor (Node.js):

| Emoji | Significado |
|-------|-------------|
| ✅ | Cliente conectado |
| 🔌 | Cliente desconectado |
| 👋 | Saludo enviado |
| 📥 | Mensaje recibido de cliente |
| 📤 | Mensaje reenviado a otros clientes |
| ❌ | Error |
| ⚠️ | Advertencia |

---

## 🐛 Troubleshooting

### Si sigues viendo reconexiones infinitas:

1. **Limpia la caché del navegador** (Ctrl+Shift+Delete)
2. **Recarga la aplicación** con Ctrl+F5
3. **Verifica que la aplicación esté correctamente desplegada en Render**
4. **Revisa los logs de Render** para ver si hay errores del servidor
5. **Verifica que usaste los archivos actualizados**:
   - `hooks/useWebSocket.ts` debe usar `useRef` para callbacks
   - `App.tsx` debe usar `nextLogIdRef` en lugar de `nextLogId`

### Si no ves mensajes de envío en la consola:

1. Verifica que el estado `connected` sea `true` (debe aparecer en verde en el panel)
2. Abre la consola del navegador ANTES de dibujar
3. Verifica que no haya errores de JavaScript en la consola
4. Verifica que la conexión WebSocket use `wss://` (no `ws://`) en producción

### Si el servidor no recibe mensajes:

1. Verifica que el WebSocket esté conectado (revisa los logs de Render para ver "✅ Cliente conectado")
2. Verifica que NO se desconecte inmediatamente después
3. Si se desconecta con código 1006, puede ser un problema de configuración en Render o firewall
4. Revisa los logs de Render para ver errores específicos

---

## 📝 Notas Importantes

1. **El servidor NO hace eco al emisor**: Si estás solo en una sala, no verás tus propios mensajes reenviados. Esto es intencional.

2. **Necesitas 2+ clientes para ver broadcasting**: Para verificar que los mensajes se reenvían correctamente, necesitas al menos 2 clientes en la misma sala.

3. **Los logs son temporales**: Una vez que verifiques que todo funciona, puedes reducir o eliminar los console.log si lo deseas.

---

## ✅ Criterios de Éxito

Tu aplicación funciona correctamente si:

- ✅ El cliente se conecta UNA vez y se mantiene conectado
- ✅ NO hay reconexiones constantes
- ✅ Al dibujar, ves mensajes "📤 Enviando JSON/binario" en la consola
- ✅ El servidor muestra "📥 Recibido TEXTO/BINARIO"
- ✅ Con 2+ clientes, el servidor muestra "📤 Reenviado a N cliente(s)" con N > 0

