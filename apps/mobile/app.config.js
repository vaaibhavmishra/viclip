const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const getUniqueIdentifier = () => {
  if (IS_DEV) {
    return "com.destroyerv.viclip.dev";
  }

  if (IS_PREVIEW) {
    return "com.destroyerv.viclip.preview";
  }

  return "com.destroyerv.viclip";
};

const getAppName = () => {
  if (IS_DEV) {
    return "ViClip (Dev)";
  }

  if (IS_PREVIEW) {
    return "ViClip (Preview)";
  }

  return "ViClip";
};

export default ({ config }) => ({
  ...config,
  name: getAppName(),
  ios: {
    ...config.ios,
    bundleIdentifier: getUniqueIdentifier(),
    googleServicesFile:
      process.env.GOOGLE_SERVICES_PLIST ?? "./GoogleService-Info.plist",
    infoPlist: {
      ...config.ios.infoPlist,
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [process.env.REVERSED_CLIENT_ID, "viclip"],
        },
      ],
    },
  },
  android: {
    ...config.android,
    package: getUniqueIdentifier(),
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
});
