/** A deterministic hook host: executes real screen handlers with native APIs mocked. */
function createScreenHost() {
  let cursor = 0;
  const slots = [];
  let pendingEffects = [];
  const cleanups = [];
  const setups = [];
  const same = (a, b) =>
    a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const React = {
    Fragment: Symbol("Fragment"),
    createElement(type, props, ...children) {
      return { type, props: { ...props, children } };
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (value) => {
          slots[index] =
            typeof value === "function" ? value(slots[index]) : value;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps))
        slots[index] = { deps, callback };
      return slots[index].callback;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index], deps)) {
        setups[index] = effect;
        pendingEffects.push(() => {
          cleanups[index]?.();
          cleanups[index] = effect();
        });
        slots[index] = deps;
      }
    },
  };
  return {
    React,
    render(Component) {
      cursor = 0;
      return Component();
    },
    flushEffects() {
      const effects = pendingEffects;
      pendingEffects = [];
      for (const effect of effects) effect();
    },
    unmount() {
      for (const cleanup of cleanups)
        if (typeof cleanup === "function") cleanup();
    },
    replayEffects() {
      for (const cleanup of cleanups)
        if (typeof cleanup === "function") cleanup();
      for (const [index, setup] of setups.entries())
        if (typeof setup === "function") cleanups[index] = setup();
    },
  };
}

function findAll(tree, predicate) {
  const result = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (predicate(node)) result.push(node);
    visit(node.props?.children);
  }
  visit(tree);
  return result;
}

function textOf(tree) {
  if (tree === null || tree === undefined || typeof tree === "boolean")
    return "";
  if (typeof tree !== "object") return String(tree);
  if (Array.isArray(tree)) return tree.map(textOf).join("");
  return textOf(tree.props?.children);
}

const native = Object.fromEntries(
  [
    "ActivityIndicator",
    "View",
    "Text",
    "FlatList",
    "TouchableOpacity",
    "TextInput",
    "Modal",
    "TouchableWithoutFeedback",
    "KeyboardAvoidingView",
    "ScrollView",
    "Image",
    "Switch",
  ].map((name) => [name, name]),
);
Object.assign(native, {
  useColorScheme: () => "light",
  useWindowDimensions: () => ({
    height: 800,
    width: 390,
    scale: 1,
    fontScale: 1,
  }),
  StyleSheet: { create: (value) => value },
  Dimensions: {
    get: () => ({ height: 800, width: 390, scale: 1, fontScale: 1 }),
  },
  Platform: { OS: "android", Version: 35 },
  AppState: { currentState: "active" },
  Keyboard: { dismiss() {} },
  BackHandler: { exitApp() {}, addEventListener: () => ({ remove() {} }) },
});

const animation = new Proxy({}, { get: () => () => animation });
const animated = {
  default: { View: "AnimatedView" },
  FadeInDown: animation,
  FadeInUp: animation,
  FadeOutUp: animation,
  LinearTransition: animation,
  __esModule: true,
};
module.exports = { createScreenHost, findAll, textOf, native, animated };
