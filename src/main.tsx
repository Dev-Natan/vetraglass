import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installImageUrlRewriter } from "./utils/imageUrlRewriter";

installImageUrlRewriter();

// Recupera de chunks órfãos após novo deploy (HTML antigo em cache
// referencia hashes de JS que já não existem). Guard via sessionStorage
// para evitar loop de reload.
const RELOAD_KEY = "__vite_chunk_reload__";

// Clear on fresh page load so a future stale-chunk error can trigger a new reload.
sessionStorage.removeItem(RELOAD_KEY);

const isChunkError = (msg: string) =>
  msg.includes("Failed to fetch dynamically imported module") ||
  msg.includes("Importing a module script failed") ||
  msg.includes("error loading dynamically imported module");

const handleChunkError = () => {
  if (sessionStorage.getItem(RELOAD_KEY)) return;
  sessionStorage.setItem(RELOAD_KEY, "1");
  window.location.reload();
};

window.addEventListener("vite:preloadError", handleChunkError);
window.addEventListener("error", (e) => {
  if (isChunkError(e?.message || "")) handleChunkError();
});
window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
  const reason: any = e?.reason;
  const msg = reason?.message || String(reason || "");
  if (isChunkError(msg)) handleChunkError();
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
