import type { Metadata } from "next";
import { DownloadsClient } from "./components/downloads-client";

export const metadata: Metadata = {
  title: "Download | Windows, macOS, Linux, iOS, Android",
  description:
    "Download ViClip for free on all platforms. Get instant clipboard sync across Windows, macOS, Linux, iOS, and Android devices. Easy installation in minutes.",
  keywords: [
    "ViClip download",
    "clipboard sync app download",
    "Windows clipboard sync",
    "macOS clipboard sync",
    "Linux clipboard sync",
    "iOS clipboard app",
    "Android clipboard app",
    "cross-platform download",
    "universal clipboard download",
    "free clipboard sync",
  ],
  openGraph: {
    title: "Download ViClip - Universal Clipboard Sync for All Platforms",
    description:
      "Download ViClip for free on Windows, macOS, Linux, iOS, and Android. Experience seamless clipboard synchronization across all your devices.",
    url: "https://viclip.app/downloads",
    type: "website",
  },
  twitter: {
    title: "Download ViClip - Universal Clipboard Sync",
    description:
      "Get ViClip for free on all platforms. Sync your clipboard across Windows, macOS, Linux, iOS, and Android instantly.",
  },
  alternates: {
    canonical: "https://viclip.app/downloads",
  },
};

export default function Downloads() {
  return <DownloadsClient />;
}
