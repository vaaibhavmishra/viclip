/// <reference types="vite/client" />

// biome-ignore lint/complexity/noBannedTypes: <no env>
type ImportMetaEnv = {};

interface _ImportMeta {
  readonly env: ImportMetaEnv;
}

// Ensure TypeScript sees the custom API on window
import type { PreloadAPI } from "../../preload/index";

declare global {
  interface Window {
    api: PreloadAPI;
  }
}
