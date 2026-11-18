const { copyFile, mkdir } = require("node:fs/promises");
const path = require("node:path");
const {
  AndroidConfig,
  withAndroidColors,
  withAndroidManifest,
  withDangerousMod,
  withPlugins,
} = require("expo/config-plugins");

/**
 * Firebase messaging registers the notification resource names in the manifest,
 * but does not generate the drawable or color. Package those resources here.
 */
module.exports = function withFirebaseNotificationIcon(config, props) {
  const { notificationIcon, notificationColor } = props.android;

  config = withPlugins(config, [["@react-native-firebase/messaging", props]]);

  config = withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );
    // Update existing defaults too: the Firebase plugin only adds missing entries.
    for (const [name, resource] of [
      [
        "com.google.firebase.messaging.default_notification_icon",
        "@drawable/viclip_notification_icon",
      ],
      [
        "com.google.firebase.messaging.default_notification_color",
        "@color/notification_icon_color",
      ],
    ]) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        application,
        name,
        resource,
        "resource",
      );
      const entry = application["meta-data"]?.find(
        (item) => item.$?.["android:name"] === name,
      );
      if (entry?.$) {
        delete entry.$["android:value"];
        const replacements = new Set(
          (entry.$["tools:replace"] || "").split(",").filter(Boolean),
        );
        replacements.add("android:resource");
        entry.$["tools:replace"] = [...replacements].join(",");
      }
    }

    // Default notification channel for Firebase Cloud Messaging
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      "com.google.firebase.messaging.default_notification_channel_id",
      "viclip_sync_notifications",
      "value",
    );
    const channelEntry = application["meta-data"]?.find(
      (item) =>
        item.$?.["android:name"] ===
        "com.google.firebase.messaging.default_notification_channel_id",
    );
    if (channelEntry?.$) {
      const replacements = new Set(
        (channelEntry.$["tools:replace"] || "").split(",").filter(Boolean),
      );
      replacements.add("android:value");
      channelEntry.$["tools:replace"] = [...replacements].join(",");
    }
    return config;
  });

  config = withAndroidColors(config, (config) => {
    config.modResults = AndroidConfig.Colors.assignColorValue(
      config.modResults,
      {
        name: "notification_icon_color",
        value: notificationColor,
      },
    );
    return config;
  });

  return withDangerousMod(config, [
    "android",
    async (config) => {
      // A 96px xxxhdpi drawable represents Android's standard 24dp small icon.
      // Android scales this resource for devices with other screen densities.
      const drawableDirectory = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/drawable-xxxhdpi",
      );
      await mkdir(drawableDirectory, { recursive: true });
      await copyFile(
        path.resolve(config.modRequest.projectRoot, notificationIcon),
        path.join(drawableDirectory, "viclip_notification_icon.png"),
      );
      return config;
    },
  ]);
};
