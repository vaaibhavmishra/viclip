const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const {
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");

const ACCESSIBILITY_SERVICE_XML = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
  android:accessibilityEventTypes="typeWindowStateChanged|typeViewFocused|typeViewClicked|typeViewTextChanged"
  android:accessibilityFeedbackType="feedbackGeneric"
  android:notificationTimeout="100"
  android:canRetrieveWindowContent="false"
  android:canRequestFilterKeyEvents="false"
  android:accessibilityFlags="flagDefault" />
`;

/**
 * ViClip Sync Config Plugin
 *
 * Automatically injects the Accessibility Service declaration and
 * BIND_ACCESSIBILITY_SERVICE permission into the AndroidManifest.xml
 * during `expo prebuild`.
 *
 * This ensures the native Android system recognizes ViClip as an
 * Accessibility Service provider and shows it in Settings > Accessibility.
 */
function withViClipSyncService(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // ── Add the service declaration inside <application> ──
    const application = manifest.manifest.application?.[0];
    if (!application) {
      throw new Error(
        "viclip-sync plugin: Could not find <application> in AndroidManifest.xml",
      );
    }

    // Ensure the service array exists
    if (!application.service) {
      application.service = [];
    }

    // Check if we already injected (idempotency for repeated prebuilds)
    const serviceClassName =
      "expo.modules.viclipsync.ViClipAccessibilityService";
    const alreadyExists = application.service.some(
      (s) => s.$?.["android:name"] === serviceClassName,
    );

    if (!alreadyExists) {
      application.service.push({
        $: {
          "android:name": serviceClassName,
          "android:exported": "false",
          "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name":
                    "android.accessibilityservice.AccessibilityService",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.accessibilityservice",
              "android:resource": "@xml/accessibility_service_config",
            },
          },
        ],
      });
    }

    return config;
  });

  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const xmlDir = path.join(projectRoot, "app", "src", "main", "res", "xml");
      const xmlFile = path.join(xmlDir, "accessibility_service_config.xml");

      await mkdir(xmlDir, { recursive: true });
      await writeFile(xmlFile, ACCESSIBILITY_SERVICE_XML, "utf8");

      return config;
    },
  ]);

  return config;
}

module.exports = withViClipSyncService;
