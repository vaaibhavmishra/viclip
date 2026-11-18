const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule, deferred } = require("./helpers/load-module.cjs");
const {
  createScreenHost,
  native,
  animated,
  findAll,
  textOf,
} = require("./helpers/render-screen.cjs");

function loginScreen(options = {}) {
  const host = createScreenHost();
  const pending = deferred();
  const state = {
    logins: 0,
    resets: 0,
    recoveries: 0,
    resetCalls: [],
    navigations: [],
  };
  const Screen = loadModule(
    "app/login.tsx",
    {
      react: host.React,
      "react-native": native,
      "react-native-reanimated": animated,
      "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
      "@expo/vector-icons": { Feather: "Feather" },
      "expo-router": {
        useRouter: () => ({ replace: (path) => state.navigations.push(path) }),
      },
      "react-native-toast-message": { show() {} },
      "../assets/images/viclip-icon-small.png": "synthetic-asset",
      "../services/auth": {
        loginUser: (...args) => {
          state.logins++;
          if (options.loginUser) return options.loginUser(...args);
          return pending.promise;
        },
        resetPassword: async () => {
          state.resets++;
        },
        signupUser: async () => {},
        recoverAccountWithOldPassword: async () => {
          state.recoveries++;
        },
        resetAccountData: async (...args) => {
          state.resetCalls.push(args);
        },
      },
    },
    { React: host.React, Error },
  ).default;
  const render = () => host.render(Screen);
  let tree = render();
  host.flushEffects();
  findAll(
    tree,
    (node) =>
      node.type === "TextInput" && node.props.placeholder === "you@example.com",
  )[0].props.onChangeText("test@example.test");
  findAll(
    tree,
    (node) => node.type === "TextInput" && node.props.secureTextEntry,
  )[0].props.onChangeText("Synthetic password");
  tree = render();
  const signIn = findAll(
    tree,
    (node) => node.type === "TouchableOpacity" && textOf(node) === "Sign In",
  )[0];
  return { host, pending, state, render, signIn, tree };
}

test("two same-frame sign-in taps start one authentication operation", async () => {
  const screen = loginScreen();
  const first = screen.signIn.props.onPress();
  const second = screen.signIn.props.onPress();
  assert.equal(screen.state.logins, 1);
  screen.pending.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(screen.state.navigations, ["/"]);
});

test("authentication completion after screen unmount does not redirect another screen", async () => {
  const screen = loginScreen();
  const operation = screen.signIn.props.onPress();
  screen.host.unmount();
  screen.pending.resolve();
  await operation;
  assert.deepEqual(screen.state.navigations, []);
});

test("password reset does not overlap a pending sign-in", async () => {
  const screen = loginScreen();
  const operation = screen.signIn.props.onPress();
  const forgot = findAll(
    screen.tree,
    (node) =>
      node.type === "TouchableOpacity" && textOf(node).includes("Forgot"),
  )[0];
  await forgot.props.onPress();
  assert.equal(screen.state.resets, 0);
  screen.pending.resolve();
  await operation;
});

test("missing encryption metadata offers an explicit start-fresh dialog", async () => {
  const screen = loginScreen({
    loginUser: async () => {
      throw new Error("ERR_KEY_METADATA_MISSING");
    },
  });

  await screen.signIn.props.onPress();
  let tree = screen.render();
  let modal = findAll(
    tree,
    (node) => node.type === "Modal" && node.props.visible,
  )[0];

  assert.ok(modal);
  assert.match(textOf(modal), /Encryption setup missing/);
  assert.match(textOf(modal), /test@example\.test/);
  assert.match(textOf(modal), /This can’t be undone/);
  assert.equal(
    findAll(
      modal,
      (node) =>
        node.type === "TextInput" &&
        node.props.placeholder === "Enter previous password",
    ).length,
    0,
  );
  assert.deepEqual(screen.state.resetCalls, []);

  findAll(
    tree,
    (node) =>
      node.type === "TextInput" && node.props.placeholder === "you@example.com",
  )[0].props.onChangeText("changed@example.test");
  findAll(
    tree,
    (node) =>
      node.type === "TextInput" &&
      node.props.placeholder === "Enter your password",
  )[0].props.onChangeText("Changed password");

  tree = screen.render();
  modal = findAll(
    tree,
    (node) => node.type === "Modal" && node.props.visible,
  )[0];
  const startFresh = findAll(
    modal,
    (node) =>
      node.type === "TouchableOpacity" &&
      textOf(node) === "Delete data & start fresh",
  )[0];

  assert.ok(startFresh);
  await startFresh.props.onPress();
  assert.deepEqual(screen.state.resetCalls, [
    ["test@example.test", "Synthetic password"],
  ]);
  assert.equal(screen.state.recoveries, 0);
  assert.deepEqual(screen.state.navigations, ["/"]);
});
