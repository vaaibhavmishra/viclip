import type { ClipData } from "@viclip/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { uid: "account-a" } as { uid: string } | null,
  generation: 0,
  keyUser: "account-a",
  text: "baseline",
  formats: ["text/plain"],
  cache: {} as Record<string, ClipData>,
  listener: null as ((clips: Record<string, ClipData>) => void) | null,
  listenerError: null as (() => void) | null,
  readText: vi.fn(),
  read: vi.fn(),
  writeText: vi.fn(),
  addClip: vi.fn(),
  updateClip: vi.fn(),
  enforceClipLimit: vi.fn(),
  getClips: vi.fn(),
  unsubscribe: vi.fn(),
  listenClips: vi.fn(),
  send: vi.fn(),
  notification: vi.fn(),
}));

vi.mock("electron", () => ({
  clipboard: {
    readText: mocks.readText,
    read: mocks.read,
    writeText: mocks.writeText,
  },
}));
vi.mock("electron-log/main", () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: mocks.user }),
}));
vi.mock("./auth", () => ({ getAuthGeneration: () => mocks.generation }));
vi.mock("./crypto", () => ({
  isKeyLoaded: (userId?: string) =>
    !!mocks.keyUser && (!userId || userId === mocks.keyUser),
  getActiveDEK: (userId?: string) => {
    if (!mocks.keyUser || (userId && userId !== mocks.keyUser))
      throw new Error("Missing key");
    return new Uint8Array(32);
  },
  encrypt: (text: string) => `encrypted:${text}`,
  decrypt: (text: string) => {
    if (!text.startsWith("encrypted:"))
      throw new Error("Invalid or tampered payload");
    return text.slice("encrypted:".length);
  },
}));
vi.mock("./firebase", () => ({
  addClip: mocks.addClip,
  updateClip: mocks.updateClip,
  enforceClipLimit: mocks.enforceClipLimit,
  getClips: mocks.getClips,
  listenClips: mocks.listenClips,
}));
vi.mock("./settings", () => ({
  settingsStorage: { getOrCreateDeviceId: () => "device-local" },
}));
vi.mock("../globalStates", () => ({
  clearCachedClips: () => {
    mocks.cache = {};
  },
  getCachedClips: () => mocks.cache,
  setCachedClips: (clips: Record<string, ClipData>) => {
    mocks.cache = clips;
  },
  getSettingsWindow: () => null,
  getMainWindow: () => ({
    isDestroyed: () => false,
    webContents: { send: mocks.send },
  }),
}));
vi.mock("../modules/notification", () => ({
  showNotification: mocks.notification,
}));
vi.mock("../utils/utils", () => ({
  detectClipboardType: () => "text",
  isConcealedClipboard: (formats: string[]) =>
    formats.includes("org.nspasteboard.ConcealedType"),
}));

import {
  getDecryptedClips,
  isClipboardSyncActive,
  startClipboardSync,
  stopClipboardSync,
  writeToClipboard,
} from "./clipboard";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 15; i++) await Promise.resolve();
}

function makeClip(id: string, content: string, seconds = 1): ClipData {
  return {
    id,
    content,
    type: "text",
    timestamp: `2026-01-01T00:00:${String(seconds).padStart(2, "0")}.000Z`,
    sourceDevice: "remote",
    sourceDeviceId: "device-remote",
  };
}

