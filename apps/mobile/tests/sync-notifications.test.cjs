const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule, deferred } = require("./helpers/load-module.cjs");
const { createScreenHost } = require("./helpers/render-screen.cjs");

const flush = () => new Promise(setImmediate);
const sampleClip = {
  id: "clip-1",
  content: "Synthetic decrypted clip",
  type: "text",
  timestamp: "2026-11-15T00:00:00Z",
  sourceDevice: "Test device",
};
const message = (data = {}) => ({
  messageId: "message-1",
  data: {
    clipId: "clip-1",
    userId: "account-a",
    sessionId: "session-a",
    ...data,
  },
  notification: {
    title: "Untrusted title",
    body: "Untrusted clipboard payload",
  },
});

function setup(options = {}) {
  const host = createScreenHost();
  const auth = {
    currentUser: { uid: "account-a" },
    onAuthStateChanged: (callback) => {
      state.authChanged = callback;
      return () => state.removed.push("auth");
    },
  };
  let session = { userId: "account-a", id: "session-a" };
  let keyLoaded = true;
  const state = {
    reads: 0,
    writes: [],
    bindings: [],
    channels: [],
    toasts: [],
    tokenReads: 0,
    removed: [],
    callbacks: {},
    permission: options.permission ?? true,
  };
  const appState = {
    currentState: "active",
    addEventListener: (_name, callback) => {
      state.appStateChanged = callback;
      return { remove: () => state.removed.push("appState") };
    },
  };
  const on = (name) => (_instance, callback) => {
    state.callbacks[name] = callback;
    return () => state.removed.push(name);
  };
  const module = loadModule("services/backgroundSync.tsx", {
    react: {
      ...host.React,
      createContext: () => ({ Provider: "SyncProvider" }),
      useContext: () => ({}),
    },
    "react-native": {
      AppState: appState,
      Platform: {
        OS: options.platform || "android",
        Version: options.version || 35,
      },
      PermissionsAndroid: {
        PERMISSIONS: { POST_NOTIFICATIONS: "post" },
        RESULTS: { GRANTED: "granted" },
        check: options.checkPermission || (async () => state.permission),
        request: async () => (state.permission ? "granted" : "denied"),
      },
    },
    "@react-native-firebase/auth": { getAuth: () => auth },
    "@react-native-firebase/messaging": {
      getMessaging: () => ({}),
      AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
      hasPermission: async () => (state.permission ? 1 : 0),
      requestPermission: async () => (state.permission ? 1 : 0),
      getToken: async () => {
        state.tokenReads++;
        return options.token ? options.token() : "synthetic-token";
      },
      setBackgroundMessageHandler: (_instance, callback) => {
        state.background = callback;
      },
      getInitialNotification: options.initial || (async () => null),
      onMessage: on("message"),
      onTokenRefresh: on("refresh"),
      onNotificationOpenedApp: on("opened"),
    },
    "expo-notifications": {
      AndroidImportance: { HIGH: 6 },
      setNotificationChannelAsync: async (id, configuration) => {
        state.channels.push({ id, configuration });
      },
    },
    "expo-secure-store": {
      getItemAsync: options.preference || (async () => null),
      setItemAsync: options.persist || (async () => {}),
    },
    "react-native-toast-message": {
      show: (toast) => state.toasts.push(toast),
      hide() {},
    },
    "./pushSession": {
      capturePushSession: () => session,
      isPushSessionCurrent: (captured) =>
        captured === session && auth.currentUser?.uid === captured.userId,
    },
    "./crypto": { isKeyLoaded: () => keyLoaded },
    "./clipboard": {
      decryptClips: (clips) => clips,
      writeClipToClipboard: async (content, captured, allowed) => {
        assert.equal(captured, session);
        assert.equal(allowed(), true);
        state.writes.push(content);
      },
    },
    "./firebase": {
      getClips: async (captured) => {
        state.reads++;
        assert.equal(captured, session);
        return options.clips ? options.clips() : { key: sampleClip };
      },
      getDeviceId: async () => "current-device",
      getCurrentDeviceName: () => "Current device",
      updateDeviceFCMToken: async (uid, token, captured, allowed) => {
        if (!allowed() || captured !== session) return false;
        state.bindings.push({ uid, token });
        return true;
      },
    },
  });
  const render = () =>
    host.render(() => module.BackgroundSyncProvider({ children: null }));
  function mount() {
    render();
    host.flushEffects();
    return render().props.value;
  }
  return {
    module,
    state,
    host,
    render,
    mount,
    appState,
    switchAccount() {
      auth.currentUser = { uid: "account-b" };
      session = { userId: "account-b", id: "session-b" };
      state.authChanged?.(auth.currentUser);
    },
    clearKey() {
      keyLoaded = false;
    },
  };
}

