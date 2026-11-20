import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router";
import App from "./App";
import "./assets/index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/theme-provider";

// Preload metadata is available before auth initialization, including on loading/error screens.
document.documentElement.dataset.platform =
  window.electron?.process.platform || "";
document.documentElement.dataset.windowAppearance =
  window.electron?.windowAppearance || "";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
