import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.viclip.shipby.me"),
  title: {
    default: "ViClip: Cross-Platform Clipboard Syncing App",
    template: "%s | ViClip",
  },
  description:
    "Sync your clipboard seamlessly across Windows, macOS, Linux, iOS, and Android with ViClip. Military-grade encryption, real-time sync, unlimited history, and lightning-fast performance. Download now for free!",
  keywords: [
    // Primary keywords
    "clipboard sync",
    "cross-platform clipboard",
    "clipboard synchronization",
    "clipboard manager",
    // Device-specific keywords
    "Windows clipboard sync",
    "Mac clipboard sync",
    "Linux clipboard sync",
    "iOS clipboard sync",
    "Android clipboard sync",
    // Feature-based keywords
    "real-time clipboard sync",
    "secure clipboard sharing",
    "clipboard history",
    "multi-device clipboard",
    "universal clipboard",
    // Use case keywords
    "productivity tools",
    "remote work tools",
    "device synchronization",
    "copy paste sync",
    "text sharing between devices",
    // Competitive keywords
    "clipboard manager app",
    "clipboard sync software",
    "ViClip",
    // Long-tail keywords
    "how to sync clipboard between devices",
    "best clipboard manager 2025",
    "free clipboard sync app",
    "encrypted clipboard sync",
  ],
  authors: [
    {
      name: "ViClip Team",
      url: "https://www.viclip.shipby.me",
    },
    {
      name: "Vaibhav Mishra",
      url: "https://github.com/vaaibhavmishra",
    },
  ],
  creator: "Vaibhav Mishra",
  publisher: "ViClip",
  category: "Productivity",
  applicationName: "ViClip",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://www.viclip.shipby.me",
  },
  openGraph: {
    title:
      "ViClip: Cross-Platform Clipboard Syncing App - Sync Text Across All Devices",
    description:
      "Sync your clipboard seamlessly across Windows, macOS, Linux, iOS, and Android with ViClip. Military-grade encryption, real-time sync, unlimited history, and lightning-fast performance.",
    url: "https://www.viclip.shipby.me",
    siteName: "ViClip - Cross-Platform Clipboard Sync",
    images: [
      {
        url: "https://www.viclip.shipby.me/og-image.png",
        width: 1200,
        height: 630,
        alt: "ViClip - Cross-Platform Clipboard Syncing App for Windows, Mac, Linux, iOS, Android",
        type: "image/png",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ViClip - Cross-Platform Clipboard Syncing App",
    description:
      "Sync your clipboard seamlessly across all your devices with ViClip. Military-grade encryption and real-time sync.",
    images: ["https://www.viclip.shipby.me/og-image.png"],
    creator: "@destroyer__v",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
