const assert = require("node:assert/strict");
const test = require("node:test");
const { loadModule } = require("./helpers/load-module.cjs");
const { createScreenHost, native } = require("./helpers/render-screen.cjs");

function navigation(dimensions, insets) {
  const host = createScreenHost();
  const viewport = { dimensions, insets };
  const Screen = loadModule(
    "app/(protected)/(tabs)/_layout.tsx",
    {
      react: host.React,
      "react-native": {
        ...native,
        useWindowDimensions: () => viewport.dimensions,
      },
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => viewport.insets,
      },
      "@expo/vector-icons/Ionicons": "Icon",
      "expo-blur": { BlurView: "BlurView" },
      "expo-router": { Tabs: Object.assign(() => {}, { Screen: "TabScreen" }) },
    },
    { React: host.React },
  ).default;
  return {
    viewport,
    render: () => host.render(Screen),
    options: (name = "index") => {
      const options = host.render(Screen).props.screenOptions;
      return typeof options === "function"
        ? options({ route: { name } })
        : options;
    },
  };
}

test("Android tabs clear three-button navigation and do not overlay the header", () => {
  const screen = navigation(
    { width: 320, height: 568, scale: 2, fontScale: 1 },
    { top: 24, bottom: 48, left: 0, right: 0 },
  );
  const options = screen.options();
  assert.ok(options.tabBarStyle.bottom >= 60);
  assert.equal(options.headerTransparent, false);
  assert.ok(options.headerStyle.height >= 24 + 64);
});

test("tab labels gain vertical room with Android font scaling", () => {
  const screen = navigation(
    { width: 320, height: 568, scale: 2, fontScale: 2 },
    { top: 24, bottom: 24, left: 0, right: 0 },
  );
  assert.ok(screen.options().tabBarStyle.height >= 76);
});

test("header grows for accessibility text and its measured wrapped title", () => {
  const screen = navigation(
    { width: 320, height: 568, scale: 2, fontScale: 3 },
    { top: 24, bottom: 24, left: 0, right: 0 },
  );
  assert.ok((screen.options().headerStyle?.height ?? 0) >= 24 + 72 + 16);
  const tab = screen.render().props.children.flat()[0];
  const title = tab.props.options.headerTitle();
  title.props.onHeightChange(160);
  assert.ok(screen.options().headerStyle.height >= 24 + 160 + 16);
  assert.ok(screen.options("settings").headerStyle.height < 24 + 160 + 16);
});

test("tablet tabs stay centered and resize into a narrow split-screen window", () => {
  const screen = navigation(
    { width: 1280, height: 800, scale: 2, fontScale: 1 },
    { top: 24, bottom: 24, left: 0, right: 0 },
  );
  let bar = screen.options().tabBarStyle;
  assert.ok(1280 - bar.left - bar.right <= 480);
  assert.equal(bar.left, bar.right);

  screen.viewport.dimensions = {
    width: 320,
    height: 568,
    scale: 2,
    fontScale: 1,
  };
  bar = screen.options().tabBarStyle;
  assert.ok(bar.left >= 12 && bar.right >= 12);
  assert.ok(320 - bar.left - bar.right >= 280);
});

test("landscape tabs stay between side cutouts", () => {
  const screen = navigation(
    { width: 640, height: 360, scale: 2, fontScale: 1 },
    { top: 0, bottom: 24, left: 44, right: 0 },
  );
  const bar = screen.options().tabBarStyle;
  assert.ok(bar.left >= 56);
  assert.ok(bar.right >= 12);
  assert.equal(bar.paddingHorizontal, 0);
});
