const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule, deferred } = require("./helpers/load-module.cjs");
const source = "services/auth.ts";

function fixture(options = {}) {
  const calls = [];
  let session = null;
  let loaded = false;
  const auth = {
    currentUser: null,
    async signOut() {
      calls.push(["signOut"]);
      auth.currentUser = null;
    },
  };
  const authenticate = async () => {
    if (options.signIn) await options.signIn.promise;
    const user = {
      uid: "synthetic-account",
      delete: async () => calls.push(["deleteUser"]),
    };
    auth.currentUser = user;
    calls.push(["authenticate"]);
    return { user };
  };
  const crypto = {
    clearActiveDEK: () => {
      loaded = false;
      calls.push(["clearKey"]);
    },
    isKeyLoaded: () => loaded,
    generateDEK: () => Buffer.alloc(32, 1),
    generateSalt: () => "ab".repeat(16),
    deriveKEK: () => Buffer.alloc(32, 2),
    deriveKEKAsync: options.derive || (async () => Buffer.alloc(32, 2)),
    unwrapKey: () => {
      if (options.corrupt) throw new Error("Synthetic corrupted wrapped key");
      return Buffer.alloc(32, 1);
    },
    wrapKey: () => "synthetic-wrapped-key",
    setActiveDEK: (_key, uid) => {
      loaded = true;
      calls.push(["setKey", uid]);
    },
  };
  const storage = {
    clearAuth: async () => calls.push(["clearStorage"]),
    saveMasterKey: (_key, uid) => {
      if (options.storageFailure)
        throw new Error("Synthetic secure storage failure");
      calls.push(["saveKey", uid]);
    },
  };
  const service = loadModule(source, {
    "@react-native-firebase/auth": {
      getAuth: () => auth,
      signInWithEmailAndPassword: authenticate,
      createUserWithEmailAndPassword: authenticate,
      updateProfile: async () => {},
      sendPasswordResetEmail: async () => {},
    },
    "@react-native-firebase/messaging": {
      getMessaging: () => ({}),
      getToken: async () => {
        calls.push(["getToken"]);
        return "synthetic-token";
      },
    },
    "./crypto": crypto,
    "./secureStorage": { authStorage: storage },
    "./pushSession": {
      beginPushSession: (userId) => {
        session = { userId, id: "synthetic-session" };
        return session;
      },
      isPushSessionCurrent: (expected) =>
        expected === session && expected?.userId === auth.currentUser?.uid,
      suspendPushSession: () => {
        session = null;
        return () => session === null;
      },
    },
    "./firebase": {
      getEncryptionMetadata: async () =>
        options.missing
          ? null
          : { salt: "ab".repeat(16), wrappedKey: "wrapped" },
      saveEncryptionMetadata: async () => calls.push(["saveMetadata"]),
      addUserProfile: async () => calls.push(["profile"]),
      addDevice: async (...args) => calls.push(["device", ...args]),
      clearDeviceFCMTokenForLogout: async () => calls.push(["clearToken"]),
      wipeUserClips: async () => calls.push(["wipeClips"]),
      wipeUserDevices: async () => calls.push(["wipeDevices"]),
      wipeEncryptionMetadata: async () => calls.push(["wipeMetadata"]),
    },
  });
  return { service, auth, calls, loaded: () => loaded };
}

const tick = () => new Promise(setImmediate);

test("a Firebase sign-in resolving after logout cannot restore keys or registration", async () => {
  const signIn = deferred();
  const f = fixture({ signIn });
  const login = f.service.loginUser(
    "synthetic@example.invalid",
    "synthetic-password",
  );
  await tick();
  await f.service.logoutUser();
  signIn.resolve();
  await assert.rejects(login, /AUTH_CANCELLED|SESSION_CHANGED/);
  assert.equal(f.auth.currentUser, null);
  assert.equal(f.loaded(), false);
  assert.equal(
    f.calls.some(([kind]) => ["saveKey", "setKey", "device"].includes(kind)),
    false,
  );
});

test("concurrent authentication attempts are rejected before calling Firebase twice", async () => {
  const signIn = deferred();
  const f = fixture({ signIn });
  const login = f.service.loginUser("a@example.invalid", "synthetic-password");
  await tick();
  await assert.rejects(
    f.service.loginUser("b@example.invalid", "synthetic-password"),
    /already in progress/,
  );
  signIn.resolve();
  await login;
  assert.equal(f.calls.filter(([kind]) => kind === "authenticate").length, 1);
});

test("late native key derivation cannot re-activate a logged-out session", async () => {
  const derived = deferred();
  const f = fixture({ derive: () => derived.promise });
  const login = f.service.loginUser("a@example.invalid", "synthetic-password");
  await tick();
  await f.service.logoutUser();
  derived.resolve(Buffer.alloc(32, 2));
  await assert.rejects(login, /AUTH_CANCELLED|SESSION_CHANGED/);
  assert.equal(f.loaded(), false);
  assert.equal(
    f.calls.some(([kind]) => kind === "saveKey"),
    false,
  );
});

test("missing metadata never silently replaces encrypted-account keys", async () => {
  const f = fixture({ missing: true });
  await assert.rejects(
    f.service.loginUser("a@example.invalid", "synthetic-password"),
    /METADATA_MISSING/,
  );
  assert.equal(f.auth.currentUser, null);
  assert.equal(
    f.calls.some(([kind]) => kind === "saveMetadata" || kind === "setKey"),
    false,
  );
});

test("corrupt wrapped keys fail authentication and clear the partial session", async () => {
  const f = fixture({ corrupt: true });
  await assert.rejects(
    f.service.loginUser("a@example.invalid", "synthetic-password"),
    /KEY_DECRYPTION_FAILED/,
  );
  assert.equal(f.auth.currentUser, null);
  assert.equal(f.loaded(), false);
});

test("secure storage failure is reported as storage failure and signs out", async () => {
  const f = fixture({ storageFailure: true });
  await assert.rejects(
    f.service.loginUser("a@example.invalid", "synthetic-password"),
    /secure storage failure/,
  );
  assert.equal(f.auth.currentUser, null);
  assert.equal(f.loaded(), false);
});

test("login keys are associated with UID and push permissions remain provider-owned", async () => {
  const f = fixture();
  await f.service.loginUser("a@example.invalid", "synthetic-password");
  assert.deepEqual(
    f.calls.find(([kind]) => kind === "saveKey"),
    ["saveKey", "synthetic-account"],
  );
  assert.deepEqual(
    f.calls.find(([kind]) => kind === "setKey"),
    ["setKey", "synthetic-account"],
  );
  assert.equal(
    f.calls.some(([kind]) => kind === "getToken"),
    false,
  );
  assert.equal(f.calls.find(([kind]) => kind === "device")[2], undefined);
});
