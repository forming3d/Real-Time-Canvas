# 📖 Ejemplos de Uso - Real-Time Canvas

## 🎨 Extracción de Paleta de Colores

### Ejemplo 1: Paleta desde foto de atardecer

**Imagen de entrada**: Foto de un atardecer con cielo naranja, nubes rosadas y silueta oscura.

**Resultado esperado (12 colores):**
```
#FF6B35  Naranja intenso (cielo)
#FF8C42  Naranja medio
#FFB347  Naranja claro
#E65F5C  Rojo anaranjado
#D946A6  Rosa magenta (nubes)
#8B4789  Púrpura oscuro
#4A5568  Gris azulado (silueta)
#2C3E50  Gris oscuro
#F4A261  Melocotón
#E76F51  Terracota
#264653  Azul noche
#1A1A1A  Negro azulado
```

### Ejemplo 2: Paleta desde ilustración colorida

**Imagen de entrada**: Arte digital con colores vibrantes (azul, amarillo, verde, magenta).

**Proceso K-Means:**
1. **Preprocesamiento**: 22,500 píxeles → 18,340 válidos (filtra fondo blanco)
2. **Clustering**: 12 grupos en 4 iteraciones (converge rápido)
3. **Ordenamiento**: Colores más saturados primero

**Resultado:**
```
#00CED1  Cian brillante (más saturado)
#FFD700  Dorado
#FF1493  Rosa intenso
#00FF7F  Verde primavera
#9370DB  Púrpura medio
#FF8C00  Naranja oscuro
#4169E1  Azul real
#32CD32  Verde lima
#FF69B4  Rosa pastel
#87CEEB  Azul cielo
#DDA0DD  Ciruela
#98FB98  Verde pálido
```

### Ejemplo 3: Paleta minimalista (2-3 colores dominantes)

**Imagen de entrada**: Logo minimalista con azul y blanco.

**Resultado (K-Means adapta):**
```
#1E3A8A  Azul oscuro principal (80% de píxeles)
#3B82F6  Azul medio
#60A5FA  Azul claro
#93C5FD  Azul muy claro
#DBEAFE  Azul pastel
#EFF6FF  Azul casi blanco
... (resto son variaciones sutiles)
```

> 💡 **Nota**: Incluso con imágenes simples, K-Means encuentra matices útiles.

---

## 🖌️ Selector de Color HSL

### Uso del anillo + cuadrado

```
┌─────────────────────────────────┐
│         ANILLO DE HUE           │
│   ╔═══════════════════════╗    │
│   ║                       ║    │
│   ║    CUADRADO S/L       ║    │
│   ║  (Saturación/Luz)     ║    │
│   ║                       ║    │
│   ╚═══════════════════════╝    │
│                                 │
└─────────────────────────────────┘
```

**Comportamiento:**

1. **Clic en el anillo externo** → Cambia el MATIZ (Hue)
   - Rojo (0°) → Amarillo (60°) → Verde (120°) → Cian (180°) → Azul (240°) → Magenta (300°) → Rojo (360°)

2. **Clic en el cuadrado central** → Ajusta Saturación (horizontal) y Luminancia (vertical)
   - **Izquierda**: Blanco (S=0%)
   - **Derecha**: Color puro (S=100%)
   - **Arriba**: Claro (L=100%)
   - **Abajo**: Oscuro (L=0%)

### Ejemplo interactivo:

```typescript
// Usuario hace clic en el anillo a 45° (naranja)
setHue(45);
// Cuadrado se actualiza con base naranja

// Usuario hace clic en cuadrado (centro-derecha)
setSat(0.7);  // 70% saturación
setLum(0.5);  // 50% luminancia

// Color final: hsl(45, 70%, 50%) = #D9A629 (naranja dorado)
```

---

## 🚀 Flujo Completo de Trabajo

### Caso de uso: Diseñador crea ilustración

1. **Subir referencia**
   - Usuario sube foto de paisaje otoñal
   - App extrae 12 colores dominantes en < 50ms
   - Paleta muestra: naranjas, marrones, amarillos, verdes oscuros

2. **Seleccionar color base**
   - Hace clic en naranja quemado (`#D2691E`) de la paleta
   - El selector HSL se actualiza automáticamente a H=25°, S=76%, L=47%

3. **Ajustar matiz**
   - Mueve ligeramente en el anillo hacia amarillo (H=35°)
   - El cuadrado muestra ahora variaciones de naranja-amarillo

