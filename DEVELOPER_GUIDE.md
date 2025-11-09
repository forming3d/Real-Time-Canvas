# 👨‍💻 Guía para Desarrolladores - Extensión del Sistema de Colores

## 🎯 Casos de Uso Avanzados

### 1. Añadir un nuevo algoritmo de extracción de paleta

#### Ejemplo: Mediana Cut (alternativa a K-Means)

```typescript
// En App.tsx, añade esta función junto a extractDominantColors

const extractColorsMedianCut = useCallback((imageData: Uint8ClampedArray, depth: number = 4) => {
  // Extraer píxeles válidos
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const alpha = imageData[i + 3];
    
    if (alpha > 50) {
      pixels.push([r, g, b]);
    }
  }
  
  // Función recursiva para dividir buckets
  const medianCut = (bucket: [number, number, number][], depth: number): [number, number, number][][] => {
    if (depth === 0 || bucket.length === 0) {
      return [bucket];
    }
    
    // Encontrar el canal con mayor rango
    const ranges = [0, 1, 2].map(channel => {
      const values = bucket.map(p => p[channel]);
      return Math.max(...values) - Math.min(...values);
    });
    const channelIdx = ranges.indexOf(Math.max(...ranges));
    
    // Ordenar por ese canal
    bucket.sort((a, b) => a[channelIdx] - b[channelIdx]);
    
    // Dividir en dos buckets
    const mid = Math.floor(bucket.length / 2);
    const left = bucket.slice(0, mid);
    const right = bucket.slice(mid);
    
    // Recursión
    return [
      ...medianCut(left, depth - 1),
      ...medianCut(right, depth - 1)
    ];
  };
  
  // Ejecutar median cut
  const buckets = medianCut(pixels, depth);
  
  // Calcular promedio de cada bucket
  const colors = buckets.map(bucket => {
    const avg = [0, 0, 0];
    bucket.forEach(([r, g, b]) => {
      avg[0] += r;
      avg[1] += g;
      avg[2] += b;
    });
    const r = Math.round(avg[0] / bucket.length);
    const g = Math.round(avg[1] / bucket.length);
    const b = Math.round(avg[2] / bucket.length);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  });
  
  return colors;
}, []);
```

**Uso:**
```typescript
// En handleImageUpload, reemplaza:
const colors = extractDominantColors(imageData.data, 12);

// Por:
const colors = extractColorsMedianCut(imageData.data, 4); // 2^4 = 16 colores
```

---

### 2. Añadir espacios de color alternativos (LAB, LCH)

#### LAB Color Space (más perceptual que RGB)

```typescript
// Conversión RGB → LAB
const rgbToLab = (r: number, g: number, b: number): [number, number, number] => {
  // 1. RGB → XYZ
  let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  let z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  
  // 2. XYZ → LAB (D65 illuminant)
  const refX = 0.95047;
  const refY = 1.00000;
  const refZ = 1.08883;
  
  x = x / refX;
  y = y / refY;
  z = z / refZ;
  
  const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
  const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
  const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);
  
  const L = (116 * fy) - 16;
  const A = 500 * (fx - fy);
  const B = 200 * (fy - fz);
  
  return [L, A, B];
};

// K-Means en espacio LAB (más preciso perceptualmente)
const extractDominantColorsLAB = useCallback((imageData: Uint8ClampedArray, k: number = 12) => {
  // Convertir todos los píxeles a LAB
  const pixelsLAB: [number, number, number][] = [];
  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i] / 255;
    const g = imageData[i + 1] / 255;
    const b = imageData[i + 2] / 255;
    const alpha = imageData[i + 3];
    
    if (alpha > 50) {
      pixelsLAB.push(rgbToLab(r, g, b));
    }
  }
  
  // Aplicar K-Means en espacio LAB (distancia perceptual)
  // ... (mismo algoritmo pero con píxeles LAB)
  
  // Convertir centroides LAB de vuelta a RGB/HEX
  // ...
}, []);
```

---

### 3. Guardar y cargar paletas personalizadas

#### LocalStorage para persistencia

