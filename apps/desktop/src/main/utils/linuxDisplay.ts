import { app } from "electron";
import { getLinuxDisplayArgs } from "../../shared/linuxDisplay";

/** Restart Wayland launches before creating windows or taking the lock. */
export function restartInX11IfNeeded(): boolean {
  // electron-vite supplies the switch before launch and owns the dev server.
  // Preview has no dev server, and --skipBuild can bypass its config loading.
  if (
    process.defaultApp &&
    (process.env.NODE_ENV_ELECTRON_VITE === "development" ||
      process.env.ELECTRON_RENDERER_URL)
  ) {
    return false;
  }

  const originalArgs = process.argv.slice(1);
  const args = getLinuxDisplayArgs(originalArgs, process.platform, process.env);
  if (args === originalArgs) return false;

  // Ozone is initialized before main JS, so appendSwitch would be too late.
  // An AppImage's mounted executable disappears when its original process exits.
  app.relaunch({
    args,
    ...(!process.defaultApp && process.env.APPIMAGE
      ? { execPath: process.env.APPIMAGE }
      : {}),
  });
  app.exit(0);
  return true;
}
