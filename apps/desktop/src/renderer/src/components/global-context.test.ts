import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const user = {
  uid: "synthetic-user",
  email: "user@example.invalid",
  displayName: "User",
  photoURL: null,
};
let listener: (value: string | null) => void;
let unsubscribe: ReturnType<typeof vi.fn>;
let store: typeof import("./global-context").useGlobalStore;

beforeEach(async () => {
  vi.resetModules();
  unsubscribe = vi.fn();
  vi.stubGlobal("window", {
    api: {
      getCurrentUser: vi.fn().mockResolvedValue(user),
      getPlatform: vi.fn().mockResolvedValue("darwin"),
      onAuthStateChanged: vi.fn((callback) => {
        listener = callback;
        return unsubscribe;
      }),
    },
  });
  store = (await import("./global-context")).useGlobalStore;
});
afterEach(() => {
  store.getState().dispose();
  vi.unstubAllGlobals();
});

describe("renderer authentication state", () => {
  it("installs one listener across repeated initialization and disposes it", async () => {
    await Promise.all([
      store.getState().initialize(),
      store.getState().initialize(),
    ]);
    expect(window.api.onAuthStateChanged).toHaveBeenCalledTimes(1);
    store.getState().dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
  it("does not let initial user lookup restore a logged-out user", async () => {
    const initial = deferred<typeof user>();
    vi.mocked(window.api.getCurrentUser).mockReturnValueOnce(initial.promise);
    const ready = store.getState().initialize();
    listener(null);
    initial.resolve(user);
    await ready;
    expect(store.getState().user).toBeNull();
  });
  it("ignores late refresh results after logout", async () => {
    await store.getState().initialize();
    const refresh = deferred<typeof user>();
    vi.mocked(window.api.getCurrentUser).mockReturnValueOnce(refresh.promise);
    listener("User");
    listener(null);
    refresh.resolve(user);
    await refresh.promise;
    expect(store.getState().user).toBeNull();
  });
  it("ignores initialization completing after disposal", async () => {
    const initial = deferred<typeof user>();
    vi.mocked(window.api.getCurrentUser).mockReturnValueOnce(initial.promise);
    const ready = store.getState().initialize();
    store.getState().dispose();
    initial.resolve(user);
    await ready;
    expect(store.getState().user).toBeNull();
  });
  it("ignores a queued event from a disposed listener", async () => {
    await store.getState().initialize();
    const disposedListener = listener;
    store.getState().dispose();
    await store.getState().initialize();
    disposedListener(null);
    expect(store.getState().user).toEqual(user);
  });
  it("handles failed auth refresh without an unhandled rejection", async () => {
    await store.getState().initialize();
    vi.mocked(window.api.getCurrentUser).mockRejectedValueOnce(
      new Error("unavailable"),
    );
    listener("User");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(store.getState().user).toBeNull();
  });
});