```typescript
// Hook personalizado para gestionar paletas
const usePalettes = () => {
  const [savedPalettes, setSavedPalettes] = useState<Record<string, string[]>>(() => {
    const stored = localStorage.getItem('color-palettes');
    return stored ? JSON.parse(stored) : {};
  });
  
  const savePalette = useCallback((name: string, colors: string[]) => {
    const updated = { ...savedPalettes, [name]: colors };
    setSavedPalettes(updated);
    localStorage.setItem('color-palettes', JSON.stringify(updated));
  }, [savedPalettes]);
  
  const loadPalette = useCallback((name: string) => {
    return savedPalettes[name] || [];
  }, [savedPalettes]);
  
  const deletePalette = useCallback((name: string) => {
    const updated = { ...savedPalettes };
    delete updated[name];
    setSavedPalettes(updated);
    localStorage.setItem('color-palettes', JSON.stringify(updated));
  }, [savedPalettes]);
  
  return { savedPalettes, savePalette, loadPalette, deletePalette };
};

// Uso en App.tsx
const { savedPalettes, savePalette, loadPalette } = usePalettes();

// UI para guardar paleta
<button onClick={() => savePalette('Mi Paleta', colorHistory)}>
  Guardar paleta actual
</button>

// UI para cargar paleta
<select onChange={(e) => setColorHistory(loadPalette(e.target.value))}>
  {Object.keys(savedPalettes).map(name => (
    <option key={name} value={name}>{name}</option>
  ))}
</select>
```

---

### 4. Exportar paletas en diferentes formatos

```typescript
// Exportar como JSON
const exportPaletteJSON = (colors: string[], name: string) => {
  const data = {
    name,
    colors,
    createdAt: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// Exportar como Adobe ASE (Swatch Exchange)
const exportPaletteASE = (colors: string[], name: string) => {
  // ASE format header
  const header = new Uint8Array([
    0x41, 0x53, 0x45, 0x46, // "ASEF"
    0x00, 0x01, 0x00, 0x00, // Version 1.0
  ]);
  
  // Number of blocks
  const numBlocks = new Uint8Array([
    0x00, 0x00, 0x00, colors.length
  ]);
  
  // Color blocks
  const blocks = colors.map((hex, i) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    // RGB color block format
    // ... (implementación completa del formato ASE)
  });
  
  // Combinar y descargar
  // ...
};

// Exportar como CSS
const exportPaletteCSS = (colors: string[], name: string) => {
  const css = `:root {
${colors.map((c, i) => `  --color-${i + 1}: ${c};`).join('\n')}
}

/* Uso:
.elemento { color: var(--color-1); }
*/`;
  
  const blob = new Blob([css], { type: 'text/css' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.css`;
  a.click();
  URL.revokeObjectURL(url);
};

