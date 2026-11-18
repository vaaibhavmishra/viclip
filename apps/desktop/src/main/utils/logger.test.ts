import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  ipc: { level: "info" as string | boolean },
}));
vi.mock("electron-log/main", () => ({
  default: {
    initialize: mocks.initialize,
    transports: { ipc: mocks.ipc },
    silly: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { configureLogger } from "./logger";

describe("main-process logging isolation", () => {
  it("does not inject electron-log's unrestricted renderer IPC bridge and initializes once", () => {
    configureLogger();
    configureLogger();
    expect(mocks.initialize).toHaveBeenCalledExactlyOnceWith({
      preload: false,
    });
    expect(mocks.ipc.level).toBe(false);
  });
});
