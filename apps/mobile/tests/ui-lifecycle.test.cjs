const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule, deferred } = require("./helpers/load-module.cjs");
const {
  createScreenHost,
  findAll,
  textOf,
  native,
  animated,
} = require("./helpers/render-screen.cjs");

const sampleClip = {
  id: "clip-1",
  content: "Original",
  type: "text",
  timestamp: "2026-11-15T12:00:00.000Z",
  sourceDevice: "Test",
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

function clipboardScreen(overrides = {}) {
  const host = createScreenHost();
  const auth = { currentUser: { uid: "account-a" } };
  const session = { userId: "account-a", id: "session-a" };
  const state = {
    reads: 0,
    writes: [],
    sends: [],
    toasts: [],
    clears: 0,
    listener: null,
    alerts: [],
    unsubscribed: 0,
  };
  const clipboard = {
    getStringAsync: async () => {
      state.reads++;
      return "Synthetic clipboard";
    },
    setStringAsync: async (content) => {
      state.writes.push(content);
    },
    ...overrides.clipboard,
  };
  const firebase = {
    getClips: async () => ({ key: sampleClip }),
    listenClips: (callback) => {
      state.listener = callback;
      return () => {
        state.unsubscribed++;
      };
    },
    togglePinClip: async () => {},
    removeClip: async () => {},
    removeAllClips: async () => {},
    ...overrides.firebase,
  };
  const share = {
    hasShareIntent: false,
    shareIntent: null,
    resetShareIntent: () => {
      state.clears++;
    },
    ...overrides.share,
  };
  const service = {
    decryptClips: (clips) => clips,
    writeClipToClipboard: async (content, _session, isAllowed) => {
      if (!isAllowed()) throw new Error("Synthetic inactive scope");
      await clipboard.setStringAsync(content);
    },
    sendClip: async (...args) => {
      state.sends.push(args);
    },
    editClip: async () => {},
    ...overrides.service,
  };
  const mocks = {
    react: host.React,
    "react-native": {
      ...native,
      ...overrides.native,
      Alert: { alert: (...args) => state.alerts.push(args) },
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () =>
        overrides.insets ?? { top: 24, bottom: 48, left: 0, right: 0 },
    },
    "@expo/vector-icons/Ionicons": "Icon",
    "expo-blur": { BlurView: "BlurView" },
    "expo-clipboard": clipboard,
    "expo-router": { useFocusEffect() {} },
    "expo-share-intent": { useShareIntentContext: () => share },
    "react-native-reanimated": animated,
    "react-native-toast-message": { show: (toast) => state.toasts.push(toast) },
    "@/services/clipboard": service,
    "@/services/firebase": firebase,
    "@react-native-firebase/auth": { getAuth: () => auth },
    "@/services/pushSession": {
      capturePushSession: () => session,
      isPushSessionCurrent: (value) =>
        value === session && auth.currentUser?.uid === session.userId,
    },
  };
  const Screen = loadModule("app/(protected)/(tabs)/index.tsx", mocks, {
    React: host.React,
  }).default;
  const render = () => host.render(Screen);
  render();
  host.flushEffects();
  state.listener({ key: sampleClip });
  return { host, auth, session, state, share, render };
}

function flattenedStyle(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

test("small-screen clip actions reserve their height instead of overlaying history", () => {
  const screen = clipboardScreen({
    native: {
      useWindowDimensions: () => ({
        width: 320,
        height: 568,
        scale: 2,
        fontScale: 2,
      }),
    },
  });
  const tree = screen.render();
  const area = findAll(
    tree,
    (node) =>
      node.type === "View" &&
      findAll(node, (child) => child.type === "BlurView").length > 0,
  ).at(-1);
  const style = flattenedStyle(area.props.style);
  assert.notEqual(style.position, "absolute");
  assert.ok(style.marginBottom >= 48 + 12 + 76);
  assert.ok(
    flattenedStyle(list(tree).props.contentContainerStyle).paddingTop <= 24,
  );
});

test("clip editor can scroll its save action above the Android keyboard", () => {
  const screen = clipboardScreen();
  const tree = screen.render();
  const row = list(tree).props.renderItem({ item: sampleClip, index: 0 });
  findAll(
    row,
    (node) => node.props.accessibilityLabel === "Edit clip",
  )[0].props.onPress();
  const modal = findAll(
    screen.render(),
    (node) => node.type === "Modal" && node.props.visible,
  )[0];
  const keyboard = findAll(
    modal,
    (node) => node.type === "KeyboardAvoidingView",
  )[0];
  assert.equal(keyboard.props.behavior, "height");
  assert.equal(flattenedStyle(keyboard.props.style).flex, 1);
  const scroll = findAll(modal, (node) => node.type === "ScrollView")[0];
  assert.ok(scroll);
  assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
  assert.ok(button(scroll, "Save"));
});

function button(tree, text) {
  return findAll(
    tree,
    (node) => node.type === "TouchableOpacity" && textOf(node) === text,
  )[0];
}
function list(tree) {
  return findAll(tree, (node) => node.type === "FlatList")[0];
}
function action(row, icon) {
  return findAll(
    row,
    (node) =>
      node.type === "TouchableOpacity" &&
      findAll(
        node,
        (child) => child.type === "Icon" && child.props.name === icon,
      ).length > 0,
  )[0];
}

test("screen mounting does not read the real clipboard and removes its listener on unmount", () => {
  const screen = clipboardScreen();
  assert.equal(screen.state.reads, 0);
  screen.host.unmount();
  assert.equal(screen.state.unsubscribed, 1);
});

test("failed edit retains the draft and edit modal for retry", async () => {
  const screen = clipboardScreen({
    service: {
      editClip: async () => {
        throw new Error("offline");
      },
    },
  });
  const row = list(screen.render()).props.renderItem({
    item: sampleClip,
    index: 0,
  });
  action(row, "create-outline").props.onPress();
  let tree = screen.render();
  findAll(tree, (node) => node.type === "TextInput")[0].props.onChangeText(
    "Unsaved draft",
  );
  tree = screen.render();
  await button(tree, "Save").props.onPress();
  tree = screen.render();
  assert.equal(
    findAll(tree, (node) => node.type === "Modal")[0].props.visible,
    true,
  );
  assert.equal(
    findAll(tree, (node) => node.type === "TextInput")[0].props.value,
    "Unsaved draft",
  );
  assert.equal(screen.state.toasts.at(-1).text1, "Failed to Update Clip");
});

test("logout while native clipboard read is pending prevents upload and success feedback", async () => {
  const pending = deferred();
  const screen = clipboardScreen({
    clipboard: { getStringAsync: () => pending.promise },
  });
  const send = button(screen.render(), "Send");
  const operation = send.props.onPress();
  screen.auth.currentUser = { uid: "account-b" };
  pending.resolve("Private content from account A");
  await operation;
  assert.equal(screen.state.sends.length, 0);
  assert.equal(screen.state.toasts.length, 0);
});

test("failed copy does not claim success or select the clip", async () => {
  const screen = clipboardScreen({
    clipboard: {
      setStringAsync: async () => {
        throw new Error("denied");
      },
    },
  });
  const row = list(screen.render()).props.renderItem({
    item: sampleClip,
    index: 0,
  });
  await action(row, "copy-outline").props.onPress();
  assert.equal(screen.state.toasts.at(-1).text1, "Could Not Copy");
  assert.equal(list(screen.render()).props.extraData, undefined);
});

test("an older fetch cannot overwrite a newer live snapshot", async () => {
  const pending = deferred();
  const screen = clipboardScreen({
    firebase: { getClips: () => pending.promise },
  });
  const refresh = list(screen.render()).props.onRefresh();
  screen.state.listener({
    latest: { ...sampleClip, content: "Newer live content" },
  });
  pending.resolve({ older: sampleClip });
  await refresh;
  assert.equal(
    list(screen.render()).props.data[0].content,
    "Newer live content",
  );
});

test("shared input is consumed once and never uploads temporary file URIs", async () => {
  const screen = clipboardScreen({
    share: {
      hasShareIntent: true,
      shareIntent: { files: [{ path: "content://private/cache/file.pdf" }] },
    },
  });
  await flush();
  screen.render();
  screen.host.flushEffects();
  await flush();
  assert.equal(screen.state.clears, 1);
  assert.equal(screen.state.sends.length, 0);
  assert.equal(screen.state.toasts.at(-1).text1, "Cannot Share This Content");
});

test("delayed history-clear confirmation cannot clear a replacement account", async () => {
  let clears = 0;
  const screen = clipboardScreen({
    firebase: {
      removeAllClips: async () => {
        clears++;
      },
    },
  });
  list(screen.render()).props.ListFooterComponent.props.onPress();
  const confirmation = screen.state.alerts[0][2].find(
    (value) => value.text === "Clear All",
  );
  screen.auth.currentUser = { uid: "account-b" };
  await confirmation.onPress();
  assert.equal(clears, 0);
});

test("a receive response superseded by a live clip cannot copy older content", async () => {
  const pending = deferred();
  const screen = clipboardScreen({
    firebase: { getClips: () => pending.promise },
  });
  const receive = button(screen.render(), "Receive").props.onPress();
  screen.state.listener({
    latest: { ...sampleClip, content: "Newer live content" },
  });
  pending.resolve({ older: sampleClip });
  await receive;
  assert.equal(screen.state.writes.length, 0);
  assert.equal(
    list(screen.render()).props.data[0].content,
    "Newer live content",
  );
});

test("an inactive app does not submit a native clipboard copy", async () => {
  const screen = clipboardScreen();
  const row = list(screen.render()).props.renderItem({
    item: sampleClip,
    index: 0,
  });
  native.AppState.currentState = "background";
  try {
    await action(row, "copy-outline").props.onPress();
    assert.equal(screen.state.writes.length, 0);
  } finally {
    native.AppState.currentState = "active";
  }
});

test("share parser bounds text and rejects malformed or unsupported web links", () => {
  const { getSharedText } = loadModule("utils/util.ts");
  assert.throws(() => getSharedText({ webUrl: "javascript:alert(1)" }), /HTTP/);
  assert.throws(() => getSharedText({ webUrl: "https://" }));
  assert.throws(() => getSharedText({ text: "x".repeat(1000001) }), /maximum/);
  assert.equal(getSharedText({ text: 42 }), "");
  assert.equal(
    getSharedText({ webUrl: "https://example.test/path" }),
    "https://example.test/path",
  );
});
