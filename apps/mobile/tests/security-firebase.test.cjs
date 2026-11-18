const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule, deferred } = require("./helpers/load-module.cjs");
const source = "services/firebase.ts";
const envelope = `${"ab".repeat(12)}:${"cd".repeat(16)}:abcd`;
const clip = (id, extra = {}) => ({
  id,
  content: envelope,
  type: "text",
  timestamp: "2026-11-15T00:00:00.000Z",
  sourceDevice: "Synthetic device",
  ...extra,
});
const snapshot = (value) => ({
  val: () => value,
  exists: () =>
    value !== null &&
    value !== undefined &&
    (typeof value !== "object" || Object.keys(value).length > 0),
});

function fixture(options = {}) {
  const auth = { currentUser: { uid: "account-a" } };
  let session = { userId: "account-a", id: "session-a" };
  const calls = [];
  const data = new Map();
  const listeners = [];
  let nextKey = 0;
  const pathOf = (reference) =>
    typeof reference === "string" ? reference : reference.path;
  const database = {
    getDatabase: () => ({}),
    ref: (_db, path) => path,
    query: (path, ...constraints) => ({ path, constraints }),
    orderByChild: (field) => ({ field }),
    equalTo: (value) => ({ value }),
    get: async (reference) => {
      if (options.get) return options.get(reference);
      const result = snapshot(data.get(pathOf(reference)) ?? null);
      options.afterRead?.(pathOf(reference), data);
      return result;
    },
    push: (path) => {
      calls.push(["push", path]);
      return `${path}/synthetic-${++nextKey}`;
    },
    set: async (path, value) => {
      calls.push(["set", path, value]);
      data.set(path, value);
    },
    update: async (path, value) => {
      calls.push(["update", path, value]);
      const next = { ...data.get(path) };
      for (const [key, entry] of Object.entries(value)) {
        if (entry === null) delete next[key];
        else next[key] = entry;
      }
      data.set(path, next);
    },
    remove: async (path) => {
      calls.push(["remove", path]);
      data.delete(path);
    },
    runTransaction: async (path, callback) => {
      if (options.beforeTransaction) options.beforeTransaction(path, data);
      const value = callback(data.get(path) ?? null);
      calls.push(["transaction", path, value]);
      if (value !== undefined) data.set(path, value);
      return { committed: value !== undefined, snapshot: snapshot(value) };
    },
    onValue: (reference, next, error) => {
      const listener = { path: pathOf(reference), next, error, stopped: false };
      listeners.push(listener);
      return () => {
        options.unsubscribe?.(listener);
        listener.stopped = true;
      };
    },
    onChildRemoved: (reference, next, error) => {
      const listener = { path: pathOf(reference), next, error, stopped: false };
      listeners.push(listener);
      return () => {
        listener.stopped = true;
      };
    },
  };
  const service = loadModule(source, {
    "@react-native-firebase/app": { getApp: () => ({}) },
    "@react-native-firebase/auth": { getAuth: () => auth },
    "@react-native-firebase/database": database,
    "expo-crypto": { randomUUID: () => "synthetic-device" },
    "expo-device": { deviceName: "Synthetic device", osName: "Android" },
    "expo-secure-store": {
      getItemAsync: options.deviceId || (async () => "synthetic-device"),
      setItemAsync: async () => {},
    },
    "./crypto": { isKeyLoaded: () => !options.missingKey },
    "./pushSession": {
      capturePushSession: (uid) =>
        uid === auth.currentUser?.uid ? session : null,
      isPushSessionCurrent: (expected) =>
        expected === session && expected?.userId === auth.currentUser?.uid,
    },
  });
  return {
    service,
    auth,
    calls,
    data,
    listeners,
    session: () => session,
    switchAccount() {
      auth.currentUser = { uid: "account-b" };
      session = { userId: "account-b", id: "session-b" };
    },
    emit(path, value) {
      for (const listener of listeners.filter(
        (item) => item.path.replace(/\/$/, "") === path.replace(/\/$/, ""),
      ))
        listener.next(snapshot(value));
    },
  };
}

const tick = () => new Promise(setImmediate);

