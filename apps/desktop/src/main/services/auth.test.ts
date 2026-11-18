import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    currentUser: null as {
      uid: string;
      email?: string;
      displayName?: string;
    } | null,
    signOut: vi.fn(),
    authStateReady: vi.fn(),
  },
  signIn: vi.fn(),
  signup: vi.fn(),
  metadata: vi.fn(),
  saveMetadata: vi.fn(),
  addDevice: vi.fn(),
  addProfile: vi.fn(),
  updateProfile: vi.fn(),
  saveKey: vi.fn(),
  getKey: vi.fn(),
  clearAuth: vi.fn(),
  activate: vi.fn(),
  clearKey: vi.fn(),
  loaded: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
  getAuth: () => mocks.auth,
  signInWithEmailAndPassword: mocks.signIn,
  createUserWithEmailAndPassword: mocks.signup,
  updateProfile: mocks.updateProfile,
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("./firebase", () => ({
  getEncryptionMetadata: mocks.metadata,
  saveEncryptionMetadata: mocks.saveMetadata,
  addDevice: mocks.addDevice,
  addUserProfile: mocks.addProfile,
  wipeUserClips: vi.fn(),
  wipeUserDevices: vi.fn(),
  wipeEncryptionMetadata: vi.fn(),
}));
vi.mock("./secureStorage", () => ({
  authStorage: {
    saveMasterKey: mocks.saveKey,
    getMasterKey: mocks.getKey,
    clearAuth: mocks.clearAuth,
  },
}));
vi.mock("./crypto", () => ({
  clearActiveDEK: mocks.clearKey,
  setActiveDEK: mocks.activate,
  isKeyLoaded: mocks.loaded,
  generateDEK: () => Buffer.alloc(32, 1),
  generateSalt: () => "01".repeat(16),
  deriveKEK: () => Buffer.alloc(32, 2),
  wrapKey: () => "wrapped",
  unwrapKey: () => Buffer.alloc(32, 1),
}));
vi.mock("./clipboard", () => ({ stopClipboardSync: mocks.stop }));
vi.mock("../globalStates", () => ({ clearCachedClips: vi.fn() }));
vi.mock("electron-log/main", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("account lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    mocks.auth.currentUser = null;
    mocks.auth.signOut.mockImplementation(async () => {
      mocks.auth.currentUser = null;
    });
    mocks.signIn.mockImplementation(async () => {
      const user = { uid: "alice" };
      mocks.auth.currentUser = user;
      return { user };
    });
    mocks.metadata.mockResolvedValue({
      salt: "01".repeat(16),
      wrappedKey: "wrapped",
    });
    mocks.loaded.mockReturnValue(false);
  });

  it("does not overwrite keys when metadata is missing", async () => {
    mocks.metadata.mockResolvedValue(null);
    const auth = await import("./auth");
    await expect(
      auth.loginUser("synthetic@example.test", "synthetic"),
    ).rejects.toThrow("ERR_ENCRYPTION_METADATA_MISSING");
    expect(mocks.saveMetadata).not.toHaveBeenCalled();
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.auth.currentUser).toBeNull();
  });

  it("retains the submitted profile name when the auth profile update fails", async () => {
    const user = { uid: "alice", email: "synthetic@example.test" };
    mocks.signup.mockImplementation(async () => {
      mocks.auth.currentUser = user;
      return { user };
    });
    mocks.updateProfile.mockRejectedValue(new Error("profile unavailable"));
    const auth = await import("./auth");
    await auth.signupUser(user.email, "Synthetic User", "synthetic");
    expect(mocks.addProfile).toHaveBeenCalledWith(user, "Synthetic User");
    expect(mocks.activate).toHaveBeenCalledWith(expect.any(Buffer), "alice");
  });

  it("rejects overlapping authentication operations", async () => {
    const pending = deferred<{ salt: string; wrappedKey: string }>();
    mocks.metadata.mockReturnValue(pending.promise);
    const auth = await import("./auth");
    const first = auth.loginUser("synthetic@example.test", "synthetic");
    await expect(
      auth.loginUser("other@example.test", "synthetic"),
    ).rejects.toThrow("already in progress");
    pending.resolve({ salt: "01".repeat(16), wrappedKey: "wrapped" });
    await first;
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    expect(mocks.activate).toHaveBeenCalledWith(expect.any(Buffer), "alice");
  });

  it("rejects metadata completion after logout without activating a key", async () => {
    const pending = deferred<{ salt: string; wrappedKey: string }>();
    mocks.metadata.mockReturnValue(pending.promise);
    const auth = await import("./auth");
    const login = auth.loginUser("synthetic@example.test", "synthetic");
    const rejected = expect(login).rejects.toThrow("session changed");
    await Promise.resolve();
    await auth.logoutUser();
    pending.resolve({ salt: "01".repeat(16), wrappedKey: "wrapped" });
    await rejected;
    expect(mocks.saveKey).not.toHaveBeenCalled();
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.stop).toHaveBeenCalled();
  });

  it("undoes Firebase sign-in that completes after logout", async () => {
    const pending = deferred<{ user: { uid: string } }>();
    mocks.signIn.mockImplementation(async () => {
      const result = await pending.promise;
      mocks.auth.currentUser = result.user;
      return result;
    });
    const auth = await import("./auth");
    const login = auth.loginUser("synthetic@example.test", "synthetic");
    const rejected = expect(login).rejects.toThrow("session changed");
    await auth.logoutUser();
    pending.resolve({ user: { uid: "alice" } });
    await rejected;
    expect(mocks.auth.currentUser).toBeNull();
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it("clears late sign-in during an already pending sign-out", async () => {
    const signIn = deferred<{ user: { uid: string } }>();
    const signOut = deferred<void>();
    mocks.signIn.mockImplementation(async () => {
      const result = await signIn.promise;
      mocks.auth.currentUser = result.user;
      return result;
    });
    mocks.auth.signOut.mockImplementationOnce(async () => {
      mocks.auth.currentUser = null;
      await signOut.promise;
    });
    const auth = await import("./auth");
    const login = auth.loginUser("synthetic@example.test", "synthetic");
    const rejected = expect(login).rejects.toThrow("session changed");
    const logout = auth.logoutUser();
    await Promise.resolve();
    signIn.resolve({ user: { uid: "alice" } });
    await Promise.resolve();
    signOut.resolve(undefined);
    await logout;
    await rejected;
    expect(mocks.auth.currentUser).toBeNull();
  });
  it("fails closed when secure key persistence fails", async () => {
    mocks.saveKey.mockRejectedValue(
      new Error("OS-level encryption unavailable"),
    );
    const auth = await import("./auth");
    await expect(
      auth.loginUser("synthetic@example.test", "synthetic"),
    ).rejects.toThrow("OS-level encryption unavailable");
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.auth.currentUser).toBeNull();
  });

  it("ignores restored keys returned after an account change", async () => {
    const pending = deferred<Buffer>();
    mocks.getKey.mockReturnValue(pending.promise);
    mocks.auth.currentUser = { uid: "alice" };
    const auth = await import("./auth");
    const restore = auth.restoreAuthSession();
    await Promise.resolve();
    mocks.auth.currentUser = { uid: "bob" };
    pending.resolve(Buffer.alloc(32, 1));
    await expect(restore).resolves.toBeNull();
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.getKey).toHaveBeenCalledWith("alice");
  });

  it("still signs out if clearing local storage throws", async () => {
    mocks.clearAuth.mockImplementation(() => {
      throw new Error("disk unavailable");
    });
    const auth = await import("./auth");
    await expect(auth.logoutUser()).rejects.toThrow("disk unavailable");
    expect(mocks.auth.signOut).toHaveBeenCalled();
    expect(mocks.clearKey).toHaveBeenCalled();
  });

  it("does not activate a restored key after app work is invalidated", async () => {
    const pending = deferred<Buffer>();
    mocks.getKey.mockReturnValue(pending.promise);
    mocks.auth.currentUser = { uid: "alice" };
    const auth = await import("./auth");
    const restore = auth.restoreAuthSession();
    await Promise.resolve();
    auth.invalidateAuthWork();
    pending.resolve(Buffer.alloc(32, 1));
    await expect(restore).resolves.toBeNull();
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.auth.signOut).not.toHaveBeenCalled();
    expect(mocks.clearAuth).not.toHaveBeenCalled();
  });

  it("does not activate an interactive key after app work is invalidated", async () => {
    const pending = deferred<void>();
    mocks.saveKey.mockReturnValue(pending.promise);
    const auth = await import("./auth");
    const login = auth.loginUser("synthetic@example.test", "synthetic");
    const rejected = expect(login).rejects.toThrow("session changed");
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(mocks.saveKey).toHaveBeenCalledOnce();
    auth.invalidateAuthWork();
    pending.resolve(undefined);
    await rejected;
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it.each(["reset", "recover"] as const)(
    "does not register a device after cancelled %s metadata completes",
    async (operation) => {
      const metadata = deferred<void>();
      const signedOut = deferred<void>();
      mocks.saveMetadata.mockReturnValue(metadata.promise);
      mocks.auth.signOut.mockImplementationOnce(async () => {
        await signedOut.promise;
        mocks.auth.currentUser = null;
      });
      const auth = await import("./auth");
      const authentication =
        operation === "reset"
          ? auth.resetAccountData("synthetic@example.test", "synthetic")
          : auth.recoverAccountWithOldPassword(
              "synthetic@example.test",
              "synthetic",
              "old synthetic",
            );
      const rejected =
        expect(authentication).rejects.toThrow("session changed");
      for (let i = 0; i < 12; i++) await Promise.resolve();
      expect(mocks.saveMetadata).toHaveBeenCalledOnce();
      const logout = auth.logoutUser();
      await Promise.resolve();
      metadata.resolve(undefined);
      for (let i = 0; i < 12; i++) await Promise.resolve();
      expect(mocks.addDevice).not.toHaveBeenCalled();
      signedOut.resolve(undefined);
      await logout;
      await rejected;
      expect(mocks.activate).not.toHaveBeenCalled();
    },
  );

  it("revokes local access before a pending Firebase sign-out finishes", async () => {
    const signedOut = deferred<void>();
    mocks.auth.currentUser = { uid: "alice" };
    mocks.auth.signOut.mockReturnValueOnce(signedOut.promise);
    const auth = await import("./auth");
    let observed: unknown;
    const revoked = vi.fn(() => {
      observed = {
        revoked: auth.isSessionRevoked(),
        keyCleared: mocks.clearKey.mock.calls.length > 0,
        stopped: mocks.stop.mock.calls.length > 0,
        storageClears: mocks.clearAuth.mock.calls.length,
      };
    });
    const unsubscribe = auth.subscribeSessionRevoked(revoked);
    const logout = auth.logoutUser();
    expect(revoked).toHaveBeenCalledOnce();
    expect(observed).toEqual({
      revoked: true,
      keyCleared: true,
      stopped: true,
      storageClears: 0,
    });
    await Promise.resolve();
    expect(mocks.auth.signOut).toHaveBeenCalledOnce();
    signedOut.resolve(undefined);
    await logout;
    expect(auth.isSessionRevoked()).toBe(true);
    unsubscribe();
  });

  it("stays revoked after failed storage cleanup and sign-out and refuses residual keys", async () => {
    mocks.auth.currentUser = { uid: "alice" };
    mocks.clearAuth.mockImplementation(() => {
      throw new Error("disk unavailable");
    });
    mocks.auth.signOut.mockRejectedValue(new Error("sign-out unavailable"));
    mocks.getKey.mockResolvedValue(Buffer.alloc(32, 1));
    const auth = await import("./auth");
    const revoked = vi.fn();
    auth.subscribeSessionRevoked(revoked);
    await expect(auth.logoutUser()).rejects.toThrow("sign-out unavailable");
    expect(revoked).toHaveBeenCalledOnce();
    expect(auth.isSessionRevoked()).toBe(true);
    await expect(auth.restoreAuthSession()).resolves.toBeNull();
    expect(mocks.getKey).not.toHaveBeenCalled();
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it("isolates revocation listener failures and honors unsubscription", async () => {
    const auth = await import("./auth");
    const removed = vi.fn();
    const unsubscribe = auth.subscribeSessionRevoked(removed);
    unsubscribe();
    auth.subscribeSessionRevoked(() => {
      throw new Error("window teardown unavailable");
    });
    const subsequent = vi.fn();
    auth.subscribeSessionRevoked(subsequent);
    await expect(auth.logoutUser()).resolves.toBeUndefined();
    expect(removed).not.toHaveBeenCalled();
    expect(subsequent).toHaveBeenCalledOnce();
    expect(mocks.clearAuth).toHaveBeenCalledOnce();
    expect(mocks.auth.signOut).toHaveBeenCalledOnce();
  });

  it("starts a new explicit authentication generation and purges the old local UI", async () => {
    const auth = await import("./auth");
    await auth.logoutUser();
    expect(auth.isSessionRevoked()).toBe(true);
    let observed: unknown;
    const revoked = vi.fn(() => {
      observed = {
        revoked: auth.isSessionRevoked(),
        pending: auth.isAuthenticationPending(),
        signIns: mocks.signIn.mock.calls.length,
      };
    });
    auth.subscribeSessionRevoked(revoked);
    await auth.loginUser("synthetic@example.test", "synthetic");
    expect(revoked).toHaveBeenCalledOnce();
    expect(observed).toEqual({ revoked: false, pending: true, signIns: 0 });
    expect(auth.isSessionRevoked()).toBe(false);
    expect(mocks.activate).toHaveBeenCalledWith(expect.any(Buffer), "alice");
  });
});
