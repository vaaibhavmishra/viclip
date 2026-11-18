// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./theme-provider";

const SelectTheme = () => {
  const { setTheme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme("dark")}>
      Dark
    </button>
  );
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  localStorage.clear();
});

it("recovers from corrupt persisted theme values", async () => {
  localStorage.setItem("vite-ui-theme", "corrupt theme value");
  await act(async () =>
    root.render(
      <ThemeProvider>
        <div>Available</div>
      </ThemeProvider>,
    ),
  );
  expect(document.documentElement.classList.contains("light")).toBe(true);
  expect(host.textContent).toBe("Available");
});
it("keeps theme selection usable without local storage", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("denied");
  });
  await act(async () =>
    root.render(
      <ThemeProvider>
        <SelectTheme />
      </ThemeProvider>,
    ),
  );
  await act(async () => host.querySelector("button")?.click());
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});
