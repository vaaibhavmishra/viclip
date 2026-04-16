"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OS } from "@/types/download";

interface InstallationVideoProps {
  os: OS;
}

const webmVideoSources: Record<OS, string | null> = {
  win: "/ViClip-Windows-Installation.webm",
  mac: "/ViClip-Mac-Installation.webm",
  linux: "/ViClip-Linux-Installation.webm",
  android: "/ViClip-Android-Installation.webm",
  ios: null, // No iOS video available yet
};

const mp4VideoSources: Record<OS, string | null> = {
  win: "/ViClip-Windows-Installation.mp4",
  mac: "/ViClip-Mac-Installation.mp4",
  linux: "/ViClip-Linux-Installation.mp4",
  android: "/ViClip-Android-Installation.mp4",
  ios: null, // No iOS video available yet
};

const videoTitles: Record<OS, string> = {
  win: "Windows Installation Guide",
  mac: "MacOS Installation Guide",
  linux: "Linux Installation Guide",
  android: "Android Installation Guide",
  ios: "iOS Installation Guide",
};

export function InstallationVideo({ os }: InstallationVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const webmVideoSource = webmVideoSources[os];
  const mp4VideoSource = mp4VideoSources[os];

  // Don't render if no video is available for this OS
  if (!webmVideoSource && !mp4VideoSource) {
    return null;
  }

  return (
    <Card className="border border-blue-500/20 bg-muted/5">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        viewport={{ once: true }}
      >
        <CardHeader className="border-b border-blue-500/20 p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">
            {videoTitles[os]}
          </CardTitle>
        </CardHeader>
      </motion.div>
      <CardContent className="p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
          className="relative w-full max-w-2xl rounded-lg overflow-hidden group shadow-lg"
        >
          {/* Video container with fixed aspect ratio to prevent layout shift */}
          <div className="relative w-full aspect-video bg-muted/10">
            {/* Video element */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              controls
              controlsList="nodownload"
              muted
              disablePictureInPicture
              preload="metadata"
            >
              <source src={webmVideoSource || undefined} type="video/webm" />
              <source src={mp4VideoSource || undefined} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </motion.div>

        <p className="text-xs sm:text-sm text-muted-foreground mt-4">
          Watch this step-by-step video guide to help you install ViClip on your{" "}
          {os === "win" ? "Windows" : os === "linux" ? "Linux" : "Android"}{" "}
          device.
        </p>
      </CardContent>
    </Card>
  );
}
