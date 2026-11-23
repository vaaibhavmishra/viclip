import { version } from "../../../../desktop/package.json";

export const releasesUrl =
  "https://github.com/vaaibhavmishra/viclip/releases/latest";

const downloadUrl = `${releasesUrl}/download/ViClip-${version}`;

export function getReleases(_locale?: string) {
  return {
    android: {
      all: {
        // Replace this demo URL with the app listing when ViClip is on Google Play.
        link: "https://play.google.com/store/apps",
        label: "Android (Google Play)",
      },
    },
    macos: {
      x86_64: {
        link: `${downloadUrl}-mac-x64.dmg`,
        label: "macOS Intel / x86_64 (.dmg)",
      },
      arm64: {
        link: `${downloadUrl}-mac-arm64.dmg`,
        label: "macOS Apple Silicon / ARM64 (.dmg)",
      },
    },
    windows: {
      x86_64: {
        link: `${downloadUrl}-win-x64-setup.exe`,
        label: "Windows x86_64 (.exe)",
      },
      arm64: {
        link: `${downloadUrl}-win-arm64-setup.exe`,
        label: "Windows ARM64 (.exe)",
      },
    },
    linux: {
      x86_64: {
        tarball: {
          link: `${downloadUrl}-linux-x86_64.AppImage`,
          label: "Linux AppImage (x86_64)",
        },
      },
      aarch64: {
        tarball: {
          link: `${downloadUrl}-linux-arm64.AppImage`,
          label: "Linux AppImage (ARM64)",
        },
      },
    },
  };
}