4. **Crear variaciones**
   - Clic en parte superior del cuadrado → Color más claro
   - Clic en parte inferior → Sombra más oscura
   - Clic en izquierda → Versión desaturada (pastel)

5. **Dibujar con paleta armónica**
   - Todos los colores son coherentes
   - Fácil alternar entre tonos de la paleta con un clic

---

## 🎯 Comparación: Antes vs Después

### ❌ Método anterior

```javascript
// 5 colores fijos de 5 puntos
const colors = [
  getColorAt(0.2, 0.2),  // Esquina superior izq
  getColorAt(0.8, 0.2),  // Esquina superior der
  getColorAt(0.5, 0.5),  // Centro
  getColorAt(0.2, 0.8),  // Esquina inferior izq
  getColorAt(0.8, 0.8),  // Esquina inferior der
];
```

**Problema**: Si la imagen tiene un degradado vertical del centro, se pierden los colores principales.

### ✅ Método K-Means

```javascript
// Analiza TODOS los píxeles
const colors = extractDominantColors(imageData, 12);
// Resultado: 12 colores representativos independientemente de la composición
```

**Ventaja**: No importa la composición, siempre obtiene los colores más importantes.

---

## 📊 Casos de prueba

### Imagen con degradado complejo

**Input**: Cielo con degradado horizontal (naranja → rosa → púrpura)

**Salida K-Means:**
```
#FF6347  Naranja puro
#FF7F50  Coral
#FF8C69  Salmón
#FF6B9D  Rosa coral
#FF1493  Rosa intenso
#DA70D6  Orquídea
#BA55D3  Orquídea medio
#9370DB  Púrpura medio
#8A2BE2  Violeta azulado
... (transición completa capturada)
```

### Imagen monocromática

**Input**: Foto en blanco y negro con muchos grises

**Salida K-Means (filtra extremos):**
```
#2A2A2A  Gris muy oscuro
#4A4A4A  Gris oscuro
#6A6A6A  Gris medio-oscuro
#8A8A8A  Gris medio
#AAAAAA  Gris medio-claro
#CACACA  Gris claro
... (escala de grises completa)
```

### Imagen con transparencia (PNG)

**Input**: Logo PNG con fondo transparente

**Proceso:**
- K-Means ignora píxeles con alpha < 50
- Solo procesa colores opacos del logo
- Resultado: paleta limpia sin "color de fondo"

---

## 💡 Tips y Trucos

### 1. **Reutilizar paletas**
Los colores se mantienen en `colorHistory` hasta que subes otra imagen.

### 2. **Combinar paletas**
- Sube primera imagen → Guarda mentalmente colores favoritos
- Modifica manualmente en el selector HSL
- Los ajustes se añaden automáticamente al historial

### 3. **Paletas temáticas**
- **Atardecer**: Foto de cielo al atardecer
- **Naturaleza**: Foto de bosque o jardín
- **Neón**: Captura de luces urbanas nocturnas
- **Vintage**: Foto con filtro retro

### 4. **Optimizar rendimiento**
Para imágenes muy grandes (>2MB), el navegador las redimensiona automáticamente a 150×150px antes de procesar.

---

## 🔧 Personalización Avanzada

### Cambiar número de colores extraídos

En `App.tsx`, línea 411:

```typescript
const colors = extractDominantColors(imageData.data, 12); // <- Cambia este número
```

**Opciones:**
- `8`: Más rápido, menos variedad
- `12`: Balance perfecto (por defecto)
- `18`: Más variedad, tarda ~70ms

### Ajustar sensibilidad de filtrado

En `extractDominantColors`, línea 302:

```typescript
// Más estricto (solo colores muy opacos)
if (alpha > 200 && !(r < 20 && g < 20 && b < 20)) {

// Más permisivo (incluye semi-transparentes)
if (alpha > 30 && !(r < 5 && g < 5 && b < 5)) {
```

---

## 📚 Recursos Adicionales

- [Documentación técnica del algoritmo](./KMEANS_PALETTE.md)
- [Guía de diseño responsive](./RESPONSIVE_DESIGN.md)
- [Integración con TouchDesigner](./TOUCHDESIGNER_INTEGRATION.md)

---

**¿Preguntas?** Abre un issue en el repositorio o consulta la documentación completa.