test("notification data requires bounded account, session and clip identifiers", () => {
  const fixture = setup();
  for (const bad of [
    null,
    {},
    { data: {} },
    message({ clipId: "../other" }),
    message({ clipId: "a\n" }),
    message({ userId: "" }),
    message({ sessionId: {} }),
    message({ clipId: "x".repeat(257) }),
  ]) {
    assert.equal(fixture.module.parseClipNotification(bad), null);
  }
  assert.equal(
    fixture.module.parseClipNotification(message()).clipId,
    "clip-1",
  );
});

test("Android configures a high-importance channel for heads-up alerts", async () => {
  const fixture = setup();
  fixture.mount();
  await flush();
  assert.equal(fixture.state.channels.length, 1);
  const channel = fixture.state.channels[0];
  assert.equal(channel.id, "viclip_sync_notifications");
  assert.equal(channel.configuration.name, "Clipboard sync");
  assert.equal(
    channel.configuration.description,
    "Alerts when a clip arrives from another ViClip device.",
  );
  assert.equal(channel.configuration.importance, 6);
  assert.equal(channel.configuration.sound, undefined);
  assert.equal(channel.configuration.enableVibrate, true);
  assert.deepEqual(
    [...channel.configuration.vibrationPattern],
    [0, 250, 150, 250],
  );
  assert.equal(channel.configuration.showBadge, true);
  fixture.host.unmount();
});

test("unscoped, previous-account and previous-session notifications never read data", async () => {
  const fixture = setup();
  await fixture.module.handleCopyClipFromNotification({
    data: { clipId: "clip-1" },
  });
  await fixture.module.handleCopyClipFromNotification(
    message({ userId: "account-b" }),
  );
  await fixture.module.handleCopyClipFromNotification(
    message({ sessionId: "old-session" }),
  );
  assert.equal(fixture.state.reads, 0);
  assert.equal(fixture.state.writes.length, 0);
});

test("missing notification clips never fall back to the newest unrelated clip", async () => {
  const fixture = setup();
  await fixture.module.handleCopyClipFromNotification(
    message({ clipId: "missing" }),
  );
  assert.equal(fixture.state.reads, 1);
  assert.equal(fixture.state.writes.length, 0);
});

test("account changes during notification fetch prevent copying and success feedback", async () => {
  const pending = deferred();
  const fixture = setup({ clips: () => pending.promise });
  const copying = fixture.module.handleCopyClipFromNotification(message());
  await flush();
  fixture.switchAccount();
  pending.resolve({ key: sampleClip });
  await copying;
  assert.equal(fixture.state.writes.length, 0);
  assert.equal(fixture.state.toasts.length, 0);
});

test("duplicate notification deliveries write once and use generic local feedback", async () => {
  const fixture = setup();
  await Promise.all([
    fixture.module.handleCopyClipFromNotification(message()),
    fixture.module.handleCopyClipFromNotification(message()),
  ]);
  assert.deepEqual(fixture.state.writes, [sampleClip.content]);
  assert.equal(fixture.state.toasts[0].text2.includes("Untrusted"), false);
});

test("missing keys, corrupted content and inactive apps never write a notification clip", async () => {
  const missing = setup();
  missing.clearKey();
  await missing.module.handleCopyClipFromNotification(message());
  assert.equal(missing.state.reads, 0);
  const corrupt = setup({
    clips: async () => ({
      key: {
        ...sampleClip,
        content: "[Encrypted Content - Decryption Failed]",
        decryptionFailed: true,
      },
    }),
  });
  await corrupt.module.handleCopyClipFromNotification(message());
  assert.equal(corrupt.state.writes.length, 0);
  const background = setup();
  background.appState.currentState = "background";
  await background.module.handleCopyClipFromNotification(message());
  assert.equal(background.state.reads, 0);
});