test("encrypted-data boundary refuses plaintext and malformed envelopes before database writes", async () => {
  const f = fixture();
  for (const content of [
    "plaintext",
    "iv:tag:body",
    `${"ab".repeat(12)}:${"cd".repeat(16)}:0g`,
  ]) {
    await assert.rejects(f.service.addClip(content, "text"), /encrypted/);
    await assert.rejects(
      f.service.updateClipContent("clip", content, "text"),
      /encrypted/,
    );
  }
  assert.equal(f.calls.length, 0);
});

test("account switch while device identity is loading cancels a pending clip upload", async () => {
  const device = deferred();
  const f = fixture({ deviceId: () => device.promise });
  const sending = f.service.addClip(envelope, "text", f.session());
  await tick();
  f.switchAccount();
  device.resolve("synthetic-device");
  await assert.rejects(sending, /SESSION_CHANGED/);
  assert.equal(f.calls.length, 0);
});

test("late reads and unsubscribed listener callbacks cannot expose the previous account", async () => {
  const read = deferred();
  const f = fixture({ get: () => read.promise });
  const fetching = f.service.getClips(f.session());
  let delivered = 0;
  const stop = f.service.listenClips(() => delivered++);
  f.switchAccount();
  read.resolve(snapshot({ one: clip("one") }));
  await assert.rejects(fetching, /SESSION_CHANGED/);
  f.emit("users/account-a/clips", { one: clip("one") });
  stop();
  f.emit("users/account-a/clips", { one: clip("one") });
  assert.equal(delivered, 0);
});

for (const [method, path] of [
  ["listenClips", "users/account-a/clips"],
  ["listenDevices", "users/account-a/devices"],
]) {
  test(`${method} cleanup survives native detach failure and ignores late callbacks`, () => {
    let attempts = 0;
    const f = fixture({
      unsubscribe() {
        attempts++;
        throw new TypeError("native.off is not a function");
      },
    });
    let delivered = 0;
    let errors = 0;
    const stop = f.service[method](
      () => delivered++,
      () => errors++,
    );
    f.emit(path, null);
    assert.equal(delivered, 1);

    assert.doesNotThrow(stop);
    f.emit(path, null);
    f.listeners[0].error(new Error("Synthetic late listener error"));
    assert.equal(delivered, 1);
    assert.equal(errors, 0);
    assert.doesNotThrow(stop);
    assert.equal(attempts, 1);
  });
}

test("device-removal cleanup attempts both listeners when native detach fails", async () => {
  const attempts = [];
  let reads = 0;
  const f = fixture({
    unsubscribe(listener) {
      attempts.push(listener.path);
      if (listener.path !== ".info/connected") {
        throw new TypeError("native.off is not a function");
      }
    },
    get() {
      reads++;
      return snapshot(null);
    },
  });
  let removed = 0;
  const stop = f.service.listenOwnDeviceRemoval(
    "Synthetic device",
    () => removed++,
    "synthetic-device",
  );

  assert.doesNotThrow(stop);
  assert.deepEqual(attempts, ["users/account-a/devices", ".info/connected"]);
  assert.equal(f.listeners[1].stopped, true);
  f.emit("users/account-a/devices", null);
  f.emit(".info/connected", true);
  await tick();
  assert.equal(reads, 0);
  assert.equal(removed, 0);
  assert.doesNotThrow(stop);
  assert.equal(attempts.length, 2);
});

test("malformed runtime clips are excluded and numeric timestamps normalize for interoperability", async () => {
  const f = fixture();
  f.data.set("users/account-a/clips", {
    valid: clip("one", { timestamp: 1000 }),
    raw: clip("raw", { content: "plaintext" }),
    badType: clip("type", { type: "image" }),
    badTime: clip("time", { timestamp: "nonsense" }),
    primitive: 7,
  });
  const clips = await f.service.getClips();
  assert.deepEqual(Object.keys(clips), ["valid"]);
  assert.equal(clips.valid.timestamp, "1970-01-01T00:00:01.000Z");
});

test("retention respects current pins and keeps exactly the configured maximum", async () => {
  const f = fixture();
  const clips = {};
  for (let i = 0; i < 302; i++)
    clips[`key-${i}`] = clip(`${i}`, {
      timestamp: new Date(1000 + i).toISOString(),
      pinned: i === 0,
    });
  f.data.set("users/account-a/clips", clips);
  await f.service.enforceClipLimit();
  const remaining = f.data.get("users/account-a/clips");
  assert.equal(Object.keys(remaining).length, 300);
  assert.equal(remaining["key-0"].pinned, true);
  assert.equal(remaining["key-1"], undefined);
  assert.equal(remaining["key-2"], undefined);
});

