const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule, deferred } = require("./helpers/load-module.cjs");

const source = "services/clipboard.ts";
const envelope = (text) =>
  `${"ab".repeat(12)}:${"cd".repeat(16)}:${Buffer.from(text).toString("hex")}`;
const clip = (content, id = "clip-one") => ({
  id,
  content,
  type: "text",
  timestamp: "2026-11-15T00:00:00.000Z",
  sourceDevice: "Synthetic device",
});

function setup(options = {}) {
  const auth = { currentUser: { uid: "account-a" } };
  let session = { userId: "account-a", id: "session-a" };
  let keyLoaded = true;
  let remote = {};
  const calls = [];
  const service = loadModule(source, {
    "@react-native-firebase/auth": { getAuth: () => auth },
    "expo-clipboard": { setStringAsync: options.write || (async () => {}) },
    "react-native": { AppState: { currentState: "active" } },
    "./pushSession": {
      capturePushSession: () => session,
      isPushSessionCurrent: (captured) =>
        captured === session && captured.userId === auth.currentUser?.uid,
    },
    "./crypto": {
      isKeyLoaded: () => keyLoaded,
      getActiveDEK: () => Buffer.alloc(32),
      encrypt: options.encrypt || envelope,
      decrypt: (content) => {
        if (content.includes("ee".repeat(16)))
          throw new Error("Synthetic authentication failure");
        return Buffer.from(content.split(":")[2], "hex").toString();
      },
    },
    "./firebase": {
      getClips: options.getClips || (async () => remote),
      addClip:
        options.addClip ||
        (async (content, type, expected) => {
          calls.push(["add", content, type, expected]);
          remote = { one: { ...clip(content), type } };
        }),
      enforceClipLimit:
        options.prune || (async (expected) => calls.push(["prune", expected])),
      updateClip: async (id, expected) => calls.push(["update", id, expected]),
      updateClipContent: async (id, content, type, expected) =>
        calls.push(["edit", id, content, type, expected]),
    },
  });
  return {
    service,
    calls,
    auth,
    switchAccount() {
      auth.currentUser = { uid: "account-b" };
      session = { userId: "account-b", id: "session-b" };
    },
    clearKey() {
      keyLoaded = false;
    },
  };
}

test("pending sends cannot upload clipboard data after account switching", async () => {
  const pending = deferred();
  const fixture = setup({ getClips: () => pending.promise });
  const sending = fixture.service.sendClip("private synthetic data", "text");
  await new Promise(setImmediate);
  fixture.switchAccount();
  pending.resolve({});
  await assert.rejects(sending, /SESSION_CHANGED/);
  assert.equal(fixture.calls.length, 0);
});

test("failed uploads never prune existing history, and retries remain possible", async () => {
  let attempts = 0;
  const fixture = setup({
    addClip: async () => {
      attempts++;
      throw new Error("Synthetic offline write");
    },
  });
  await assert.rejects(fixture.service.sendClip("retry me", "text"), /offline/);
  await assert.rejects(fixture.service.sendClip("retry me", "text"), /offline/);
  assert.equal(attempts, 2);
  assert.equal(fixture.calls.length, 0);
});

test("successful uploads precede retention and rapid duplicate sends update the existing clip", async () => {
  const fixture = setup();
  await Promise.all([
    fixture.service.sendClip("same content", "text", []),
    fixture.service.sendClip("same content", "text", []),
  ]);
  assert.deepEqual(
    fixture.calls.map((entry) => entry[0]),
    ["add", "prune", "update", "prune"],
  );
  assert.equal(fixture.calls[0][1], envelope("same content"));
  assert.equal(fixture.calls[2][1], "clip-one");
});

test("identical text reuses desktop clips even when mobile detects a different type", async () => {
  for (const [content, incomingType] of [
    ["same content", "text"],
    ["https://example.test/path", "url"],
    ["someone@example.test", "email"],
    ["#aabbcc", "color"],
  ]) {
    const fixture = setup({
      getClips: async () => ({
        existing: {
          ...clip(envelope(content), "desktop-clip"),
          type: "text-formatted",
          pinned: true,
        },
      }),
    });
    await fixture.service.sendClip(content, incomingType, []);
    assert.deepEqual(
      fixture.calls.map((entry) => entry[0]),
      ["update", "prune"],
    );
    assert.equal(fixture.calls[0][1], "desktop-clip");
  }
});

