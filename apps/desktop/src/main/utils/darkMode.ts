import { nativeTheme } from "electron";
import { getMainWindow } from "../globalStates";

export function configureDarkMode(): void {
  // Send initial theme state when the window loads
  // We don't need this here necessarily if the renderer requests it on mount,
  // but it's good for immediate updates if the window exists.
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send(
      "theme-changed",
      nativeTheme.shouldUseDarkColors,
    );
  }

  // Listen for system theme changes
  // Always attach this, don't return early if window is missing
  nativeTheme.on("updated", () => {
    // Get the current window instance at the time of the event
    const currentMainWindow = getMainWindow();
    currentMainWindow?.webContents.send(
      "theme-changed",
      nativeTheme.shouldUseDarkColors,
    );
  });
}
