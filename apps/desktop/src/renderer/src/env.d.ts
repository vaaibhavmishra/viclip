/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Ensure TypeScript sees the custom API on window
import { PreloadAPI } from '../../preload/index';

declare global {
  interface Window {
    api: PreloadAPI;
  }
}