test("denied Android and iOS permissions do not register tokens", async () => {
  for (const platform of ["android", "ios"]) {
    const fixture = setup({ permission: false, platform });
    fixture.mount();
    await flush();
    await flush();
    assert.equal(fixture.state.tokenReads, 0);
    assert.equal(fixture.state.bindings.at(-1).token, "");
    assert.equal(fixture.render().props.value.notificationsEnabled, false);
    fixture.host.unmount();
  }
});

test("preference loading completes before any token retrieval and disabled preferences clear binding", async () => {
  const pending = deferred();
  const fixture = setup({ preference: () => pending.promise });
  fixture.mount();
  await flush();
  assert.equal(fixture.state.tokenReads, 0);
  pending.resolve("false");
  await flush();
  await flush();
  assert.equal(fixture.state.tokenReads, 0);
  assert.equal(fixture.state.bindings.at(-1).token, "");
  fixture.host.unmount();
});

test("preference read failures pause notifications visibly", async () => {
  const fixture = setup({
    preference: async () => {
      throw new Error("Synthetic locked storage");
    },
  });
  fixture.mount();
  await flush();
  await flush();
  assert.equal(fixture.state.tokenReads, 0);
  assert.equal(fixture.render().props.value.syncEnabled, false);
  assert.equal(fixture.state.toasts[0].text1, "Notifications Paused");
  fixture.host.unmount();
});

test("pausing while token retrieval is pending prevents stale token binding", async () => {
  const pending = deferred();
  const fixture = setup({ token: () => pending.promise });
  const context = fixture.mount();
  await flush();
  assert.equal(fixture.state.tokenReads, 1);
  const pausing = context.toggleSync(false);
  pending.resolve("stale-token");
  await pausing;
  await flush();
  assert.equal(
    fixture.state.bindings.some((binding) => binding.token),
    false,
  );
  assert.equal(fixture.render().props.value.tokenRegistered, false);
  fixture.host.unmount();
});

test("unmounting cancels pending token binding and removes every listener", async () => {
  const pending = deferred();
  const fixture = setup({ token: () => pending.promise });
  fixture.mount();
  await flush();
  fixture.host.unmount();
  pending.resolve("late-token");
  await flush();
  assert.equal(fixture.state.bindings.length, 0);
  assert.deepEqual(fixture.state.removed.sort(), [
    "appState",
    "auth",
    "message",
    "opened",
    "refresh",
  ]);
});

test("preference write failure rejects the action and keeps notifications disabled", async () => {
  const fixture = setup({
    preference: async () => "false",
    persist: async () => {
      throw new Error("Synthetic storage failure");
    },
  });
  const context = fixture.mount();
  await flush();
  await flush();
  await assert.rejects(
    context.toggleSync(true),
    /save notification preference/,
  );
  assert.equal(fixture.render().props.value.syncEnabled, false);
  assert.equal(
    fixture.state.bindings.some((binding) => binding.token),
    false,
  );
  fixture.host.unmount();
});

test("foreground notification feedback ignores untrusted titles and delayed taps after pause", async () => {
  const fixture = setup();
  fixture.mount();
  await flush();
  await flush();
  fixture.state.callbacks.message(message());
  await flush();
  const toast = fixture.state.toasts.at(-1);
  assert.equal(toast.text1, "New Clip Received");
  assert.equal(toast.text2, "Tap to copy to clipboard");
  await fixture.render().props.value.toggleSync(false);
  toast.onPress();
  await flush();
  assert.equal(fixture.state.writes.length, 0);
  fixture.host.unmount();
});

test("late preference read rejection cannot undo a newer successful toggle", async () => {
  const pending = deferred();
  const fixture = setup({ preference: () => pending.promise });
  const context = fixture.mount();
  await context.toggleSync(true);
  pending.reject(new Error("Synthetic old read failure"));
  await flush();
  await flush();
  assert.equal(fixture.render().props.value.syncEnabled, true);
  assert.equal(
    fixture.state.toasts.some(
      (toast) => toast.text1 === "Notifications Paused",
    ),
    false,
  );
  fixture.host.unmount();
});

