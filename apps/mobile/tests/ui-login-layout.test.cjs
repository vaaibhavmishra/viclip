const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule } = require("./helpers/load-module.cjs");
const {
  createScreenHost,
  native,
  animated,
  findAll,
  textOf,
} = require("./helpers/render-screen.cjs");

const styleOf = (style) =>
  Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

function loginScreen(options = {}) {
  const host = createScreenHost();
  const window = {
    width: 1024,
    height: 800,
    fontScale: 1,
    ...options.window,
  };
  const insets = { top: 24, bottom: 32, left: 0, right: 0, ...options.insets };
  const Screen = loadModule(
    "app/login.tsx",
    {
      react: host.React,
      "react-native": { ...native, useWindowDimensions: () => window },
      "react-native-reanimated": animated,
      "react-native-safe-area-context": {
        SafeAreaView: "SafeAreaView",
        useSafeAreaInsets: () => insets,
      },
      "@expo/vector-icons": { Feather: "Feather" },
      "expo-router": { useRouter: () => ({ replace() {} }) },
      "react-native-toast-message": { show() {} },
      "@/utils/openExternalLink": { openExternalLink: async () => {} },
      "../assets/images/viclip-icon-small.png": "synthetic-asset",
      "../services/auth": {
        loginUser: options.loginUser || (async () => {}),
        resetPassword: async () => {},
        signupUser: async () => {},
        recoverAccountWithOldPassword: async () => {},
        resetAccountData: async () => {},
      },
    },
    { React: host.React, Error },
  ).default;
  const render = () => host.render(Screen);
  render();
  host.flushEffects();
  return { render, window, insets };
}

function button(tree, label) {
  return findAll(
    tree,
    (node) => node.type === "TouchableOpacity" && textOf(node) === label,
  )[0];
}

function input(tree, placeholder) {
  return findAll(
    tree,
    (node) =>
      node.type === "TextInput" && node.props.placeholder === placeholder,
  )[0];
}

function cardStyle(tree) {
  return styleOf(
    findAll(
      tree,
      (node) =>
        node.type === "AnimatedView" &&
        styleOf(node.props.style).maxWidth &&
        textOf(node).includes("Welcome to ViClip"),
    )[0].props.style,
  );
}

test("login adapts a tablet form to a narrow split window without losing input", () => {
  const screen = loginScreen();
  let tree = screen.render();
  const tabletCard = cardStyle(tree);
  assert.ok(tabletCard.maxWidth <= 480);
  assert.equal(tabletCard.alignSelf, "center");
  input(tree, "you@example.com").props.onChangeText("test@example.test");

  Object.assign(screen.window, { width: 320, height: 480, fontScale: 1.5 });
  tree = screen.render();
  const narrowCard = cardStyle(tree);
  assert.equal(input(tree, "you@example.com").props.value, "test@example.test");
  assert.ok(narrowCard.paddingHorizontal < tabletCard.paddingHorizontal);
  assert.ok(narrowCard.paddingVertical < tabletCard.paddingVertical);
  assert.equal(narrowCard.width, "100%");
  assert.ok(
    findAll(tree, (node) => node.type === "KeyboardAvoidingView").every(
      (node) => node.props.behavior === "height",
    ),
  );
});

test("signup keeps confirmation and wrapping actions in its scrollable form", () => {
  const screen = loginScreen({
    window: { width: 320, height: 480, fontScale: 2 },
  });
  button(screen.render(), "Sign up").props.onPress();
  const tree = screen.render();
  const pageScroll = findAll(tree, (node) => node.type === "ScrollView")[0];
  assert.ok(input(pageScroll, "Confirm your password"));
  assert.equal(pageScroll.props.keyboardShouldPersistTaps, "handled");
  const submit = button(pageScroll, "Create Account");
  assert.equal(styleOf(submit.props.style).flexWrap, "wrap");
  const submitText = findAll(submit, (node) => node.type === "Text")[0];
  assert.equal(styleOf(submitText.props.style).textAlign, "center");
  assert.ok(styleOf(submitText.props.style).flexShrink > 0);
  const toggleRow = findAll(
    pageScroll,
    (node) =>
      node.type === "AnimatedView" &&
      textOf(node) === "Already have an account?Log in",
  )[0];
  assert.equal(styleOf(toggleRow.props.style).flexWrap, "wrap");
});

test("recovery keeps the previous password in a bounded safe-area scroll after rotation", async () => {
  const screen = loginScreen({
    loginUser: async () => {
      throw new Error("ERR_KEY_DECRYPTION_FAILED");
    },
  });
  let tree = screen.render();
  input(tree, "you@example.com").props.onChangeText("test@example.test");
  input(tree, "Enter your password").props.onChangeText("Synthetic password");
  await button(screen.render(), "Sign In").props.onPress();
  tree = screen.render();
  input(tree, "Enter previous password").props.onChangeText(
    "Previous password",
  );

  Object.assign(screen.window, { width: 800, height: 360, fontScale: 2 });
  Object.assign(screen.insets, { top: 0, bottom: 24, left: 48, right: 12 });
  tree = screen.render();
  const modal = findAll(
    tree,
    (node) => node.type === "Modal" && node.props.visible,
  )[0];
  const overlay = modal.props.children[0];
  const overlayStyle = styleOf(overlay.props.style);
  for (const edge of ["top", "bottom", "left", "right"]) {
    const padding = `padding${edge[0].toUpperCase()}${edge.slice(1)}`;
    assert.ok(overlayStyle[padding] > screen.insets[edge]);
  }
  const keyboardView = findAll(
    modal,
    (node) => node.type === "KeyboardAvoidingView",
  )[0];
  assert.equal(keyboardView.props.behavior, "height");
  assert.equal(styleOf(keyboardView.props.style).flex, 1);
  const scroll = findAll(modal, (node) => node.type === "ScrollView")[0];
  assert.ok(styleOf(scroll.props.style).flexShrink > 0);
  assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
  assert.equal(
    input(scroll, "Enter previous password").props.value,
    "Previous password",
  );
  assert.ok(button(scroll, "Recover & Decrypt Clips"));
  assert.ok(button(scroll, "Cancel"));
});
