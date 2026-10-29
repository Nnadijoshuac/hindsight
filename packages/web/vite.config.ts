import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// In development the API runs on :3000 (npm start); Vite proxies /api to it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Shared domain code (formatting, types) comes straight from the forecast package.
      '@forecast': fileURLToPath(new URL('../forecast/src', import.meta.url)),
    },
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
