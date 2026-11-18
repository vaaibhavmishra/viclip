const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule, deferred } = require("./helpers/load-module.cjs");
const source = "services/secureStorage.ts";

function fixture(options = {}) {
  const data = new Map();
  const store = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
    getItem: (key) => {
      if (options.readFailure) throw new Error("Synthetic locked device");
      return data.get(key) ?? null;
    },
    setItem: (key, value, settings) => {
      if (options.writeFailure)
        throw new Error("Synthetic unavailable secure storage");
      data.set(key, value);
      options.savedOptions = settings;
    },
    deleteItemAsync: async (key) => {
      if (options.deletion) await options.deletion.promise;
      if (options.deleteFailure) throw new Error("Synthetic delete failure");
      data.delete(key);
    },
  };
  return {
    storage: loadModule(source, {
      "expo-secure-store": store,
      "react-native-quick-crypto": { Buffer },
    }).authStorage,
    data,
    options,
  };
}

test("stored DEK is readable only for its owning account", () => {
  const f = fixture();
  f.storage.saveMasterKey(Buffer.alloc(32, 3), "account-a");
  assert.equal(f.storage.getMasterKey("account-b"), null);
  assert.deepEqual(f.storage.getMasterKey("account-a"), Buffer.alloc(32, 3));
  assert.equal(f.options.savedOptions.keychainAccessible, 7);
});

test("legacy unowned, malformed, and wrong-length persisted keys fail closed", () => {
  const f = fixture();
  for (const stored of [
    Buffer.alloc(32).toString("base64"),
    "{",
    JSON.stringify({ userId: "a", key: "%%%" }),
    JSON.stringify({ userId: "a", key: Buffer.alloc(16).toString("base64") }),
  ]) {
    f.data.set("masterKey", stored);
    assert.equal(f.storage.getMasterKey("a"), null);
  }
  assert.throws(
    () => f.storage.saveMasterKey(Buffer.alloc(16), "a"),
    /Invalid/,
  );
});

test("write and locked-device read failures propagate to authentication", () => {
  assert.throws(
    () =>
      fixture({ writeFailure: true }).storage.saveMasterKey(
        Buffer.alloc(32),
        "a",
      ),
    /secure storage/,
  );
  assert.throws(
    () => fixture({ readFailure: true }).storage.getMasterKey("a"),
    /locked device/,
  );
});

test("logout revokes before delayed deletion and prevents a new key from being deleted", async () => {
  const deletion = deferred();
  const f = fixture({ deletion });
  f.storage.saveMasterKey(Buffer.alloc(32), "a");
  const clearing = f.storage.clearAuth();
  assert.equal(f.storage.getMasterKey("a"), null);
  assert.equal(f.data.get("masterKey"), "");
  assert.throws(
    () => f.storage.saveMasterKey(Buffer.alloc(32), "b"),
    /cleanup.*pending/,
  );
  deletion.resolve();
  await clearing;
  f.storage.saveMasterKey(Buffer.alloc(32, 4), "b");
  assert.deepEqual(f.storage.getMasterKey("b"), Buffer.alloc(32, 4));
});

test("a persisted tombstone prevents restoration after deletion failure", async () => {
  const f = fixture({ deleteFailure: true });
  f.storage.saveMasterKey(Buffer.alloc(32), "a");
  await f.storage.clearAuth();
  assert.equal(f.data.get("masterKey"), "");
  assert.equal(f.storage.getMasterKey("a"), null);
});

test("cleanup reports failure when neither revocation nor deletion can persist", async () => {
  const f = fixture({ writeFailure: true, deleteFailure: true });
  await assert.rejects(f.storage.clearAuth(), /Unable to clear/);
});

test("persisted push session IDs restore only beside a valid same-account DEK", async () => {
  const f = fixture();
  f.storage.saveMasterKey(Buffer.alloc(32), "a", "session-a");
  assert.equal(f.storage.getSessionId("a"), "session-a");
  assert.equal(f.storage.getSessionId("b"), null);
  await f.storage.clearAuth();
  assert.equal(f.storage.getSessionId("a"), null);
});
