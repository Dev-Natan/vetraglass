import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
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
    host: "0.0.0.0",
    port: 3000,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // The generated MCP bundle is checked in. Only regenerate it explicitly;
    // automatic runs are slow and emit invalid absolute paths on Windows.
    process.env.VETRA_BUNDLE_MCP === "true" && mcpPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent duplicate React instances - fixes "Should have a queue" error
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
}));
