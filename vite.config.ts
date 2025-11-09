import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Render usará el bundle de /dist. Este puerto es solo para dev local.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      host: '0.0.0.0',
      port: 5173, // evita 443 en dev
    },
    plugins: [react()],
    define: {
      // Mantén estos defines si ya los usas en el código
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    build: {
      // por defecto Vite deja index.html + /assets/*
      sourcemap: false,
      target: 'esnext',
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
