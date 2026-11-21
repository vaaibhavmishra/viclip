export function getDefaultShortcut(platform: string): string {
  return platform === "darwin" ? "CommandOrControl+Shift+V" : "Alt+Shift+V";
}
