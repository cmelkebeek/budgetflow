import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: { outDir: '../dist/frontend', emptyOutDir: true },
  // En développement, l'API tourne à part (npm run dev:backend).
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
