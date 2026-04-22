import { app, Menu, Tray } from "electron";
import trayIconLight from "../../../resources/tray@2x.png?asset";
import trayIconLinux from "../../../resources/tray-light@2x.png?asset";
//TODO: Change it to ICO
import trayIcon from "../../../resources/trayTemplate@2x.png?asset";
import { setTray } from "../globalStates";
import { showWindow } from "./window";

export function createTray(): void {
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
    { label: "Quit", click: (): void => app.quit() },
  ]);

  // Show context menu on both left and right click
  tray.setContextMenu(contextMenu);
}