async function start(): Promise<void> {
  expect(startClipboardSync()).toBe(true);
  await flush();
  expect(mocks.listener).toBeTypeOf("function");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:01:00Z"));
  mocks.user = { uid: "account-a" };
  mocks.generation = 0;
  mocks.keyUser = "account-a";
  mocks.text = "baseline";
  mocks.formats = ["text/plain"];
  mocks.cache = {};
  mocks.listener = null;
  mocks.listenerError = null;
  for (const mock of [
    mocks.readText,
    mocks.read,
    mocks.writeText,
    mocks.addClip,
    mocks.updateClip,
    mocks.enforceClipLimit,
    mocks.getClips,
    mocks.unsubscribe,
    mocks.listenClips,
    mocks.send,
    mocks.notification,
  ])
    mock.mockReset();
  mocks.readText.mockImplementation(async () => mocks.text);
  mocks.read.mockImplementation(async () => {
    const snapshotText = mocks.text;
    return [
      {
        types: [...mocks.formats],
        getType: async () => new Blob([snapshotText]),
      },
    ];
  });
  mocks.writeText.mockImplementation(async (content: string) => {
    mocks.text = content;
  });
  mocks.addClip.mockResolvedValue(undefined);
  mocks.updateClip.mockResolvedValue(undefined);
  mocks.enforceClipLimit.mockResolvedValue(undefined);
  mocks.listenClips.mockImplementation(
    (
      _uid: string,
      listener: (clips: Record<string, ClipData>) => void,
      onError: () => void,
    ) => {
      mocks.listener = listener;
      mocks.listenerError = onError;
      return mocks.unsubscribe;
    },
  );
});

afterEach(async () => {
  stopClipboardSync();
  await flush();
  vi.useRealTimers();
});

