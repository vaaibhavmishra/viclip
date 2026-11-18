const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { loadModule } = require("./helpers/load-module.cjs");
const source = "services/crypto.ts";

function fixture(options = {}) {
  const auth = { currentUser: { uid: "account-a" } };
  const adapter = loadModule(source, {
    "@react-native-firebase/auth": { getAuth: () => auth },
    "react-native-quick-crypto": { Buffer, ...crypto },
    "expo-crypto": {
      getRandomValues: (bytes) => {
        if (options.unavailable)
          throw new Error("Synthetic native randomness unavailable");
        return crypto.randomFillSync(bytes);
      },
      getRandomBytes: (size) => {
        if (options.forbidWeak)
          throw new Error("Unsafe development randomness path used");
        return crypto.randomBytes(size);
      },
    },
  });
  return { adapter, auth };
}

test("mobile uses secure native randomness and fails closed if native randomness is unavailable", () => {
  const { adapter } = fixture({ forbidWeak: true });
  assert.equal(adapter.generateDEK().length, 32);
  assert.match(adapter.generateSalt(), /^[0-9a-f]{32}$/);
  assert.throws(
    () => fixture({ unavailable: true }).adapter.generateDEK(),
    /randomness unavailable/,
  );
});

test("asynchronous mobile KDF preserves PBKDF2 interoperability and rejects malformed salt", async () => {
  const { adapter } = fixture();
  const salt = "ab".repeat(16);
  assert.deepEqual(
    await adapter.deriveKEKAsync("synthetic-password", salt),
    crypto.pbkdf2Sync(
      "synthetic-password",
      Buffer.from(salt, "hex"),
      100000,
      32,
      "sha256",
    ),
  );
  await assert.rejects(
    adapter.deriveKEKAsync("synthetic-password", "0g".repeat(16)),
    /salt/,
  );
});

test("AES-GCM and wrapped keys retain wire format and reject tampering", () => {
  const { adapter } = fixture();
  const key = crypto.randomBytes(32);
  const ciphertext = adapter.encrypt("synthetic secret", key);
  assert.match(ciphertext, /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
  assert.equal(adapter.decrypt(ciphertext, key), "synthetic secret");
  const [iv, tag, body] = ciphertext.split(":");
  assert.throws(() =>
    adapter.decrypt(
      `${iv}:${tag[0] === "0" ? "1" : "0"}${tag.slice(1)}:${body}`,
      key,
    ),
  );
  assert.throws(() => adapter.decrypt(`${iv}:${tag}:${body}z`, key), /format/);
  const dek = crypto.randomBytes(32);
  assert.deepEqual(adapter.unwrapKey(adapter.wrapKey(dek, key), key), dek);
});

test("active key ownership follows Firebase UID and account changes clear the previous key", () => {
  const { adapter, auth } = fixture();
  const key = Buffer.alloc(32, 7);
  adapter.setActiveDEK(key, "account-a");
  assert.equal(adapter.isKeyLoaded("account-a"), true);
  auth.currentUser = { uid: "account-b" };
  assert.equal(adapter.isKeyLoaded(), false);
  assert.deepEqual(key, Buffer.alloc(32));
  assert.throws(() => adapter.getActiveDEK(), /current account/);
  assert.throws(
    () => adapter.setActiveDEK(Buffer.alloc(32), "account-a"),
    /inactive account/,
  );
});
