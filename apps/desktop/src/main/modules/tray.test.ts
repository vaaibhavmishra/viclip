import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  warn: vi.fn(),
  menu: [] as Array<{ label?: string; click?: () => void }>,
  tray: null as { isDestroyed: () => boolean; destroy: () => void } | null,
}));
vi.mock("electron", () => ({
  app: { quit: vi.fn() },
  Menu: {
    buildFromTemplate: (items: typeof mocks.menu) => {
      mocks.menu = items;
      return items;
    },
  },
  Tray: class {
    isDestroyed = () => false;
    destroy = vi.fn();
    setToolTip = vi.fn();
    setContextMenu = vi.fn();
    on = vi.fn();
  },
}));
vi.mock("electron-log/main", () => ({ default: { warn: mocks.warn } }));
vi.mock("../globalStates", () => ({
  getTray: () => mocks.tray,
  setTray: (tray: typeof mocks.tray) => {
    mocks.tray = tray;
  },
}));
vi.mock("../services/update", () => ({ checkUpdate: mocks.update }));
vi.mock("./window", () => ({ showWindow: vi.fn() }));
vi.mock("../../../resources/tray@2x.png?asset", () => ({
  default: "synthetic-icon",
}));
vi.mock("../../../resources/tray-light@2x.png?asset", () => ({
  default: "synthetic-icon",
}));
vi.mock("../../../resources/trayTemplate@2x.png?asset", () => ({
  default: "synthetic-icon",
}));

beforeEach(() => {
  mocks.tray = null;
});

it("handles rejected manual update checks instead of leaving a rejected main-process promise", async () => {
  mocks.update.mockRejectedValue(new Error("synthetic offline failure"));
  const { createTray } = await import("./tray");
  createTray();
  mocks.menu.find((item) => item.label === "Check for Updates...")?.click?.();
  await Promise.resolve();
  await Promise.resolve();
  expect(mocks.update).toHaveBeenCalledWith({ isManual: true });
  expect(mocks.warn).toHaveBeenCalledWith("Manual update check failed");
});
