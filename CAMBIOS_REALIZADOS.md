# 🔧 Cambios Realizados - Fix WebSocket

## 🎯 Problema Identificado

**El WebSocket entraba en un bucle infinito de reconexión** debido a un bug en las dependencias del `useEffect` en `hooks/useWebSocket.ts`.

### Causa Raíz:
```
1. WebSocket se conecta → Recibe mensaje "hello"
2. addLog() se ejecuta → nextLogId cambia
3. addLog se recrea → handleSocketMessage se recrea  
4. useEffect detecta cambio en onMessage → Cierra WebSocket
5. Crea nueva conexión → Vuelve al paso 1
```

Resultado: **Conexiones y desconexiones constantes. Nunca se envían datos.**

---

## ✅ Solución Implementada

### 1. **hooks/useWebSocket.ts** - Fix del bucle de reconexión

**ANTES:**
```typescript
useEffect(() => {
  // ... código ...
  ws.onopen = () => { onOpen?.(); };
  ws.onmessage = (ev) => { onMessage?.(ev); };
  // ...
}, [url, reconnectMs, onOpen, onClose, onError, onMessage]);
// ❌ onMessage cambia constantemente → reconexión infinita
```

**DESPUÉS:**
```typescript
// Usar refs para callbacks estables
const onOpenRef = useRef(onOpen);
const onMessageRef = useRef(onMessage);
// ... etc

useEffect(() => {
  onOpenRef.current = onOpen;
  onMessageRef.current = onMessage;
  // ...
}, [onOpen, onMessage]);

useEffect(() => {
  // ... código ...
  ws.onopen = () => { onOpenRef.current?.(); };
  ws.onmessage = (ev) => { onMessageRef.current?.(ev); };
  // ...
}, [url, reconnectMs]);
// ✅ Solo reconecta cuando cambia url o reconnectMs
```

### 2. **App.tsx** - Optimización de addLog

**ANTES:**
```typescript
const [nextLogId, setNextLogId] = useState(1);

const addLog = useCallback((message, type) => {
  setLogs(prev => [...prev, { id: nextLogId, ... }]);
  setNextLogId(n => n + 1);
}, [nextLogId]); // ❌ Se recrea cada vez que nextLogId cambia
```

**DESPUÉS:**
```typescript
const nextLogIdRef = useRef(1);

const addLog = useCallback((message, type) => {
  const id = nextLogIdRef.current++;
  setLogs(prev => [...prev, { id, ... }]);
}, []); // ✅ Nunca se recrea
```

### 3. **Logging Completo** - Para debugging

Agregado console.log en todos los puntos críticos:

**En hooks/useWebSocket.ts:**
- ✅ Conexión establecida
- 🔌 Conexión cerrada
- ❌ Errores
- 📤 Mensajes enviados (JSON/texto/binario)
- 📥 Mensajes recibidos

**En App.tsx:**
- 🎨 Frames live enviados
- 🖼️ PNG final enviado
- 🔄 Estados enviados (drawing:start/end)
- 💬 Prompts enviados
- ⚠️ Advertencias (no conectado, etc.)

**En components/DrawingCanvas.tsx:**
- ✏️ Inicio de dibujo
- 🎨 Frames durante el dibujo
- 🖼️ Generación de blob final
- ✅ Fin de dibujo

**En server.js:**
- ✅ Cliente conectado (con ID y total)
- 👋 Saludo enviado
- 📥 Mensajes recibidos (tipo, tamaño, preview)
- 📤 Mensajes reenviados (cantidad)
- 🔌 Cliente desconectado (código)
- ❌ Errores

### 4. **server.js** - Mejoras en logging

- Agregado ID único por cliente para seguimiento
- Mostrar código de desconexión
- Manejo de errores mejorado
- Preview de mensajes de texto
- Contador de destinatarios

---

## 📦 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `hooks/useWebSocket.ts` | ✅ Fix reconexión infinita con refs<br>✅ Logging completo |
| `App.tsx` | ✅ Optimización de addLog<br>✅ Logging en funciones de envío |
| `components/DrawingCanvas.tsx` | ✅ Logging en eventos de dibujo |
| `server.js` | ✅ Mejoras en logging<br>✅ Mejor tracking de clientes |

## 📦 Archivos Nuevos

| Archivo | Propósito |
|---------|-----------|
| `test-websocket.js` | Script de prueba rápida del WebSocket |
| `TESTING.md` | Guía completa de testing y troubleshooting |
| `CAMBIOS_REALIZADOS.md` | Este archivo |

---

## 🧪 Cómo Verificar que Funciona

### Prueba en Producción (Render):

1. Asegúrate de que la aplicación esté desplegada en Render
2. Abre la aplicación en tu navegador
3. Abre la consola del navegador (F12)
4. Verifica que el WebSocket se conecte correctamente usando `wss://`

Deberías ver intercambio de mensajes sin reconexiones en los logs del navegador y en los logs de Render.

### Prueba Completa:

1. Abre la aplicación en el navegador
2. Abre la consola (F12)
3. Dibuja algo
4. Verifica que en la consola aparezcan mensajes como:
   - ✅ WebSocket conectado
   - 📤 Enviando JSON: state
   - 📤 Enviando JSON: draw
   - 📤 Enviando binario: XXXX bytes

5. En el terminal del servidor deberías ver:
   - 📥 Recibido TEXTO
   - 📥 Recibido BINARIO

**Si NO se desconecta constantemente = ✅ FUNCIONA**

---

## 🎉 Resultado Esperado

### ANTES (Problema):
```
✅ Cliente conectado
🔌 Cliente desconectado
✅ Cliente conectado
🔌 Cliente desconectado
✅ Cliente conectado
🔌 Cliente desconectado
... (infinito)
```

### DESPUÉS (Solución):
```
✅ Cliente conectado
👋 Saludo enviado
📥 Recibido TEXTO (47 bytes): {"type":"state","payload":"drawing:start"}
📥 Recibido TEXTO (5678 bytes): {"type":"draw","payload":"data:image...
📥 Recibido BINARIO (12345 bytes)
📥 Recibido TEXTO (45 bytes): {"type":"state","payload":"drawing:end"}
... (estable, sin reconexiones)
```

---

## 💡 Lecciones Aprendidas

1. **Cuidado con las dependencias de useEffect**: Incluir callbacks que cambian frecuentemente puede causar efectos secundarios inesperados.

2. **Usar useRef para callbacks estables**: Cuando necesitas callbacks actualizadas pero no quieres que el effect se ejecute de nuevo, usa refs.

3. **Logging es fundamental**: Para debugging de WebSockets, los logs en ambos lados (cliente y servidor) son esenciales.

4. **React hooks pueden ser tramposos**: Un simple cambio en las dependencias puede romper completamente la funcionalidad.

---

## 📚 Referencias

- React useEffect: https://react.dev/reference/react/useEffect
- React useRef: https://react.dev/reference/react/useRef
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

---

## 🔄 Próximos Pasos (Opcional)

1. **Remover logs de producción**: Una vez verificado, puedes reducir los console.log
2. **Agregar heartbeat**: Para detectar conexiones muertas
3. **Agregar buffer de reconexión**: Para no perder mensajes durante reconexiones
4. **Agregar compresión**: Para reducir el tamaño de los mensajes

