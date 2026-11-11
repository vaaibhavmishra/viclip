export function getReleases(_locale?: string) {
  return {
    macos: {
      universal: {
        link: "https://github.com/ViClip-Org/ViClip-Desktop/releases/latest/download/ViClip.dmg",
        label: "Universal (Intel & Apple Silicon)",
      },
    },
    windows: {
      x86_64: {
        link: "https://github.com/ViClip-Org/ViClip-Desktop/releases/latest/download/ViClip-Setup.exe",
        label: "Windows 64-bit",
      },
      arm64: {
        link: "https://github.com/ViClip-Org/ViClip-Desktop/releases/latest/download/ViClip-Setup-arm64.exe",
        label: "Windows ARM64",
      },
    },
    linux: {
      x86_64: {
        tarball: {
          link: "https://github.com/ViClip-Org/ViClip-Desktop/releases/latest/download/ViClip.AppImage",
          label: "Linux AppImage (x86_64)",
        },
      },
      aarch64: {
        tarball: {
          link: "https://github.com/ViClip-Org/ViClip-Desktop/releases/latest/download/ViClip-arm64.AppImage",
          label: "Linux AppImage (ARM64)",
        },
      },
      flathub: {
        all: {
          link: "https://flathub.org/apps/me.shipby.viclip",
          label: "Flathub",
        },
      },
    },
  };
}
