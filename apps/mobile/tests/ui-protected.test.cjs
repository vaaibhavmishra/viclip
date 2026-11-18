const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule, deferred } = require("./helpers/load-module.cjs");
const {
  createScreenHost,
  native,
  findAll,
} = require("./helpers/render-screen.cjs");
const flush = () => new Promise((resolve) => setImmediate(resolve));

function protectedScreen(options = {}) {
  const host = createScreenHost();
  const state = {
    keyOwner: null,
    restoredUsers: [],
    removals: 0,
    logouts: 0,
    unsubscribe: 0,
    authListener: null,
    removed: null,
  };
  const auth = {
    currentUser: { uid: "account-a" },
    onAuthStateChanged(callback) {
      state.authListener = callback;
      callback(auth.currentUser);
      return () => {
        state.unsubscribe++;
      };
    },
  };
  const session = { userId: "account-a", id: "session-a" };
  const mocks = {
    react: host.React,
    "react-native": native,
    "@react-native-firebase/auth": { getAuth: () => auth },
    "expo-router": {
      Redirect: "Redirect",
      Stack: "Stack",
      router: { replace() {} },
    },
    "react-native-toast-message": { show() {} },
    "@/services/backgroundSync": { BackgroundSyncProvider: "Provider" },
    "@/utils/statesContext": { StateProvider: "StateProvider" },
    "@/services/pushSession": {
      capturePushSession: (uid) => (uid === "account-a" ? session : null),
      isPushSessionCurrent: (value) =>
        value === session && auth.currentUser?.uid === session.userId,
    },
    "@/services/crypto": {
      isKeyLoaded: (uid = auth.currentUser?.uid) => state.keyOwner === uid,
      setActiveDEK: (_key, uid) => {
        state.keyOwner = uid;
      },
    },
    "@/services/secureStorage": {
      authStorage: {
        getMasterKey(uid) {
          state.restoredUsers.push(uid);
          if (options.storageFails) throw new Error("locked");
          return Buffer.alloc(32);
        },
      },
    },
    "@/services/firebase": {
      getDeviceId: () =>
        options.deviceId?.promise || Promise.resolve("installation-id"),
      getCurrentDeviceName: () => "Test device",
      listenOwnDeviceRemoval: (_name, callback) => {
        state.removals++;
        state.removed = callback;
        return () => {
          state.unsubscribe++;
        };
      },
    },
    "@/services/auth": {
      logoutUser: async () => {
        state.logouts++;
        state.keyOwner = null;
        auth.currentUser = null;
      },
    },
  };
  const Screen = loadModule("app/(protected)/_layout.tsx", mocks, {
    React: host.React,
    setTimeout: () => 1,
    clearTimeout() {},
  }).default;
  const render = () => host.render(Screen);
  render();
  host.flushEffects();
  render();
  host.flushEffects();
  return { host, state, auth, render };
}

test("restoration reads the key belonging to the current Firebase UID", () => {
  const screen = protectedScreen();
  assert.deepEqual(screen.state.restoredUsers, ["account-a"]);
  assert.equal(
    findAll(screen.render(), (node) => node.type === "Provider").length,
    1,
  );
});

test("SecureStore failure leaves protected routes unavailable", () => {
  const screen = protectedScreen({ storageFails: true });
  assert.equal(
    findAll(screen.render(), (node) => node.type === "Redirect")[0].props.href,
    "/login",
  );
});

test("remote device removal begins logout immediately and closes protected UI", async () => {
  const screen = protectedScreen();
  await flush();
  screen.state.removed();
  assert.equal(screen.state.logouts, 1);
  assert.equal(
    findAll(screen.render(), (node) => node.type === "Provider").length,
    0,
  );
  screen.host.unmount();
  assert.ok(screen.state.unsubscribe >= 2);
});

test("device-ID lookup completing after an account switch cannot attach a listener", async () => {
  const deviceId = deferred();
  const screen = protectedScreen({ deviceId });
  screen.auth.currentUser = { uid: "account-b" };
  deviceId.resolve("installation-id");
  await flush();
  assert.equal(screen.state.removals, 0);
});
