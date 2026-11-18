import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { is } from "@electron-toolkit/utils";
import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import {
  getAuthWindow,
  getMainWindow,
  getSettingsWindow,
} from "../globalStates";

/** Only the local application document may invoke the privileged bridge. */
export function isTrustedRendererURL(raw: string): boolean {
  try {
    const candidate = new URL(raw);
    const expected =
      is.dev && process.env.ELECTRON_RENDERER_URL
        ? new URL(process.env.ELECTRON_RENDERER_URL)
        : pathToFileURL(join(__dirname, "../renderer/index.html"));
    candidate.hash = "";
    expected.hash = "";
    return candidate.href === expected.href;
  } catch {
    return false;
  }
}

export function assertTrustedIPC(
  event: IpcMainEvent | IpcMainInvokeEvent,
): void {
  const windows = [getMainWindow(), getAuthWindow(), getSettingsWindow()];
  const known = windows.some(
    (window) =>
      window && !window.isDestroyed() && window.webContents === event.sender,
  );
  if (
    !known ||
    event.sender.isDestroyed() ||
    !event.senderFrame ||
    event.senderFrame !== event.sender.mainFrame ||
    !isTrustedRendererURL(event.senderFrame.url)
  ) {
    throw new Error("Unauthorized IPC sender.");
  }
}
