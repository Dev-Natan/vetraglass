import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Recupera de chunks órfãos após novo deploy (HTML antigo em cache
// referencia hashes de JS que já não existem). Guard via sessionStorage
// para evitar loop de reload.
const RELOAD_KEY = "__vite_chunk_reload__";

const handleChunkError = () => {
  if (sessionStorage.getItem(RELOAD_KEY)) return;
  sessionStorage.setItem(RELOAD_KEY, "1");
  window.location.reload();
};

window.addEventListener("vite:preloadError", handleChunkError);
window.addEventListener("error", (e) => {
  const msg = e?.message || "";
  if (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed")
  ) {
    handleChunkError();
  }
});
window.addEventListener("load", () => sessionStorage.removeItem(RELOAD_KEY));

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
