# 🎨 Extracción de Paletas con K-Means

## Descripción

Este proyecto utiliza el algoritmo **K-Means clustering** para extraer los colores dominantes de cualquier imagen que subas. En lugar de simplemente muestrear píxeles aleatorios, el algoritmo analiza toda la imagen y agrupa colores similares para identificar los tonos más representativos.

## ¿Cómo funciona K-Means?

### 1. **Preprocesamiento de píxeles**
```typescript
// Extraer todos los píxeles RGB (ignorando alpha)
for (let i = 0; i < imageData.length; i += 4) {
  const r = imageData[i];
  const g = imageData[i + 1];
  const b = imageData[i + 2];
  const alpha = imageData[i + 3];
  
  // Filtrar píxeles muy transparentes o extremos (negro/blanco puros)
  if (alpha > 50 && !(r < 10 && g < 10 && b < 10) && !(r > 245 && g > 245 && b > 245)) {
    pixels.push([r, g, b]);
  }
}
```

**¿Por qué filtrar?**
- Píxeles transparentes no representan colores reales
- Negro y blanco extremos pueden dominar la paleta sin aportar información cromática útil

### 2. **Inicialización de centroides**
```typescript
const step = Math.floor(pixels.length / k);
for (let i = 0; i < k; i++) {
  const idx = Math.min((i * step + Math.floor(step / 2)), pixels.length - 1);
  centroids.push([...pixels[idx]]);
}
```

Se eligen **k centroides** (por defecto 12) espaciados uniformemente en el array de píxeles. Esto evita inicializaciones aleatorias que pueden dar resultados inconsistentes.

### 3. **Iteración K-Means**

El algoritmo repite estos pasos hasta converger (máximo 10 iteraciones):

#### a) **Asignación de clusters**
Cada píxel se asigna al centroide más cercano usando distancia euclidiana en espacio RGB:

```typescript
const distance = (a, b) => Math.sqrt(
  Math.pow(a[0] - b[0], 2) +
  Math.pow(a[1] - b[1], 2) +
  Math.pow(a[2] - b[2], 2)
);
```

#### b) **Actualización de centroides**
Cada centroide se recalcula como el promedio de todos los píxeles asignados a su cluster:

```typescript
newCentroid[0] = Math.round(sum_r / cluster.length);
newCentroid[1] = Math.round(sum_g / cluster.length);
newCentroid[2] = Math.round(sum_b / cluster.length);
```

#### c) **Criterio de convergencia**
Si ningún centroide se mueve más de 1 unidad, el algoritmo ha convergido:

```typescript
if (distance(newCentroid, oldCentroid) > 1) {
  changed = true;
}
```

### 4. **Ordenamiento por saturación**

Los colores finales se ordenan de más saturados a menos saturados para presentar primero los tonos más vibrantes:

```typescript
const saturation = max === 0 ? 0 : (max - min) / max;
colors.sort((a, b) => b.saturation - a.saturation);
```

## Optimizaciones de rendimiento

### 🚀 **Muestreo inteligente**
```typescript
for (let i = 0; i < pixels.length; i += 4) {
  // Procesar solo 1 de cada 4 píxeles
}
```

En una imagen de 150×150px tenemos **22,500 píxeles**. Procesarlos todos en cada iteración sería costoso. Muestreando 1 de cada 4, reducimos el cómputo a ~5,600 píxeles sin pérdida significativa de precisión.

### ⚡ **Convergencia temprana**
El algoritmo se detiene cuando los centroides ya no cambian, típicamente en 3-5 iteraciones en lugar de las 10 máximas.

### 🎯 **Balance precisión/velocidad**
- **k = 12 colores**: Suficiente diversidad sin sobrecargar la UI
- **size = 150px**: Balance entre detalle y procesamiento rápido
- **maxIterations = 10**: Límite seguro para convergencia

## Comparación: Antes vs Después

### ❌ **Método anterior (muestreo fijo)**
```typescript
const samplePositions = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.5, y: 0.5 },
  // ... solo 5 posiciones fijas
];
```

**Problemas:**
- Solo 5 colores
- Ignora la mayoría de la imagen
- Puede perder colores importantes si no están en las posiciones muestreadas
- No representa la distribución real de colores

### ✅ **Método actual (K-Means)**
```typescript
extractDominantColors(imageData.data, 12)
```

**Ventajas:**
- 12 colores dominantes
- Analiza toda la imagen
- Agrupa colores similares automáticamente
- Ordena por saturación (colores más útiles primero)
- Filtra ruido (transparencias, extremos)

## Ejemplo de uso

Cuando subes una imagen:

1. **Se carga en un canvas** de 150×150px
2. **Se extraen todos los píxeles** RGB válidos (~22,500)
3. **K-Means agrupa** en 12 clusters
4. **Se obtienen los centroides** como colores representativos
5. **Se ordenan por saturación** y se muestran en la paleta

```typescript
img.onload = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 150;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, 150, 150);
  
  const imageData = ctx.getImageData(0, 0, 150, 150);
  const colors = extractDominantColors(imageData.data, 12);
  
  setColorHistory(colors); // Muestra en la UI
}
```

## Complejidad algorítmica

- **Tiempo**: O(n × k × i) donde:
  - n = número de píxeles (~5,600 después de muestreo)
  - k = número de clusters (12)
  - i = iteraciones (típicamente 3-5)
  
  Total: ~200,000 operaciones → **< 50ms** en dispositivos modernos

- **Espacio**: O(n + k) → Lineal, muy eficiente en memoria

## Posibles mejoras futuras

1. **K-Means++**: Mejor inicialización de centroides
2. **Espacios de color perceptuales**: Usar LAB o LCH en lugar de RGB
3. **Deduplicación**: Eliminar colores muy similares
4. **Ponderación por área**: Dar más peso a colores que ocupan más píxeles
5. **Worker threads**: Procesar en background para imágenes grandes

## Referencias

- [K-Means Clustering - Wikipedia](https://en.wikipedia.org/wiki/K-means_clustering)
- [Color Quantization](https://en.wikipedia.org/wiki/Color_quantization)
- [Dominant Color Extraction](https://www.alanzucconi.com/2015/09/30/colour-sorting/)

---

**Implementado por**: MappingON  
**Fecha**: Noviembre 2025  
**Tecnología**: TypeScript + HTML5 Canvas