describe("clipboard synchronization regressions", () => {
  it("does not create timers or listeners after stop during asynchronous startup", async () => {
    const read = deferred<string>();
    mocks.readText.mockReturnValueOnce(read.promise);
    startClipboardSync();
    stopClipboardSync();
    read.resolve("old account clipboard");
    await flush();
    expect(mocks.listenClips).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(isClipboardSyncActive()).toBe(false);
  });

  it("makes repeated initialization idempotent and clears cooldown resources", async () => {
    await start();
    expect(startClipboardSync()).toBe(true);
    expect(mocks.listenClips).toHaveBeenCalledTimes(1);
    mocks.listener?.({ newest: makeClip("newest", "encrypted:remote text") });
    await flush();
    expect(mocks.writeText).toHaveBeenCalledOnce();
    stopClipboardSync();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retries failed uploads and retains history until a write succeeds", async () => {
    await start();
    mocks.text = "retry me";
    mocks.addClip.mockRejectedValueOnce(new Error("offline"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.addClip).toHaveBeenCalledTimes(1);
    expect(mocks.enforceClipLimit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4000);
    expect(mocks.addClip).toHaveBeenCalledTimes(2);
    expect(mocks.addClip).toHaveBeenLastCalledWith(
      "account-a",
      "encrypted:retry me",
      "text",
    );
    expect(mocks.enforceClipLimit).toHaveBeenCalledOnce();
  });

  it("prevents overlapping polls while the native read is pending", async () => {
    await start();
    const read = deferred<never[]>();
    mocks.read.mockReturnValueOnce(read.promise);
    await vi.advanceTimersByTimeAsync(4000);
    expect(mocks.read).toHaveBeenCalledTimes(1);
    read.resolve([]);
    await flush();
  });

  it("reads text from the inspected item and never rereads independently during polling", async () => {
    await start();
    mocks.text = "snapshot content";
    mocks.readText.mockResolvedValue(
      "concealed password copied after snapshot",
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.readText).toHaveBeenCalledTimes(1);
    expect(mocks.addClip).toHaveBeenCalledWith(
      "account-a",
      "encrypted:snapshot content",
      "text",
    );
  });

  it("skips concealed, empty, unsupported and oversized clipboard data", async () => {
    await start();
    mocks.text = "password";
    mocks.formats = [
      "text/plain",
      'electron application/osclipboard;format="org.nspasteboard.ConcealedType"',
    ];
    await vi.advanceTimersByTimeAsync(1000);
    mocks.formats = ["image/png"];
    await vi.advanceTimersByTimeAsync(1000);
    mocks.formats = ["text/plain"];
    mocks.text = "";
    await vi.advanceTimersByTimeAsync(1000);
    mocks.text = "x".repeat(1_000_001);
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.addClip).not.toHaveBeenCalled();
  });

  it("does not upload without a key for the authenticated account", async () => {
    mocks.keyUser = "other-account";
    expect(startClipboardSync()).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.addClip).not.toHaveBeenCalled();
  });

  it("ignores callbacks and native reads from a previous authentication generation", async () => {
    await start();
    const oldListener = mocks.listener;
    const read = deferred<never[]>();
    mocks.read.mockReturnValueOnce(read.promise);
    await vi.advanceTimersByTimeAsync(1000);
    mocks.generation++;
    mocks.user = { uid: "account-b" };
    mocks.keyUser = "account-b";
    oldListener?.({ old: makeClip("old", "encrypted:old account secret") });
    read.resolve([]);
    await flush();
    expect(mocks.writeText).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalledWith(
      "clips-updated",
      expect.anything(),
    );
    expect(mocks.addClip).not.toHaveBeenCalled();
  });

  it("omits corrupted and plaintext clips and never pastes fallback content", async () => {
    await start();
    mocks.listener?.({ bad: makeClip("bad", "legacy plaintext") });
    await flush();
    expect(mocks.cache).toEqual({});
    expect(mocks.writeText).not.toHaveBeenCalled();
    mocks.listener?.({
      null: null,
      invalid: { content: "malformed" },
      array: [],
    } as unknown as Record<string, ClipData>);
    await flush();
    expect(mocks.cache).toEqual({});
    expect(mocks.writeText).not.toHaveBeenCalled();
  });

  it("avoids a feedback upload after receiving a remote clip", async () => {
    await start();
    mocks.listener?.({ newest: makeClip("newest", "encrypted:remote") });
    await flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.writeText).toHaveBeenCalledTimes(1);
    expect(mocks.addClip).not.toHaveBeenCalled();
  });

  it("does not recycle older clipboard contents when the newest clip is deleted", async () => {
    await start();
    const older = makeClip("older", "encrypted:older", 1);
    const newer = makeClip("newer", "encrypted:newer", 2);
    mocks.listener?.({ older, newer });
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    mocks.listener?.({ older });
    await flush();
    expect(mocks.writeText).toHaveBeenCalledTimes(1);
    expect(mocks.text).toBe("newer");
    expect(mocks.cache).toEqual({ older: { ...older, content: "older" } });
  });

  it("queues remote updates received during a local upload instead of losing them", async () => {
    await start();
    mocks.text = "local copy";
    const upload = deferred<void>();
    mocks.addClip.mockReturnValueOnce(upload.promise);
    await vi.advanceTimersByTimeAsync(1000);
    mocks.listener?.({
      remote: makeClip("remote", "encrypted:remote copy", 2),
    });
    await flush();
    expect(mocks.writeText).not.toHaveBeenCalled();
    upload.resolve();
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.writeText).toHaveBeenCalledWith("remote copy");
  });

  it("updates duplicates instead of adding another clip", async () => {
    await start();
    mocks.text = "same copy";
    mocks.cache = { duplicate: makeClip("duplicate", "same copy") };
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.updateClip).toHaveBeenCalledWith(
      "account-a",
      "duplicate",
      expect.objectContaining({ sourceDeviceId: "device-local" }),
    );
    expect(mocks.addClip).not.toHaveBeenCalled();
  });

  it("propagates native write failures and does not suppress a later local upload", async () => {
    await start();
    mocks.writeText.mockRejectedValueOnce(new Error("native failure"));
    await expect(writeToClipboard("not actually copied")).rejects.toThrow(
      "native failure",
    );
    mocks.text = "not actually copied";
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.addClip).toHaveBeenCalledWith(
      "account-a",
      "encrypted:not actually copied",
      "text",
    );
  });

  it("does not return fetched data after account switch", async () => {
    const fetch = deferred<Record<string, ClipData>>();
    mocks.getClips.mockReturnValueOnce(fetch.promise);
    const result = getDecryptedClips();
    mocks.generation++;
    mocks.user = { uid: "account-b" };
    mocks.keyUser = "account-b";
    fetch.resolve({ old: makeClip("old", "encrypted:old account") });
    await expect(result).rejects.toThrow("Account changed");
  });
  it("discards queued remote data deleted before a local upload completes", async () => {
    await start();
    mocks.text = "local";
    const upload = deferred<void>();
    mocks.addClip.mockReturnValueOnce(upload.promise);
    await vi.advanceTimersByTimeAsync(1000);
    mocks.listener?.({ remote: makeClip("remote", "encrypted:deleted") });
    mocks.listener?.({});
    upload.resolve();
    await flush();
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.writeText).not.toHaveBeenCalled();
    expect(mocks.cache).toEqual({});
  });

  it("does not revive deleted remote data after a native write rejects", async () => {
    await start();
    const write = deferred<void>();
    mocks.writeText.mockReturnValueOnce(write.promise);
    mocks.listener?.({ remote: makeClip("remote", "encrypted:deleted") });
    await flush();
    mocks.listener?.({});
    write.reject(new Error("native failure"));
    await flush();
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.writeText).toHaveBeenCalledTimes(1);
  });

  it("does not recycle an older equal-timestamp clip after deleting the newest", async () => {
    await start();
    mocks.listener?.({
      a: makeClip("a", "encrypted:old"),
      z: makeClip("z", "encrypted:new"),
    });
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    mocks.listener?.({ a: makeClip("a", "encrypted:old") });
    await flush();
    expect(mocks.text).toBe("new");
    expect(mocks.writeText).toHaveBeenCalledTimes(1);
  });

  it("clears all timers even if listener teardown throws", async () => {
    await start();
    mocks.listener?.({ remote: makeClip("remote", "encrypted:remote") });
    await flush();
    mocks.unsubscribe.mockImplementationOnce(() => {
      throw new Error("teardown failure");
    });
    expect(() => stopClipboardSync()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("stops sync, clears resources and reports permanent listener cancellation", async () => {
    await start();
    mocks.listenerError?.();
    expect(isClipboardSyncActive()).toBe(false);
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(mocks.cache).toEqual({});
    expect(mocks.send).toHaveBeenCalledWith("sync-state-changed", false);
    expect(mocks.notification).toHaveBeenCalledWith(
      "Clipboard Sync",
      expect.stringContaining("Synchronization stopped"),
    );
  });

  it("does not paste remote data deleted while its native write is queued", async () => {
    await start();
    const nativeWrite = deferred<void>();
    mocks.writeText.mockReturnValueOnce(nativeWrite.promise);
    const chosenCopy = writeToClipboard("chosen copy");
    await flush();
    mocks.listener?.({ remote: makeClip("remote", "encrypted:deleted copy") });
    await flush();
    mocks.listener?.({});
    nativeWrite.resolve();
    await chosenCopy;
    await flush();
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.writeText).toHaveBeenCalledTimes(1);
    expect(mocks.writeText).not.toHaveBeenCalledWith("deleted copy");
  });

  it("retries a failed retention operation without uploading the clip again", async () => {
    await start();
    mocks.text = "persisted copy";
    mocks.enforceClipLimit.mockRejectedValueOnce(new Error("offline pruning"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.addClip).toHaveBeenCalledOnce();
    expect(mocks.enforceClipLimit).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(6000);
    expect(mocks.enforceClipLimit).toHaveBeenCalledTimes(2);
    expect(mocks.addClip).toHaveBeenCalledOnce();
  });

  it("preserves the feedback sentinel of a manual copy during a local upload", async () => {
    await start();
    const upload = deferred<void>();
    mocks.addClip.mockReturnValueOnce(upload.promise);
    mocks.text = "local snapshot";
    await vi.advanceTimersByTimeAsync(1000);
    await writeToClipboard("manually selected copy");
    upload.resolve();
    await flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.addClip).toHaveBeenCalledOnce();
    expect(mocks.updateClip).not.toHaveBeenCalled();
  });

  it("preserves a manual copy made while the initial native read is pending", async () => {
    const read = deferred<string>();
    mocks.readText.mockReturnValueOnce(read.promise);
    expect(startClipboardSync()).toBe(true);
    await writeToClipboard("manually selected copy");
    read.resolve("previous clipboard snapshot");
    await flush();
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.addClip).not.toHaveBeenCalled();
    expect(mocks.updateClip).not.toHaveBeenCalled();
  });
});
