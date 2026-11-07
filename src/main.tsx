import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { iniciarAtualizacaoDiaria } from "./lib/autoUpdate";

createRoot(document.getElementById("root")!).render(<App />);

// PWA — registra o service worker (falha em silêncio em dev/HTTP)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Uma vez por dia confere se saiu versão nova e recarrega sozinho num momento seguro.
iniciarAtualizacaoDiaria();
