import { app, Menu, Tray } from "electron";
import log from "electron-log/main";
import trayIconLight from "../../../resources/tray@2x.png?asset";
import trayIconLinux from "../../../resources/tray-light@2x.png?asset";
//TODO: Change it to ICO
import trayIcon from "../../../resources/trayTemplate@2x.png?asset";
import { getTray, setTray } from "../globalStates";
import { checkUpdate } from "../services/update";
import { showWindow } from "./window";

export function createTray(): void {
  const existingTray = getTray();
  if (existingTray && !existingTray.isDestroyed()) {
    existingTray.destroy();
  }

  let tray: Tray;
  // Create system tray
  if (process.platform === "win32") {
    tray = new Tray(trayIconLight);
  } else if (process.platform === "linux") {
    tray = new Tray(trayIconLinux);
  } else {
    tray = new Tray(trayIcon);
  }

  // Store in global
  setTray(tray);

  // Set tray properties and context menu
  tray.setToolTip("ViClip");
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: (): void => {
        showWindow();
      },
    },
    {
      label: "Check for Updates...",
      click: (): void => {
        void checkUpdate({ isManual: true }).catch(() => {
          log.warn("Manual update check failed");
        });
      },
    },
    { type: "separator" },
    { label: "Quit", click: (): void => app.quit() },
  ]);

  // Show context menu on right click and toggle window on click
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    showWindow();
  });
}
