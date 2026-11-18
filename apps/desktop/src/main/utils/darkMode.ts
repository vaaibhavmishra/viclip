import { nativeTheme } from "electron";
import { getMainWindow } from "../globalStates";

let themeListener: (() => void) | null = null;

export function disposeDarkMode(): void {
  if (themeListener) nativeTheme.removeListener("updated", themeListener);
  themeListener = null;
}

export function configureDarkMode(): void {
  if (themeListener) return;
  // Send initial theme state when the window loads
  // We don't need this here necessarily if the renderer requests it on mount,
  // but it's good for immediate updates if the window exists.
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(
      "theme-changed",
      nativeTheme.shouldUseDarkColors,
    );
  }

  // Listen for system theme changes
  // Always attach this, don't return early if window is missing
  themeListener = () => {
    // Get the current window instance at the time of the event
    const currentMainWindow = getMainWindow();
    if (currentMainWindow && !currentMainWindow.isDestroyed()) {
      currentMainWindow.webContents.send(
        "theme-changed",
        nativeTheme.shouldUseDarkColors,
      );
    }
  };
  nativeTheme.on("updated", themeListener);
}