test("Android before API 33 respects disabled app notifications", async () => {
  const fixture = setup({ permission: false, version: 32 });
  fixture.mount();
  await flush();
  await flush();
  assert.equal(fixture.state.tokenReads, 0);
  assert.equal(fixture.render().props.value.notificationsEnabled, false);
  fixture.host.unmount();
});

test("cold-start notification waits for preferences and active foreground initialization", async () => {
  const pending = deferred();
  const fixture = setup({
    preference: () => pending.promise,
    initial: async () => message(),
  });
  fixture.mount();
  await flush();
  assert.equal(fixture.state.writes.length, 0);
  pending.resolve(null);
  await flush();
  await flush();
  assert.deepEqual(fixture.state.writes, [sampleClip.content]);
  fixture.host.unmount();
});

test("notification taps during inactive transition wait until the app becomes active", async () => {
  const fixture = setup();
  fixture.mount();
  await flush();
  await flush();
  fixture.appState.currentState = "inactive";
  fixture.state.callbacks.opened(message());
  await flush();
  assert.equal(fixture.state.writes.length, 0);
  fixture.appState.currentState = "active";
  fixture.state.appStateChanged("active");
  await flush();
  await flush();
  assert.deepEqual(fixture.state.writes, [sampleClip.content]);
  fixture.host.unmount();
});

test("initial notification is retained while the first permission check is pending", async () => {
  const pending = deferred();
  const fixture = setup({
    checkPermission: () => pending.promise,
    initial: async () => message(),
  });
  fixture.mount();
  await flush();
  assert.equal(fixture.state.writes.length, 0);
  pending.resolve(true);
  await flush();
  await flush();
  assert.deepEqual(fixture.state.writes, [sampleClip.content]);
  fixture.host.unmount();
});

test("StrictMode effect replay never revives an old token registration", async () => {
  const pending = deferred();
  let tokens = 0;
  const fixture = setup({
    token: () => (++tokens === 1 ? pending.promise : "current-token"),
  });
  fixture.mount();
  await flush();
  assert.equal(fixture.state.tokenReads, 1);
  fixture.host.replayEffects();
  pending.resolve("old-token");
  await flush();
  await flush();
  assert.equal(
    fixture.state.bindings.some((binding) => binding.token === "old-token"),
    false,
  );
  assert.equal(
    fixture.state.bindings.some((binding) => binding.token === "current-token"),
    true,
  );
  fixture.host.unmount();
});

test("a new account registers tokens without waiting on the previous account's token request", async () => {
  const pending = deferred();
  let reads = 0;
  const fixture = setup({
    token: () => (++reads === 1 ? pending.promise : "new-account-token"),
  });
  fixture.mount();
  await flush();
  fixture.switchAccount();
  await flush();
  await flush();
  assert.deepEqual(fixture.state.bindings, [
    { uid: "account-b", token: "new-account-token" },
  ]);
  pending.resolve("old-account-token");
  await flush();
  assert.equal(
    fixture.state.bindings.some(
      (binding) => binding.token === "old-account-token",
    ),
    false,
  );
  fixture.host.unmount();
});

test("new-account notifications proceed while an old-account fetch is stalled", async () => {
  const pending = deferred();
  let reads = 0;
  const fixture = setup({
    clips: () =>
      ++reads === 1 ? pending.promise : Promise.resolve({ key: sampleClip }),
  });
  const oldCopy = fixture.module.handleCopyClipFromNotification(message());
  await flush();
  fixture.switchAccount();
  const newCopy = fixture.module.handleCopyClipFromNotification(
    message({ userId: "account-b", sessionId: "session-b" }),
  );
  await flush();
  assert.deepEqual(fixture.state.writes, [sampleClip.content]);
  pending.resolve({ key: sampleClip });
  await oldCopy;
  await newCopy;
  assert.equal(fixture.state.writes.length, 1);
});

test("valid clipboard text identical to the failure label remains copyable", async () => {
  const content = "[Encrypted Content - Decryption Failed]";
  const fixture = setup({
    clips: async () => ({ key: { ...sampleClip, content } }),
  });
  await fixture.module.handleCopyClipFromNotification(message());
  assert.deepEqual(fixture.state.writes, [content]);
});
