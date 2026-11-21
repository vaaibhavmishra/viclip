export function getLinuxDisplayArgs(
  args: string[],
  platform: string,
  environment: Readonly<Record<string, string | undefined>>,
): string[] {
  const terminator = args.indexOf("--");
  const switches = terminator < 0 ? args : args.slice(0, terminator);
  if (
    platform !== "linux" ||
    !environment.DISPLAY ||
    (environment.XDG_SESSION_TYPE !== "wayland" &&
      !environment.WAYLAND_DISPLAY) ||
    switches.some(
      (arg) =>
        arg === "--ozone-platform" || arg.startsWith("--ozone-platform="),
    )
  ) {
    return args;
  }

  // Clipboard polling and global shortcuts need XWayland on older GNOME.
  return ["--ozone-platform=x11", ...args];
}
