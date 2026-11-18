const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { loadModule } = require("./helpers/load-module.cjs");

const mobileRoot = path.resolve(__dirname, "..");
const configPath = path.join(mobileRoot, "metro.config.cjs");
const mobileRequire = createRequire(configPath);
const resolverImport =
  "@react-native-firebase/app/dist/module/internal/nativeModule";
const appRoot = path.dirname(
  mobileRequire.resolve("@react-native-firebase/app/package.json"),
);
const databaseRoot = path.dirname(
  mobileRequire.resolve("@react-native-firebase/database/package.json"),
);

function loadConfig(resolveRequest) {
  const defaults = {
    resolver: resolveRequest ? { resolveRequest } : {},
    transformer: { retained: true },
  };
  const module = { exports: {} };
  function configRequire(request) {
    if (request === "expo/metro-config") {
      return {
        getDefaultConfig(root) {
          assert.equal(root, mobileRoot);
          return defaults;
        },
      };
    }
    return mobileRequire(request);
  }
  configRequire.resolve = mobileRequire.resolve;
  vm.runInNewContext(fs.readFileSync(configPath, "utf8"), {
    require: configRequire,
    module,
    exports: module.exports,
    __dirname: mobileRoot,
    __filename: configPath,
  });
  return module.exports;
}

// Model a bundler that honors package exports: an export target is an exact
// file, so nativeModule.js wins over its Android/iOS siblings without our hook.
function resolveWithExports(config, platform) {
  return config.resolver.resolveRequest(
    {
      resolveRequest(_context, request) {
        return {
          type: "sourceFile",
          filePath: mobileRequire.resolve(request),
        };
      },
    },
    resolverImport,
    platform,
  ).filePath;
}

function loadNativeResolver(file, native) {
  return loadModule(file, {
    "react-native": {
      TurboModuleRegistry: {
        get(name) {
          assert.equal(name, "NativeRNFBTurboDatabaseQuery");
          return native;
        },
      },
    },
    [path.join(appRoot, "dist/module/internal/web/RNFBAppModule.js")]: {},
  });
}

function loadSyncTree(resolver) {
  const events = new EventEmitter();
  const emitter = {
    addListener(name, listener) {
      events.on(name, listener);
      return {
        listener,
        remove: () => events.off(name, listener),
      };
    },
    emit: (name, ...args) => events.emit(name, ...args),
    removeAllListeners: (name) => events.removeAllListeners(name),
  };
  const tree = loadModule(
    path.join(databaseRoot, "dist/module/DatabaseSyncTree.js"),
    {
      "@react-native-firebase/app/dist/module/common": {
        isString: (value) => typeof value === "string",
      },
      "@react-native-firebase/app/dist/module/internal/NativeFirebaseError": {
        fromEvent: () => new Error("Synthetic cancellation"),
      },
      "@react-native-firebase/app/dist/module/internal/SharedEventEmitter":
        emitter,
      [resolverImport]: resolver,
      "./DatabaseDataSnapshot.js": class {
        constructor(_ref, data) {
          this.value = data.value;
        }
        val() {
          return this.value;
        }
      },
    },
  ).default;
  return { tree, emitter };
}

function register(tree, key, listener, once = false) {
  tree.addRegistration({
    key: "synthetic-query",
    path: "users/synthetic/clips",
    eventType: once ? "value$cancelled" : "value",
    eventRegistrationKey: key,
    ref: {},
    listener,
    once,
  });
}

for (const platform of ["android", "ios"]) {
  test(`${platform} Firebase teardown reaches native off and preserves sibling subscriptions`, () => {
    const fallbackResolver = loadNativeResolver(
      mobileRequire.resolve(resolverImport),
      {},
    );
    const fallback = loadModule(
      path.join(
        databaseRoot,
        `dist/module/web/RNFBDatabaseModule.${platform}.js`,
      ),
    ).default;
    fallbackResolver.setReactNativeModule(
      "NativeRNFBTurboDatabaseQuery",
      fallback,
    );
    const broken = loadSyncTree(fallbackResolver).tree;
    register(broken, "broken", () => {});
    assert.throws(() => broken.removeRegistration("broken"), /not a function/);

    const detached = [];
    const native = { off: (...args) => detached.push(args) };
    const config = loadConfig();
    const file = resolveWithExports(config, platform);
    assert.equal(
      file,
      path.join(appRoot, `dist/module/internal/nativeModule.${platform}.js`),
    );
    const { tree, emitter } = loadSyncTree(loadNativeResolver(file, native));
    let firstDelivered = 0;
    let siblingDelivered = 0;
    const first = () => firstDelivered++;
    const sibling = () => siblingDelivered++;
    register(tree, "first", first);
    register(tree, "first$cancelled", () => {}, true);
    register(tree, "sibling", sibling);

    tree.removeListenersForRegistrations(["first$cancelled"]);
    tree.removeListenerRegistrations(first, ["first"]);
    tree.removeListenerRegistrations(first, ["first"]);
    assert.deepEqual(detached, [["synthetic-query", "first"]]);
    assert.equal(tree.getRegistration("first"), null);
    assert.equal(tree.getRegistration("first$cancelled"), null);
    assert.ok(tree.getRegistration("sibling"));
    emitter.emit("first", {});
    emitter.emit("sibling", {});
    assert.equal(firstDelivered, 0);
    assert.equal(siblingDelivered, 1);

    tree.removeListenerRegistrations(sibling, ["sibling"]);
    assert.deepEqual(detached, [
      ["synthetic-query", "first"],
      ["synthetic-query", "sibling"],
    ]);
  });
}

test("Firebase resolution keeps Expo defaults and delegates web and unrelated imports", () => {
  const config = loadConfig();
  assert.equal(config.transformer.retained, true);
  for (const [request, platform] of [
    [resolverImport, "web"],
    [resolverImport, "macos"],
    ["react-native", "android"],
    ["@react-native-firebase/auth", "ios"],
  ]) {
    const expected = { type: "sourceFile", filePath: "synthetic-default" };
    const context = {
      resolveRequest(receivedContext, receivedRequest, receivedPlatform) {
        assert.equal(receivedContext, context);
        assert.equal(receivedRequest, request);
        assert.equal(receivedPlatform, platform);
        return expected;
      },
    };
    assert.equal(
      config.resolver.resolveRequest(context, request, platform),
      expected,
    );
  }
});

test("Firebase resolution preserves an existing Expo resolver", () => {
  const requests = [];
  const expected = { type: "sourceFile", filePath: "synthetic-default" };
  const config = loadConfig((context, request, platform) => {
    requests.push([context, request, platform]);
    return expected;
  });
  const context = {
    resolveRequest() {
      assert.fail("The existing Expo resolver must remain in use");
    },
  };
  assert.equal(
    config.resolver.resolveRequest(context, resolverImport, "android"),
    expected,
  );
  assert.equal(
    config.resolver.resolveRequest(context, "react-native", "ios"),
    expected,
  );
  assert.deepEqual(requests, [
    [
      context,
      path.join(appRoot, "dist/module/internal/nativeModule.android.js"),
      "android",
    ],
    [context, "react-native", "ios"],
  ]);
});
