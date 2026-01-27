import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// =============================================================================
// Force update mechanism for business apps - ensures users always get latest version
// =============================================================================

// Listen for SW updates and force immediate activation
if ("serviceWorker" in navigator) {
  // When a new SW is installed, force it to take control immediately
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Only reload if we're not already reloading
    if (!sessionStorage.getItem("sw-reloading")) {
      sessionStorage.setItem("sw-reloading", "true");
      window.location.reload();
    }
  });

  // Clear the reload flag after the page loads
  window.addEventListener("load", () => {
    sessionStorage.removeItem("sw-reloading");
  });

  // Check for updates periodically (every 5 minutes)
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        reg.update().catch(() => {
          // Silent fail - network might be unavailable
        });
      }
    });
  }, 5 * 60 * 1000);
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