test("share-send preserves exact text and reuses the clip from manual Send", async () => {
  const { getSharedText, detectClipboardType } = loadModule("utils/util.ts");
  for (const share of [
    { text: "  Selected text\nhttps://example.test/path\n" },
    { webUrl: "  https://example.test/path\n" },
  ]) {
    const fixture = setup();
    const content = share.text ?? share.webUrl;
    await fixture.service.sendClip(
      content,
      await detectClipboardType(content),
      [],
    );
    const sharedText = getSharedText(share);
    assert.equal(sharedText, content);
    await fixture.service.sendClip(
      sharedText,
      await detectClipboardType(sharedText),
      [],
    );
    assert.deepEqual(
      fixture.calls.map((entry) => entry[0]),
      ["add", "prune", "update", "prune"],
    );
    assert.equal(fixture.calls[2][1], "clip-one");
  }
});

test("different text and significant whitespace still create separate clips", async () => {
  for (const content of [
    "different content",
    "same content\n",
    " same content",
  ]) {
    const fixture = setup({
      getClips: async () => ({ existing: clip(envelope("same content")) }),
    });
    await fixture.service.sendClip(content, "text");
    assert.deepEqual(
      fixture.calls.map((entry) => entry[0]),
      ["add", "prune"],
    );
    assert.equal(fixture.calls[0][1], envelope(content));
  }
});

test("missing keys and encryption failures never upload plaintext", async () => {
  const missing = setup();
  missing.clearKey();
  await assert.rejects(
    missing.service.sendClip("secret", "text"),
    /key not loaded/,
  );
  assert.equal(missing.calls.length, 0);
  const failed = setup({
    encrypt: () => {
      throw new Error("Synthetic unavailable native module");
    },
  });
  await assert.rejects(
    failed.service.sendClip("secret", "text"),
    /unavailable/,
  );
  assert.equal(failed.calls.length, 0);
});

test("empty, oversized and unsupported content is rejected instead of reporting success", async () => {
  const fixture = setup();
  await assert.rejects(fixture.service.sendClip("", "text"), /empty/);
  await assert.rejects(
    fixture.service.sendClip("x".repeat(1000001), "text"),
    /maximum/,
  );
  await assert.rejects(
    fixture.service.sendClip("x", "unsupported"),
    /Unsupported/,
  );
  await assert.rejects(fixture.service.sendClip("x", undefined), /Unsupported/);
  assert.equal(fixture.calls.length, 0);
});

test("unavailable duplicate reads cannot silently create clips", async () => {
  const fixture = setup({
    getClips: async () => {
      throw new Error("Synthetic permission denial");
    },
  });
  await assert.rejects(
    fixture.service.sendClip("content", "text"),
    /permission denial/,
  );
  assert.equal(fixture.calls.length, 0);
});

test("malformed and plaintext records never escape decryption; tampering yields a safe placeholder", () => {
  const fixture = setup();
  const records = {
    plain: clip("plaintext must not pass"),
    malformed: clip("a:b:c"),
    valid: clip(envelope("safe")),
    tampered: clip(`${"ab".repeat(12)}:${"ee".repeat(16)}:abcd`),
    unsupported: { ...clip(envelope("bad type")), type: "unsafe" },
    nullRecord: null,
  };
  const decrypted = fixture.service.decryptClips(records);
  assert.deepEqual(Object.keys(decrypted), ["valid", "tampered"]);
  assert.equal(decrypted.valid.content, "safe");
  assert.equal(
    decrypted.tampered.content,
    "[Encrypted Content - Decryption Failed]",
  );
  assert.equal(decrypted.tampered.decryptionFailed, true);
  assert.equal(decrypted.valid.decryptionFailed, false);
  assert.equal(records.valid.content, envelope("safe"));
  fixture.clearKey();
  assert.equal(Object.keys(fixture.service.decryptClips(records)).length, 0);
});

test("clip edits encrypt data and reject explicit stale sessions", async () => {
  const fixture = setup();
  await fixture.service.editClip("clip-one", "updated", "text");
  assert.equal(fixture.calls[0][2], envelope("updated"));
  await assert.rejects(
    fixture.service.editClip("clip-one", "updated", "text", null),
    /SESSION_CHANGED/,
  );
});

