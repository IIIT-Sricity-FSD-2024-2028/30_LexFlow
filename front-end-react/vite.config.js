import { defineConfig } from 'vite';        // Vite = our build tool / dev server
import react from '@vitejs/plugin-react';   // Teaches Vite how to compile JSX + React
import tailwindcss from '@tailwindcss/vite'; // Teaches Vite how to compile Tailwind CSS

// https://vite.dev/config/
export default defineConfig({
  // React plugin: enables JSX and fast-refresh while developing
  plugins: [react(), tailwindcss()],
  // Proxy API calls made to "/api" during development to the NestJS backend.
  // This avoids CORS problems because the browser thinks backend + frontend
  // live on the same origin (localhost:5173).
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''), // strip the /api prefix
      },
    },
  },
});
