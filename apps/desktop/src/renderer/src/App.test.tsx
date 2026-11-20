// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const mocks = vi.hoisted(() => ({
  state: {
    platform: "",
    isLoading: true,
    user: null as { uid: string } | null,
  },
  initialize: vi.fn().mockResolvedValue(undefined),
  dispose: vi.fn(),
  minimize: vi.fn(),
  close: vi.fn(),
}));

vi.mock("./components/global-context", () => ({
  useGlobalStore: Object.assign(() => mocks.state, {
    getState: () => ({
      ...mocks.state,
      initialize: mocks.initialize,
      dispose: mocks.dispose,
    }),
  }),
}));
vi.mock("./pages/auth/AuthPage", () => ({
  AuthPage: () => <h1>Sign in to ViClip</h1>,
}));
vi.mock("./pages/MainContent", () => ({
  MainContent: () => <h1>Clipboard history</h1>,
}));
vi.mock("./pages/SettingsPanel", () => ({
  SettingsPanel: () => <h1>Clipboard settings</h1>,
}));

let host: HTMLDivElement;
let root: Root;
const electronDescriptor = Object.getOwnPropertyDescriptor(window, "electron");
const apiDescriptor = Object.getOwnPropertyDescriptor(window, "api");

function setPlatform(platform: string) {
  Object.defineProperty(window, "electron", {
    configurable: true,
    value: { process: { platform, versions: {} } },
  });
}

async function renderRoute(route: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>,
    );
  });
}

beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mocks.state.platform = "";
  mocks.state.isLoading = true;
  mocks.state.user = null;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  setPlatform("win32");
  Object.defineProperty(window, "api", {
    configurable: true,
    value: { minimizeWindow: mocks.minimize, closeWindow: mocks.close },
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  if (electronDescriptor)
    Object.defineProperty(window, "electron", electronDescriptor);
  else Reflect.deleteProperty(window, "electron");
  if (apiDescriptor) Object.defineProperty(window, "api", apiDescriptor);
  else Reflect.deleteProperty(window, "api");
});

describe("desktop window shell", () => {
  it.each([
    ["/auth", "ViClip — Login"],
    ["/settings", "ViClip — Settings"],
  ])(
    "keeps %s window controls usable before initialization",
    async (route, title) => {
      await renderRoute(route);

      const status = host.querySelector('[role="status"]');
      expect(status?.textContent).toContain("Loading ViClip");
      expect(status?.closest(".desktop-window")).not.toBeNull();
      expect(host.querySelector("header")?.textContent).toBe(title);
      expect(mocks.state.platform).toBe("");

      const minimize = host.querySelector<HTMLButtonElement>(
        '[aria-label="Minimize window"]',
      );
      const close = host.querySelector<HTMLButtonElement>(
        '[aria-label="Close window"]',
      );
      expect(minimize).not.toBeNull();
      expect(close).not.toBeNull();
      await act(async () => {
        minimize?.click();
        close?.click();
      });
      expect(mocks.minimize).toHaveBeenCalledExactlyOnceWith();
      expect(mocks.close).toHaveBeenCalledExactlyOnceWith();
    },
  );

  it.each([
    ["/auth", "Sign in to ViClip", null],
    ["/settings", "Clipboard settings", { uid: "account-a" }],
  ])(
    "retains the %s titlebar after loading finishes",
    async (route, content, user) => {
      mocks.state.isLoading = false;
      mocks.state.user = user;
      await renderRoute(route);

      expect(host.querySelector("h1")?.textContent).toBe(content);
      expect(host.querySelector('[role="status"]')).toBeNull();
      expect(host.querySelector('[aria-label="Close window"]')).not.toBeNull();
    },
  );

  it("keeps the clipboard popup free of a secondary titlebar", async () => {
    mocks.state.user = { uid: "account-a" };
    await renderRoute("/main");
    expect(host.querySelector('[role="status"]')).not.toBeNull();
    expect(host.querySelector("header")).toBeNull();

    mocks.state.isLoading = false;
    await renderRoute("/main");
    expect(host.querySelector("h1")?.textContent).toBe("Clipboard history");
    expect(host.querySelector("header")).toBeNull();
  });

  it.each(["/auth", "/settings"])(
    "preserves macOS native controls for %s",
    async (route) => {
      setPlatform("darwin");
      await renderRoute(route);

      expect(
        host.querySelector('[role="status"]')?.closest(".desktop-window"),
      ).not.toBeNull();
      expect(host.querySelector("header")).toBeNull();
      expect(host.querySelector('[aria-label="Close window"]')).toBeNull();
    },
  );
});