// Exportar como SCSS variables
const exportPaletteSCSS = (colors: string[], name: string) => {
  const scss = colors.map((c, i) => `$color-${i + 1}: ${c};`).join('\n');
  
  const blob = new Blob([scss], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.scss`;
  a.click();
  URL.revokeObjectURL(url);
};
```

---

### 5. Análisis de armonías de color

```typescript
// Generar paleta complementaria desde un color base
const generateComplementary = (hex: string): string[] => {
  const hsl = hexToHSL(hex);
  return [
    hex,
    hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l)
  ];
};

// Generar paleta triádica
const generateTriadic = (hex: string): string[] => {
  const hsl = hexToHSL(hex);
  return [
    hex,
    hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l),
    hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l)
  ];
};

// Generar paleta análoga
const generateAnalogous = (hex: string): string[] => {
  const hsl = hexToHSL(hex);
  return [
    hslToHex((hsl.h - 30 + 360) % 360, hsl.s, hsl.l),
    hex,
    hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l)
  ];
};

// Generar paleta monocromática
const generateMonochromatic = (hex: string, steps: number = 5): string[] => {
  const hsl = hexToHSL(hex);
  const colors: string[] = [];
  
  for (let i = 0; i < steps; i++) {
    const l = 0.2 + (i / (steps - 1)) * 0.6; // 20% a 80%
    colors.push(hslToHex(hsl.h, hsl.s, l));
  }
  
  return colors;
};

// UI para aplicar armonías
<select onChange={(e) => {
  const harmonyType = e.target.value;
  let newColors: string[] = [];
  
  switch (harmonyType) {
    case 'complementary':
      newColors = generateComplementary(brushColor);
      break;
    case 'triadic':
      newColors = generateTriadic(brushColor);
      break;
    case 'analogous':
      newColors = generateAnalogous(brushColor);
      break;
    case 'monochromatic':
      newColors = generateMonochromatic(brushColor);
      break;
  }
  
  setColorHistory(newColors);
}}>
  <option value="">Seleccionar armonía</option>
  <option value="complementary">Complementaria</option>
  <option value="triadic">Triádica</option>
  <option value="analogous">Análoga</option>
  <option value="monochromatic">Monocromática</option>
</select>
```

---

### 6. Análisis de contraste y accesibilidad

```typescript
// Calcular contraste WCAG
const getContrastRatio = (hex1: string, hex2: string): number => {
  const getLuminance = (hex: string) => {
    const rgb = [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255
    ];
    
    const [r, g, b] = rgb.map(c => 
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

// Verificar accesibilidad WCAG AA/AAA
const checkAccessibility = (foreground: string, background: string) => {
  const ratio = getContrastRatio(foreground, background);
  
  return {
    ratio: ratio.toFixed(2),
    AA_normal: ratio >= 4.5,      // Texto normal
    AA_large: ratio >= 3,          // Texto grande (18pt+)
    AAA_normal: ratio >= 7,        // Nivel AAA texto normal
    AAA_large: ratio >= 4.5        // Nivel AAA texto grande
  };
};

// UI de feedback
<div className="accessibility-checker">
  <h4>Contraste con fondo blanco</h4>
  {colorHistory.map(color => {
    const check = checkAccessibility(color, '#FFFFFF');
    return (
      <div key={color}>
        <span style={{ backgroundColor: color, padding: '4px 8px' }}>
          {color}
        </span>
        <span>Ratio: {check.ratio}</span>
        {check.AA_normal ? '✅ AA' : '❌ AA'}
        {check.AAA_normal ? '✅ AAA' : '❌ AAA'}
      </div>
    );
  })}
</div>
```

---

### 7. Integración con APIs externas

#### Adobe Color API
```typescript
const importFromAdobeColor = async (themeId: string) => {
  const response = await fetch(`https://color.adobe.com/api/v2/themes/${themeId}`);
  const data = await response.json();
  
  const colors = data.theme.colorSwatches.map((swatch: any) => {
    const { r, g, b } = swatch.rgb;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  });
  
  setColorHistory(colors);
};
```

#### Coolors.co API
```typescript
const importFromCoolors = async (paletteId: string) => {
  const response = await fetch(`https://coolors.co/palette/${paletteId}`);
  const html = await response.text();
  
  // Parse HTML para extraer colores
  const colors = html.match(/#[0-9A-Fa-f]{6}/g) || [];
  setColorHistory(colors.slice(0, 12));
};
```

---

### 8. Optimizaciones avanzadas

#### Web Workers para K-Means
```typescript
// kmeans.worker.ts
self.onmessage = (e) => {
  const { imageData, k, maxIterations } = e.data;
  
  // Ejecutar K-Means
  const colors = extractDominantColors(imageData, k, maxIterations);
  
  self.postMessage({ colors });
};

// App.tsx
const worker = new Worker(new URL('./kmeans.worker.ts', import.meta.url));

worker.onmessage = (e) => {
  setColorHistory(e.data.colors);
  addLog(`Paleta de ${e.data.colors.length} colores extraída`, 'success');
};

// En handleImageUpload
worker.postMessage({
  imageData: imageData.data,
  k: 12,
  maxIterations: 10
});
```

#### Memoización de conversiones
```typescript
const memoizedHslToHex = useMemo(() => {
  const cache = new Map<string, string>();
  
  return (h: number, s: number, l: number) => {
    const key = `${h}-${s}-${l}`;
    if (cache.has(key)) return cache.get(key)!;
    
    const hex = hslToHex(h, s, l);
    cache.set(key, hex);
    return hex;
  };
}, []);
```

---

## 🧪 Testing

### Jest + React Testing Library

```typescript
import { render, fireEvent, screen } from '@testing-library/react';
import App from './App';

describe('Color System', () => {
  it('should update brush color when HSL changes', () => {
    render(<App />);
    
    // Simular cambio de hue
    const picker = screen.getByClassName('color-picker');
    fireEvent.mouseDown(picker, { clientX: 150, clientY: 100 });
    
    // Verificar que brushColor se actualizó
    const preview = screen.getByClassName('color-preview');
    expect(preview).toHaveStyle({ backgroundColor: expect.any(String) });
  });
  
  it('should extract colors from uploaded image', async () => {
    render(<App />);
    
    const file = new File(['dummy'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/subir imagen/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    // Esperar a que se procese
    await screen.findByText(/paleta de \d+ colores/i);
    
    // Verificar que hay swatches
    const swatches = screen.getAllByClassName('swatch');
    expect(swatches.length).toBeGreaterThan(0);
  });
});
```

---

## 📚 Recursos Adicionales

- [Color Theory for Developers](https://tallys.github.io/color-theory/)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Adobe Color Wheel](https://color.adobe.com/)
- [Coolors Palette Generator](https://coolors.co/)

---

**¿Contribuir?** Fork el repo y envía un Pull Request con tus mejoras!

