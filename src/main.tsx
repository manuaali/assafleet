import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register custom service worker for push notifications
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((error) => {
    console.error("SW registration failed:", error);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
