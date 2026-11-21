import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import { getLinuxDisplayArgs } from "./src/shared/linuxDisplay";

// Supply Ozone's backend before Electron starts, keeping the dev server alive.
const launchArgs: string[] = JSON.parse(process.env.ELECTRON_CLI_ARGS || "[]");
const displayArgs = getLinuxDisplayArgs(
  launchArgs,
  process.platform,
  process.env,
);
if (displayArgs !== launchArgs) {
  process.env.ELECTRON_CLI_ARGS = JSON.stringify(displayArgs);
}

export default defineConfig({
  main: {
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
  },
  preload: {
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@shared": resolve("src/shared"),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