test("resending an existing clip refreshes its timestamp and source without replacing its content or metadata", async () => {
  const f = fixture();
  const path = "users/account-a/clips/existing-key";
  const original = clip("existing-id", {
    type: "text-formatted",
    pinned: true,
    sourceDevice: "Synthetic desktop",
    sourceDeviceId: "previous-device",
    retainedMetadata: "keep this value",
  });
  const other = clip("other-id");
  f.data.set("users/account-a/clips", {
    "existing-key": original,
    "other-key": other,
  });
  f.data.set(path, original);
  f.data.set("users/account-a/clips/other-key", other);

  const before = Date.now();
  await f.service.updateClip("existing-id", f.session());
  const after = Date.now();
  const updated = f.data.get(path);

  assert.deepEqual(
    f.calls.map(([kind]) => kind),
    ["transaction"],
  );
  assert.equal(f.calls[0][1], path);
  assert.equal(f.data.size, 3);
  assert.equal(f.data.get("users/account-a/clips/other-key"), other);
  assert.ok(Date.parse(updated.timestamp) >= before);
  assert.ok(Date.parse(updated.timestamp) <= after);
  assert.notEqual(updated.timestamp, original.timestamp);
  assert.equal(updated.sourceDevice, "Synthetic device");
  assert.equal(updated.sourceDeviceId, "synthetic-device");
  assert.deepEqual(
    {
      ...updated,
      timestamp: original.timestamp,
      sourceDevice: original.sourceDevice,
      sourceDeviceId: original.sourceDeviceId,
    },
    original,
  );
});

test("a clip deleted between lookup and content save is never recreated", async () => {
  const f = fixture();
  f.data.set("users/account-a/clips", { one: clip("clip-one") });
  f.data.set("users/account-a/clips/one", null);
  await assert.rejects(
    f.service.updateClipContent("clip-one", envelope, "text"),
    /changed|removed/,
  );
  assert.equal(
    f.calls.some(([kind]) => kind === "update"),
    false,
  );
  assert.equal(f.data.get("users/account-a/clips/one"), null);
});

test("clear history preserves clips pinned concurrently with its initial read", async () => {
  const f = fixture({
    afterRead: (path, data) =>
      data.set(path, { one: clip("one", { pinned: true }) }),
  });
  f.data.set("users/account-a/clips/", { one: clip("one") });
  await f.service.removeAllClips();
  assert.equal(f.data.get("users/account-a/clips/").one.pinned, true);
});

test("permission changes during push registration prevent the token write", async () => {
  const read = deferred();
  const f = fixture({ get: () => read.promise });
  let allowed = true;
  const registering = f.service.updateDeviceFCMToken(
    "account-a",
    "synthetic-token",
    f.session(),
    () => allowed,
  );
  await tick();
  allowed = false;
  read.resolve(snapshot({ key: { id: "synthetic-device" } }));
  const registered = await registering;
  assert.equal(f.calls.length, 0);
  assert.equal(registered, false);
});

test("token refresh cannot recreate a remotely removed device", async () => {
  const f = fixture();
  const registered = await f.service.updateDeviceFCMToken(
    "account-a",
    "synthetic-token",
  );
  assert.equal(f.calls.length, 0);
  assert.equal(registered, false);
});

test("device removal waits for connectivity, recognizes cold revocation, and cleans both listeners", async () => {
  const f = fixture();
  let removed = 0;
  const stop = f.service.listenOwnDeviceRemoval(
    "Synthetic device",
    () => removed++,
    "synthetic-device",
  );
  f.emit("users/account-a/devices", null);
  assert.equal(removed, 0);
  f.emit(".info/connected", true);
  await tick();
  assert.equal(removed, 1);
  f.emit("users/account-a/devices", null);
  assert.equal(removed, 1);
  stop();
  assert.equal(
    f.listeners.every((listener) => listener.stopped),
    true,
  );
});

test("data APIs reject unauthorized account IDs and malformed path identifiers", async () => {
  const f = fixture();
  await assert.rejects(
    f.service.getEncryptionMetadata("account-b"),
    /SESSION_CHANGED/,
  );
  await assert.rejects(f.service.wipeUserClips("account-b"), /SESSION_CHANGED/);
  await assert.rejects(f.service.removeDevice("../../profile"), /identifier/);
  assert.equal(f.calls.length, 0);
});

