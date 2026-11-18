const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule } = require("./helpers/load-module.cjs");

function fixture() {
  const auth = { currentUser: { uid: "account-a" } };
  const persisted = new Map();
  let generation = 0;
  const mocks = {
    "@react-native-firebase/auth": { getAuth: () => auth },
    "expo-crypto": { randomUUID: () => `session-${++generation}` },
    "./secureStorage": {
      authStorage: { getSessionId: (uid) => persisted.get(uid) ?? null },
    },
  };
  return {
    auth,
    persisted,
    recreate: () => loadModule("services/pushSession.ts", mocks),
  };
}

test("process recreation restores the same owned push binding for cold-start notifications", () => {
  const f = fixture();
  const original = f.recreate().beginPushSession("account-a");
  f.persisted.set("account-a", original.id);
  const recreated = f.recreate();
  const restored = recreated.capturePushSession("account-a");
  assert.equal(restored.id, original.id);
  assert.equal(recreated.isPushSessionCurrent(restored), true);
});

test("logout suspension rejects restoration and explicit authentication rotates the binding", () => {
  const f = fixture();
  const service = f.recreate();
  const original = service.beginPushSession("account-a");
  f.persisted.set("account-a", original.id);
  service.suspendPushSession();
  assert.equal(service.capturePushSession("account-a"), null);
  const next = service.beginPushSession("account-a");
  assert.notEqual(next.id, original.id);
  assert.equal(service.isPushSessionCurrent(original), false);
});

test("persisted bindings cannot be restored for another Firebase account", () => {
  const f = fixture();
  f.persisted.set("account-a", "previous-a-session");
  f.auth.currentUser = { uid: "account-b" };
  const service = f.recreate();
  assert.equal(service.capturePushSession("account-a"), null);
  assert.notEqual(
    service.capturePushSession("account-b").id,
    "previous-a-session",
  );
});
