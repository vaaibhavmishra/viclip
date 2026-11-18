const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const firebaseAppRoot = path.dirname(
  require.resolve("@react-native-firebase/app/package.json"),
);
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // RN Firebase 26.4's package exports can select the web stub for this import,
  // leaving database listener cleanup without native off(). Keep the native
  // resolver on Android/iOS until the upstream fix ships:
  // https://github.com/invertase/react-native-firebase/pull/9361
  if (
    (platform === "android" || platform === "ios") &&
    moduleName ===
      "@react-native-firebase/app/dist/module/internal/nativeModule"
  ) {
    moduleName = path.join(
      firebaseAppRoot,
      `dist/module/internal/nativeModule.${platform}.js`,
    );
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