test("native clipboard writes complete in order across callers", async () => {
  const pending = deferred();
  const writes = [];
  const fixture = setup({
    write: async (content) => {
      writes.push(content);
      if (content === "first") await pending.promise;
    },
  });
  // Capture through the send fixture's actual session via the addClip mock.
  await fixture.service.sendClip("capture", "text");
  const captured = fixture.calls[0][3];
  const first = fixture.service.writeClipToClipboard("first", captured);
  const second = fixture.service.writeClipToClipboard("second", captured);
  await new Promise(setImmediate);
  assert.deepEqual(writes, ["first"]);
  pending.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(writes, ["first", "second"]);
});

test("queued clipboard writes never submit after account switching", async () => {
  const pending = deferred();
  const writes = [];
  const fixture = setup({
    write: async (content) => {
      writes.push(content);
      await pending.promise;
    },
  });
  await fixture.service.sendClip("capture", "text");
  const captured = fixture.calls[0][3];
  const first = fixture.service.writeClipToClipboard("first", captured);
  const second = fixture.service.writeClipToClipboard("second", captured);
  await new Promise(setImmediate);
  fixture.switchAccount();
  pending.resolve();
  await assert.rejects(first, /SESSION_CHANGED/);
  await assert.rejects(second, /SESSION_CHANGED/);
  assert.deepEqual(writes, ["first"]);
});

test("failed clipboard writes release the queue and unmounted scopes reject before submission", async () => {
  const writes = [];
  const fixture = setup({
    write: async (content) => {
      writes.push(content);
      if (content === "failure") throw new Error("Synthetic paste denial");
    },
  });
  await fixture.service.sendClip("capture", "text");
  const captured = fixture.calls[0][3];
  await assert.rejects(
    fixture.service.writeClipToClipboard("failure", captured),
    /paste denial/,
  );
  await fixture.service.writeClipToClipboard("retry", captured);
  await assert.rejects(
    fixture.service.writeClipToClipboard("unmounted", captured, () => false),
    /SESSION_CHANGED/,
  );
  assert.deepEqual(writes, ["failure", "retry"]);
});

test("a new account can send without waiting for the previous account's stalled read", async () => {
  const pending = deferred();
  let reads = 0;
  const fixture = setup({
    getClips: () => (++reads === 1 ? pending.promise : Promise.resolve({})),
  });
  const first = fixture.service.sendClip("first account", "text");
  const rejected = assert.rejects(first, /SESSION_CHANGED/);
  await new Promise(setImmediate);
  fixture.switchAccount();
  let sent = false;
  const second = fixture.service.sendClip("second account", "text").then(() => {
    sent = true;
  });
  await new Promise(setImmediate);
  assert.equal(sent, true);
  pending.resolve({});
  await rejected;
  await second;
  assert.equal(fixture.calls[0][3].userId, "account-b");
});

test("corrupted clips cannot deduplicate valid text equal to the failure label", async () => {
  const content = "[Encrypted Content - Decryption Failed]";
  const fixture = setup({
    getClips: async () => ({
      bad: clip(`${"ab".repeat(12)}:${"ee".repeat(16)}:abcd`),
    }),
  });
  await fixture.service.sendClip(content, "text");
  assert.deepEqual(
    fixture.calls.map((entry) => entry[0]),
    ["add", "prune"],
  );
  assert.equal(fixture.calls[0][1], envelope(content));
  const decrypted = fixture.service.decryptClips({
    valid: { ...clip(envelope(content)), decryptionFailed: true },
  });
  assert.equal(decrypted.valid.decryptionFailed, false);
  assert.equal(decrypted.valid.content, content);
});

test("acknowledged uploads report retention failures accurately and retries finish cleanup", async () => {
  let cleanups = 0;
  const fixture = setup({
    prune: async () => {
      if (++cleanups === 1) throw new Error("Synthetic cleanup failure");
    },
  });
  await assert.rejects(
    fixture.service.sendClip("retry retention", "text"),
    /clip was sent, but history cleanup failed/,
  );
  await fixture.service.sendClip("retry retention", "text");
  assert.deepEqual(
    fixture.calls.map((entry) => entry[0]),
    ["add", "update"],
  );
  assert.equal(cleanups, 2);
});
