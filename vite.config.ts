import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
// PWA removido para eliminar cache - import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  optimizeDeps: {
    // react-leaflet + leaflet sometimes get stuck in Vite prebundle cache, causing
    // runtime Context errors after version changes. Excluding forces normal ESM loading.
    exclude: ['react-leaflet', '@react-leaflet/core', 'leaflet'],
    // Ensure @tanstack/react-query is properly pre-bundled
    include: ['@tanstack/react-query'],
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // PWA COMPLETAMENTE REMOVIDO para eliminar cache
    // O Service Worker era o principal responsável por cachear arquivos e API responses
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent duplicate React instances - fixes "Should have a queue" error
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
}));
