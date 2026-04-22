import log from "electron-log/main";

/**
 * Configure electron-log with colors and separators
 */
export function configureLogger(): void {
  // Initialize the logger
  log.initialize();

  // Add separator after each log by overriding the log functions
  const originalSilly = log.silly.bind(log);
  const originalInfo = log.info.bind(log);
  const originalWarn = log.warn.bind(log);
  const originalError = log.error.bind(log);
  const originalDebug = log.debug.bind(log);

  const isWindows = process.platform === "win32";
  // Use simple ASCII separator for Windows to avoid encoding issues
  // Use Unicode box drawing character for other platforms
  const separatorChar = isWindows ? "-" : "─";
  const separatorLine = separatorChar.repeat(80);

  // Windows terminals might not handle ANSI codes correctly by default
  // or might have issues with specific color codes combined with certain fonts
  // so we keep it simple for Windows
  const separator = isWindows
    ? separatorLine
    : `\x1b[90m${separatorLine}\x1b[0m`; // Gray separator for non-Windows

  log.silly = (...args) => {
    originalSilly(...args);
    console.log(separator);
  };

  log.info = (...args) => {
    originalInfo(...args);
    console.log(separator);
  };

  log.warn = (...args) => {
    originalWarn(...args);
    console.log(separator);
  };

  log.error = (...args) => {
    originalError(...args);
    console.log(separator);
  };

  log.debug = (...args) => {
    originalDebug(...args);
    console.log(separator);
  };
}
