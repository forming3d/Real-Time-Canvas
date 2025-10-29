import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    target: 'es2020'
  },
  server: {
    port: 5173
  }
});
