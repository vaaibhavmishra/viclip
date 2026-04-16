import type { Metadata } from "next";
import { SupportUsClient } from "./components/support-us-client";

export const metadata: Metadata = {
  title: "Support: Help Keep ViClip Alive",
  description:
    "Support ViClip's student-led development. Help maintain this free universal clipboard sync app across Windows, macOS, Linux, iOS, and Android. Donate today!",
  keywords: [
    "support ViClip",
    "donate to ViClip",
    "ViClip funding",
    "student project support",
    "open source clipboard",
    "free app development",
    "clipboard sync funding",
    "student developer support",
  ],
  openGraph: {
    title: "Support: Help Keep ViClip Alive",
    description:
      "Help support ViClip's student-led development and keep this amazing universal clipboard sync tool alive.",
    url: "https://viclip.app/support-us",
    type: "website",
  },
  twitter: {
    title: "Support: Help Keep ViClip Alive",
    description:
      "Help keep this amazing universal clipboard sync app alive and thriving. Support student-led development today!",
  },
  alternates: {
    canonical: "https://viclip.app/support-us",
  },
};

export default function SupportUs() {
  return <SupportUsClient />;
}
