import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: {
      "@renderer": fileURLToPath(
        new URL("./src/renderer/src", import.meta.url),
      ),
    },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["out/**", "dist/**", "node_modules/**"],
    clearMocks: true,
    restoreMocks: true,
  },
});
