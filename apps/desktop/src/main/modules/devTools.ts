import { is, optimizer } from "@electron-toolkit/utils";
import { app, type BrowserWindow } from "electron";

let windowListener:
  | ((_event: Electron.Event, window: BrowserWindow) => void)
  | null = null;

export function disposeDevTools(): void {
  if (windowListener)
    app.removeListener("browser-window-created", windowListener);
  windowListener = null;
}

export function configureDevTools(): void {
  if (windowListener) return;
  if (!is.dev) {
    windowListener = (_, window) => {
      window.webContents.on("devtools-opened", () => {
        window.webContents.closeDevTools();
      });
    };
    app.on("browser-window-created", windowListener);
    return;
  }

  // Set up development tools and shortcuts for every window
  windowListener = (_, window) => {
    optimizer.watchWindowShortcuts(window);

    // Register shortcuts for this window only
    window.webContents.on("before-input-event", (event, input) => {
      const isOpenShortcut =
        (input.control || input.meta) && input.shift && input.code === "KeyD";
      const isCloseShortcut =
        (input.control || input.meta) && input.shift && input.code === "KeyW";

      if (isOpenShortcut) {
        window.webContents.openDevTools({ mode: "detach" });
        event.preventDefault();
      }
      if (isCloseShortcut) {
        window.webContents.closeDevTools();
        event.preventDefault();
      }
    });
  };
  app.on("browser-window-created", windowListener);
}
