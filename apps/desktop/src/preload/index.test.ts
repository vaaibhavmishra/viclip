import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PreloadAPI } from "./index.d";

const mocks = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  invoke: vi.fn(),
  send: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));
vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, value: unknown) => {
      mocks.exposed.set(name, value);
    },
  },
  ipcRenderer: {
    invoke: mocks.invoke,
    send: mocks.send,
    on: mocks.on,
    removeListener: mocks.removeListener,
  },
}));
const isolationDescriptor = Object.getOwnPropertyDescriptor(
  process,
  "contextIsolated",
);

beforeEach(() => {
  vi.resetModules();
  mocks.exposed.clear();
  mocks.invoke.mockResolvedValue(undefined);
  Object.defineProperty(process, "contextIsolated", {
    value: true,
    configurable: true,
  });
});
afterEach(() => {
  if (isolationDescriptor)
    Object.defineProperty(process, "contextIsolated", isolationDescriptor);
  else Reflect.deleteProperty(process, "contextIsolated");
});

describe("preload bridge", () => {
  it("exposes named capabilities without unrestricted IPC or native process access", async () => {
    await import("./index");
    const api = mocks.exposed.get("api") as PreloadAPI;
    expect(mocks.exposed.size).toBe(2);
    const electron = mocks.exposed.get("electron");
    expect(Object.keys(electron as object)).toEqual(["process"]);
    expect(Object.keys((electron as { process: object }).process)).toEqual([
      "platform",
      "versions",
    ]);
    expect(api).not.toHaveProperty("ipcRenderer");
    expect(api).not.toHaveProperty("send");
    expect(api).not.toHaveProperty("invoke");
    await api.removeClip("clip-1");
    expect(mocks.invoke).toHaveBeenCalledWith("remove-clip", "clip-1");
  });

  it("strips native events from all subscriptions and returns precise disposers", async () => {
    await import("./index");
    const api = mocks.exposed.get("api") as PreloadAPI;
    const clips = vi.fn();
    const auth = vi.fn();
    const sync = vi.fn();
    const disposers = [
      api.onClipsUpdate(clips),
      api.onAuthStateChanged(auth),
      api.onSyncStateChanged(sync),
    ];
    const nativeEvent = { sender: "privileged object" };
    const values = [{}, "Synthetic", false];
    mocks.on.mock.calls.forEach(([channel, listener], index) => {
      expect(channel).toBe(
        ["clips-updated", "auth-state-changed", "sync-state-changed"][index],
      );
      listener(nativeEvent, values[index]);
    });
    expect(clips).toHaveBeenCalledExactlyOnceWith({});
    expect(auth).toHaveBeenCalledExactlyOnceWith("Synthetic");
    expect(sync).toHaveBeenCalledExactlyOnceWith(false);
    disposers.forEach((dispose) => {
      dispose();
    });
    expect(mocks.removeListener.mock.calls).toEqual(mocks.on.mock.calls);
  });

  it("fails closed when context isolation is disabled", async () => {
    Object.defineProperty(process, "contextIsolated", {
      value: false,
      configurable: true,
    });
    await expect(import("./index")).rejects.toThrow(
      "requires context isolation",
    );
    expect(mocks.exposed.size).toBe(0);
  });
});
