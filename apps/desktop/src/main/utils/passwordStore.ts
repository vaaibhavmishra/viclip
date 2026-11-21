import { app } from "electron";

/** Select a Linux secret store before Electron initializes encryption. */
export function configurePasswordStore(): void {
  if (
    process.platform !== "linux" ||
    app.commandLine.hasSwitch("password-store")
  ) {
    return;
  }

  const desktops = [
    process.env.XDG_CURRENT_DESKTOP,
    process.env.XDG_SESSION_DESKTOP,
    process.env.DESKTOP_SESSION,
  ]
    .join(":")
    .toLowerCase()
    .split(/[:;\s/-]+/);

  // Let Electron select the installed KWallet version on KDE sessions.
  if (
    process.env.KDE_SESSION_VERSION ||
    desktops.some((desktop) =>
      /^(kde\d*|plasma(?:wayland|x11)?)$/.test(desktop),
    )
  ) {
    return;
  }

  // Desktop auto-detection can select basic_text even with Secret Service
  // available. Use the same secure backend as the working Linux launch flag.
  app.commandLine.appendSwitch("password-store", "gnome-libsecret");
}
