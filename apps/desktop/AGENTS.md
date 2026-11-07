# ViClip Desktop (@viclip/desktop) Agent Guidelines

This application is built with **Electron 41**, **electron-vite**, **React 19**, and **Tailwind CSS 4**.

## Architecture & Process Separation

- **Main Process (`src/main/`)**:
  - Handles system tray icon, window creation, global shortcuts, native clipboard polling, and auto-updates.
  - Implements the Node.js crypto adapter for `@viclip/utils` using Node's native `crypto` module (`src/main/services/crypto.ts`).
  - Manages IPC listeners (`ipcMain.handle`).
- **Preload Script (`src/preload/`)**:
  - Exposes context bridges to the renderer safely via `contextBridge.exposeInMainWorld('api', ...)`.
  - **Do NOT disable contextIsolation or enable nodeIntegration**.
- **Renderer Process (`src/renderer/`)**:
  - React 19 UI with Zustand state management (`useAppStore`), Radix UI primitives, Lucide icons.
  - Communicates with main process only via `window.api`.

## Key Commands

- Run dev server: `pnpm --filter @viclip/desktop dev`
- Typecheck: `pnpm --filter @viclip/desktop typecheck` (checks both node and web tsconfigs)
- Build targets:
  - macOS: `pnpm --filter @viclip/desktop build:mac`
  - Windows: `pnpm --filter @viclip/desktop build:win`
  - Linux: `pnpm --filter @viclip/desktop build:linux`

## Guardrails

- Always check both `typecheck:node` and `typecheck:web` when editing IPC or preload interfaces.
- Do not import `electron` or `node:*` modules inside `src/renderer/`.
