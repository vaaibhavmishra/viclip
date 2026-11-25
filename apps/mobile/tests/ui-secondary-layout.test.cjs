const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule } = require("./helpers/load-module.cjs");
const {
  createScreenHost,
  findAll,
  native,
  textOf,
} = require("./helpers/render-screen.cjs");

const flatten = (style) =>
  Object.assign({}, ...(Array.isArray(style) ? style.flat() : [style]));
const session = { userId: "account-a", id: "session-a" };
const scope = { capture: () => session, isCurrent: () => true };
const compactLayout = {
  isCompact: true,
  contentContainerStyle: {
    paddingTop: 16,
    paddingBottom: 140,
    paddingLeft: 12,
    paddingRight: 28,
    flexGrow: 1,
  },
};

function settingsScreen() {
  const host = createScreenHost();
  const Screen = loadModule(
    "app/(protected)/(tabs)/settings.tsx",
    {
      react: host.React,
      "react-native": { ...native, Alert: { alert() {} } },
      "@expo/vector-icons/Ionicons": "Icon",
      "@react-native-firebase/auth": {
        getAuth: () => ({ currentUser: { displayName: "Long account name" } }),
      },
      "expo-router": { router: { replace() {} } },
      "react-native-toast-message": { show() {} },
      "@/services/auth": { logoutUser: async () => {} },
      "@/services/backgroundSync": {
        useBackgroundSync: () => ({ notificationsEnabled: false }),
      },
      "@/utils/openExternalLink": { openExternalLink: async () => {} },
      "@/utils/sessionScope": { useSessionScope: () => scope },
      "@/utils/layout": { useResponsiveLayout: () => compactLayout },
      "../../../assets/images/default-avatar.png": "Avatar",
    },
    { React: host.React },
  ).default;
  return { host, tree: host.render(Screen) };
}

test("settings follows responsive scroll insets and retains policy actions", () => {
  const { tree } = settingsScreen();
  assert.deepEqual(
    tree.props.contentContainerStyle,
    compactLayout.contentContainerStyle,
  );
  const links = findAll(
    tree,
    (node) => node.props?.accessibilityRole === "link",
  );
  assert.deepEqual(
    links.map((node) => node.props.accessibilityLabel),
    ["Delete account", "Privacy Policy", "Terms of Service"],
  );
});

test("notification permission instructions and actions can wrap at large fonts", () => {
  const { host, tree } = settingsScreen();
  const card = findAll(tree, (node) => typeof node.type === "function")[0];
  const rendered = host.render(card.type);
  const subtitle = findAll(
    rendered,
    (node) =>
      node.type === "Text" &&
      textOf(node) === "Tap to enable push notifications",
  )[0];
  assert.equal(subtitle.props.numberOfLines, undefined);
  const cta = findAll(
    rendered,
    (node) =>
      node.type === "Text" && textOf(node) === "Enable Push Notifications",
  )[0];
  assert.equal(flatten(cta.props.style).flexShrink, 1);
  const status = findAll(
    rendered,
    (node) =>
      node.type === "View" && textOf(node) === "StatusPermission Needed",
  )[0];
  assert.equal(flatten(status.props.style).flexWrap, "wrap");
});

test("devices preserves long names and current-device badges within the row", async () => {
  const host = createScreenHost();
  let listener;
  const Screen = loadModule(
    "app/(protected)/(tabs)/devices.tsx",
    {
      react: host.React,
      "react-native": { ...native, Alert: { alert() {} } },
      "@expo/vector-icons/Ionicons": "Icon",
      "react-native-toast-message": { show() {} },
      "@/utils/sessionScope": { useSessionScope: () => scope },
      "@/utils/layout": { useResponsiveLayout: () => compactLayout },
      "@/services/firebase": {
        getDeviceId: async () => "installation-a",
        listenDevices(callback) {
          listener = callback;
          return () => {};
        },
      },
    },
    { React: host.React },
  ).default;
  host.render(Screen);
  host.flushEffects();
  await Promise.resolve();
  const item = {
    id: "installation-a",
    deviceName: "A very long Android tablet installation name",
    platform: "Android",
    lastActive: "2026-11-24T12:00:00Z",
    firebaseKey: "device-a",
  };
  listener({ "device-a": item });
  const list = findAll(
    host.render(Screen),
    (node) => node.type === "FlatList",
  )[0];
  assert.deepEqual(
    list.props.contentContainerStyle,
    compactLayout.contentContainerStyle,
  );
  assert.equal(flatten(list.props.style).paddingHorizontal, undefined);
  const row = list.props.renderItem({ item });
  const name = findAll(
    row,
    (node) => node.type === "Text" && textOf(node) === item.deviceName,
  )[0];
  assert.equal(flatten(name.props.style).flexShrink, 1);
  const nameRow = findAll(
    row,
    (node) =>
      node.type === "View" && textOf(node) === `${item.deviceName}This Device`,
  )[0];
  assert.equal(flatten(nameRow.props.style).flexWrap, "wrap");
  const emptyStyle = flatten(list.props.ListEmptyComponent.props.style);
  assert.equal(emptyStyle.marginTop, undefined);
  assert.equal(emptyStyle.flexGrow, 1);
});
