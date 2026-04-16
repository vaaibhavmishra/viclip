import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App';
import './assets/index.css';
import * as Sentry from '@sentry/react';
import { ThemeProvider } from './components/theme-provider';
import { initSentry } from './lib/sentry';

// Initialize Sentry with your DSN
initSentry(import.meta.env.VITE_SENTRY_DSN);

// Use Sentry's Error Boundary instead of custom implementation
const SentryErrorBoundary = Sentry.ErrorBoundary;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SentryErrorBoundary fallback={<div className="error-screen">Something went wrong</div>}>
      <HashRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </HashRouter>
    </SentryErrorBoundary>
  </React.StrictMode>
);
