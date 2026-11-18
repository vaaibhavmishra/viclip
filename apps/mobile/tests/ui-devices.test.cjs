const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule } = require("./helpers/load-module.cjs");
const {
  createScreenHost,
  native,
  findAll,
} = require("./helpers/render-screen.cjs");
const flush = () => new Promise((resolve) => setImmediate(resolve));
const otherDevice = {
  id: "installation-b",
  deviceName: "Test phone",
  platform: "Android",
  lastActive: "2026-11-15T12:00:00Z",
};

async function devicesScreen(fails = false) {
  const host = createScreenHost();
  const session = { userId: "account-a", id: "session-a" };
  const auth = { currentUser: { uid: "account-a" } };
  const state = { alerts: [], removes: 0, fetches: 0, callback: null };
  const Screen = loadModule(
    "app/(protected)/(tabs)/devices.tsx",
    {
      react: host.React,
      "react-native": {
        ...native,
        Alert: { alert: (...args) => state.alerts.push(args) },
      },
      "@expo/vector-icons/Ionicons": "Icon",
      "react-native-toast-message": { show() {} },
      "@react-native-firebase/auth": { getAuth: () => auth },
      "@/services/pushSession": {
        capturePushSession: () => session,
        isPushSessionCurrent: () => auth.currentUser?.uid === session.userId,
      },
      "@/services/firebase": {
        getDeviceId: async () => "installation-a",
        listenDevices: (callback) => {
          state.callback = callback;
          return () => {};
        },
        getDevices: async () => {
          state.fetches++;
          return { key: otherDevice };
        },
        removeDevice: async () => {
          state.removes++;
          if (fails) throw new Error("offline");
        },
      },
    },
    { React: host.React },
  ).default;
  const render = () => host.render(Screen);
  render();
  host.flushEffects();
  await flush();
  state.callback({ key: otherDevice });
  const list = findAll(render(), (node) => node.type === "FlatList")[0];
  const row = list.props.renderItem({
    item: { ...otherDevice, firebaseKey: "key" },
  });
  const remove = findAll(row, (node) => node.type === "TouchableOpacity")[0];
  remove.props.onPress();
  const confirmation = state.alerts[0][2].find(
    (value) => value.text === "Remove",
  );
  return { host, auth, state, render, confirmation };
}

test("delayed device-removal confirmation cannot act on a replacement account", async () => {
  const screen = await devicesScreen();
  screen.auth.currentUser = { uid: "account-b" };
  await screen.confirmation.onPress();
  assert.equal(screen.state.removes, 0);
});

test("failed optimistic device removal restores the device from an explicit refresh", async () => {
  const screen = await devicesScreen(true);
  await screen.confirmation.onPress();
  assert.equal(screen.state.fetches, 1);
  assert.equal(
    findAll(screen.render(), (node) => node.type === "FlatList")[0].props
      .data[0].id,
    otherDevice.id,
  );
});
