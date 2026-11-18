import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router";
import App from "./App";
import "./assets/index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/theme-provider";

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