test("cached missing-device data does not revoke a registration that still exists remotely", async () => {
  const f = fixture();
  f.data.set("users/account-a/devices", { key: { id: "synthetic-device" } });
  let removed = 0;
  const stop = f.service.listenOwnDeviceRemoval(
    "Synthetic device",
    () => removed++,
    "synthetic-device",
  );
  f.emit("users/account-a/devices", null);
  f.emit(".info/connected", true);
  await tick();
  assert.equal(removed, 0);
  stop();
});

test("unavailable secure device identity rejects registration instead of creating an ephemeral device", async () => {
  const f = fixture({
    deviceId: async () => {
      throw new Error("Synthetic locked identity storage");
    },
  });
  await assert.rejects(f.service.addDevice("account-a"), /locked identity/);
  assert.equal(f.calls.length, 0);
});

test("stale encryption-metadata transactions cannot commit after account switching", async () => {
  let f;
  f = fixture({ beforeTransaction: () => f.switchAccount() });
  await assert.rejects(
    f.service.saveEncryptionMetadata("account-a", "ab".repeat(16), envelope),
    /SESSION_CHANGED/,
  );
  assert.equal(f.data.has("users/account-a/encryption"), false);
});

test("direct clip mutations require the current-account encryption key", async () => {
  const f = fixture({ missingKey: true });
  await assert.rejects(f.service.addClip(envelope, "text"), /encryption key/);
  await assert.rejects(f.service.removeAllClips(), /encryption key/);
  assert.equal(f.calls.length, 0);
});

for (const [storedPlatform, expectedPlatform] of [
  ["darwin", "macOS"],
  ["win32", "Windows"],
  ["linux", "Linux"],
  ["macOS", "macOS"],
  ["Windows", "Windows"],
  ["Linux", "Linux"],
  ["Android", "Android"],
  ["iOS", "iOS"],
  ["Web", "Web"],
]) {
  test(`device fetch and subscription retain another device using ${storedPlatform}`, async () => {
    const f = fixture();
    const devices = {
      mobile: {
        id: "synthetic-device",
        deviceName: "Current phone",
        platform: "Android",
        lastActive: "2026-11-15T00:00:00.000Z",
      },
      other: {
        id: "other-device",
        deviceName: "Other device",
        platform: storedPlatform,
        lastActive: "2026-11-15T00:00:00.000Z",
      },
    };
    f.data.set("users/account-a/devices/", devices);
    const fetched = await f.service.getDevices();
    assert.deepEqual(Object.keys(fetched), ["mobile", "other"]);
    assert.equal(fetched.other.platform, expectedPlatform);

    let received;
    const stop = f.service.listenDevices((value) => {
      received = value;
    });
    f.emit("users/account-a/devices", devices);
    assert.deepEqual(Object.keys(received), ["mobile", "other"]);
    assert.equal(received.other.platform, expectedPlatform);
    stop();
  });
}

test("remote clip identifiers and metadata are bounded and malformed devices never reach UI", async () => {
  const f = fixture();
  f.data.set("users/account-a/clips", {
    valid: clip("valid"),
    badId: clip("bad/id"),
    hugeName: clip("name", { sourceDevice: "x".repeat(257) }),
    badPinned: clip("pin", { pinned: "true" }),
  });
  assert.deepEqual(Object.keys(await f.service.getClips()), ["valid"]);
  const device = {
    id: "synthetic-device",
    deviceName: "Synthetic device",
    platform: "Android",
    lastActive: "2026-11-15T00:00:00.000Z",
  };
  f.data.set("users/account-a/devices/", {
    valid: device,
    badToken: { ...device, fcmToken: {} },
    badId: { ...device, id: "bad/id" },
    hugeName: { ...device, deviceName: "x".repeat(257) },
    unsupportedPlatform: { ...device, platform: "unsupported" },
    nonStringPlatform: { ...device, platform: {} },
    invalidLastActive: { ...device, platform: "darwin", lastActive: "invalid" },
  });
  assert.deepEqual(Object.keys(await f.service.getDevices()), ["valid"]);
  await assert.rejects(f.service.removeDevice(null), /identifier/);
});
