"use client";

import { motion } from "framer-motion";
import {
  Check,
  Heart,
  Laptop2,
  Monitor,
  Server,
  Smartphone,
  TabletSmartphone,
} from "lucide-react";
import Link from "next/link";
import { getDownloadLink } from "@/actions/firebase";
import { Footer } from "@/components/sections/Footer";
import { Navigation } from "@/components/sections/Navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DownloadCard } from "./download-card";
import { InstallationInstructions } from "./installation-instructions";
import { InstallationVideo } from "./installation-video";
import { SystemRequirements } from "./system-requirements";

const versionInfo = {
  version: "1.0.0",
  releaseDate: "June 1, 2025",
  releaseNotes: [
    "Mobile: Share Extension support",
    "Desktop: Notification implementation",
    "Desktop: Add app to login items",
    "Desktop: Linux support",
    "All: Sync speed improvements",
    "And many more ...",
  ],
};

export function DownloadsClient() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-grow">
        {/* Hero section */}
        <section className="bg-gradient-to-b from-background to-muted/5 pt-12 sm:pt-16 pb-8 sm:pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-400">
                Download <span className="text-blue-500">ViClip</span>
              </h1>
              <p className="mt-4 max-w-3xl mx-auto text-base sm:text-lg md:text-xl text-muted-foreground px-2">
                Sync your clipboard seamlessly across all your devices
              </p>
              <div className="mt-5 sm:mt-6 inline-flex flex-wrap justify-center items-center rounded-md bg-muted/10 border border-blue-500/20 px-3 py-1">
                <span className="text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">
                  Latest Version: {versionInfo.version}
                </span>
                <span className="text-xs sm:text-sm inline mx-2">|</span>
                <span className="text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">
                  Released: {versionInfo.releaseDate}
                </span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Download Tabs */}
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Tabs defaultValue="windows" className="w-full">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                viewport={{ once: true }}
              >
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-8 bg-muted/20 p-1 h-full gap-4 md:gap-0">
                  <TabsTrigger
                    value="windows"
                    className="flex items-center justify-center gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500 cursor-pointer"
                  >
                    <Monitor className="h-4 w-4" />
                    <span className="text-sm">Windows</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="mac"
                    className="flex items-center justify-center gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500 cursor-pointer"
                  >
                    <Laptop2 className="h-4 w-4" />
                    <span className="text-sm">macOS</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="linux"
                    className="flex items-center justify-center gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500 cursor-pointer"
                  >
                    <Server className="h-4 w-4" />
                    <span className="text-sm">Linux</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="android"
                    className="flex items-center justify-center gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500 col-span-1.5 sm:col-span-1 cursor-pointer"
                  >
                    <Smartphone className="h-4 w-4" />
                    <span className="text-sm">Android</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="ios"
                    className="flex items-center justify-center gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500 col-span-1.5 sm:col-span-1 cursor-pointer"
                  >
                    <TabletSmartphone className="h-4 w-4" />
                    <span className="text-sm">iOS</span>
                  </TabsTrigger>
                </TabsList>
              </motion.div>

              {/* Windows */}
              <TabsContent value="windows" className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <DownloadCard
                    cardTitle="Windows x64"
                    cardDescription="Recommended for most users"
                    cardContent="One click installation with windows installer"
                    buttonText="Download .exe"
                    onClick={async () => {
                      const link = await getDownloadLink("win", "1.0.0", "x64");
                      window.open(link, "_blank");
                    }}
                  />

                  <DownloadCard
                    delay={0.2}
                    cardTitle="Windows ARM"
                    cardDescription="For newer ARM-based devices"
                    cardContent="Optimized for ARM64 architecture"
                    buttonText="Download .exe"
                    onClick={async () => {
                      const link = await getDownloadLink(
                        "win",
                        "1.0.0",
                        "arm64",
                      );
                      window.open(link, "_blank");
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Installation Video */}
                  <InstallationVideo os="win" />

                  {/* Installation Instructions */}
                  <InstallationInstructions os="win" />
                </div>

                {/* System Requirements */}
                <SystemRequirements os="win" />
              </TabsContent>

              {/* macOS */}
              <TabsContent value="mac" className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <DownloadCard
                    cardTitle="MacOS Apple Silicon"
                    cardDescription="Optimized for M1/M2/M3 chips"
                    cardContent="Native support for Apple Silicon processors"
                    buttonText="Download .dmg"
                    onClick={async () => {
                      const link = await getDownloadLink(
                        "mac",
                        "1.0.0",
                        "arm64",
                      );
                      window.open(link, "_blank");
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Installation Video */}
                  <InstallationVideo os="mac" />

                  {/* Installation Instructions */}
                  <InstallationInstructions os="mac" />
                </div>

                {/* System Requirements */}
                <SystemRequirements os="mac" />
              </TabsContent>

              {/* Linux */}
              <TabsContent value="linux" className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <DownloadCard
                    cardTitle="AppImage x64"
                    cardDescription="Tested on Ubuntu/Fedora with GNOME"
                    cardContent="Compatible with most Linux distributions"
                    buttonText="Download .AppImage"
                    onClick={async () => {
                      const link = await getDownloadLink(
                        "linux",
                        "1.0.0",
                        "x86_64",
                      );
                      window.open(link, "_blank");
                    }}
                  />

                  <DownloadCard
                    delay={0.2}
                    cardTitle="AppImage ARM64"
                    cardDescription="Tested on Ubuntu/Fedora with GNOME"
                    cardContent="Optimized for ARM64 architecture"
                    buttonText="Download .AppImage"
                    onClick={async () => {
                      const link = await getDownloadLink(
                        "linux",
                        "1.0.0",
                        "arm64",
                      );
                      window.open(link, "_blank");
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Installation Video */}
                  <InstallationVideo os="linux" />

                  {/* Installation Instructions */}
                  <InstallationInstructions os="linux" />
                </div>

                {/* System Requirements */}
                <SystemRequirements os="linux" />
              </TabsContent>

              {/* Android */}
              <TabsContent value="android" className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <DownloadCard
                    cardTitle="Direct APK Download"
                    cardDescription="Manual installation"
                    cardContent="Direct installation without Play Store restrictions"
                    buttonText="Download APK"
                    onClick={async () => {
                      const link = await getDownloadLink(
                        "android",
                        "1.0.0",
                        "arm64",
                      );
                      window.open(link, "_blank");
                    }}
                  />

                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    viewport={{ once: true }}
                  >
                    <Card className="flex flex-col h-full border border-blue-500/20 hover:border-blue-500/40 bg-muted/5 hover:bg-muted/10 transition-colors group">
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl">
                          Google Play Store
                        </CardTitle>
                        <CardDescription className="text-muted-foreground text-xs sm:text-sm">
                          Coming Soon...
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow p-4 sm:p-6 pt-0 sm:pt-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Google Play Store publication requires a $25 fee. Your
                          support would help me, as a student developer, bring
                          ViClip to the Play Store with automatic updates and
                          enhanced security
                        </p>
                      </CardContent>
                      <CardFooter className="p-4 sm:p-6">
                        <Button
                          className="w-full border-blue-600 text-blue-600 hover:bg-blue-600/10 group-hover:shadow-md group-hover:shadow-blue-500/5 transition-all text-xs sm:text-sm"
                          variant="outline"
                          asChild
                        >
                          <Link href="/support-us">
                            <Heart className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />{" "}
                            Support Us
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Installation Video */}
                  <InstallationVideo os="android" />

                  {/* Installation Instructions */}
                  <InstallationInstructions os="android" />
                </div>

                {/* System Requirements */}
                <SystemRequirements os="android" />
              </TabsContent>

              {/* iOS */}
              <TabsContent value="ios" className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    viewport={{ once: true }}
                  >
                    <Card className="flex flex-col h-full border border-blue-500/20 hover:border-blue-500/40 bg-muted/5 hover:bg-muted/10 transition-colors group">
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl">
                          Apple App Store
                        </CardTitle>
                        <CardDescription className="text-muted-foreground text-xs sm:text-sm">
                          Coming Soon...
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow p-4 sm:p-6 pt-0 sm:pt-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Apple's App Store requires a $99/year developer fee.
                          Your support would help me, as a student developer,
                          bring ViClip to the App Store with seamless updates
                          and enhanced security
                        </p>
                      </CardContent>
                      <CardFooter className="p-4 sm:p-6">
                        <Button
                          className="w-full border-blue-600 text-blue-600 hover:bg-blue-600/10 group-hover:shadow-md group-hover:shadow-blue-500/5 transition-all text-xs sm:text-sm"
                          variant="outline"
                          asChild
                        >
                          <Link href="/support-us">
                            <Heart className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />{" "}
                            Support Us
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                </div>

                {/* Installation Video */}
                <InstallationVideo os="ios" />

                {/* Installation Instructions */}
                <InstallationInstructions os="ios" />

                {/* System Requirements */}
                <SystemRequirements os="ios" />
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* Release Notes */}
        <section className="py-8 sm:py-12 bg-gradient-to-b from-background to-muted/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="mb-6 sm:mb-8"
            >
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-400">
                Release Notes
              </h2>
              <p className="mt-2 sm:mt-4 text-sm sm:text-lg text-muted-foreground">
                Version {versionInfo.version} ({versionInfo.releaseDate})
              </p>
            </motion.div>

            <Card className="border border-blue-500/20 bg-muted/5">
              <CardContent className="p-4 sm:p-6">
                <ul className="space-y-3 sm:space-y-4 text-sm sm:text-base">
                  {versionInfo.releaseNotes.map((note, index) => (
                    <motion.li
                      key={note}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-start"
                    >
                      <Check className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mt-0.5 shrink-0" />
                      <span>{note}</span>
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Installation Help */}
        <section className="py-8 sm:py-12 bg-muted/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto"
            >
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-400">
                Need help with installation?
              </h2>
              <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-muted-foreground px-2">
                Join our community for support, report issues, or ask questions
              </p>
              <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  className="text-xs sm:text-sm border-blue-600 text-blue-600 hover:bg-blue-600/10 hover:shadow-md hover:shadow-blue-500/5"
                  asChild
                  variant="outline"
                >
                  <a
                    href="https://github.com/ViClip-Org/ViClip-Issues"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Report Issue on GitHub
                  </a>
                </Button>
                <Button
                  className="text-xs sm:text-sm border-blue-600 text-blue-600 hover:bg-blue-600/10 hover:shadow-md hover:shadow-blue-500/5"
                  asChild
                  variant="outline"
                >
                  <a
                    href="https://github.com/ViClip-Org/ViClip-Issues/discussions"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub Discussions
                  </a>
                </Button>
                <Button
                  className="text-xs sm:text-sm border-blue-600 text-blue-600 hover:bg-blue-600/10 hover:shadow-md hover:shadow-blue-500/5"
                  asChild
                  variant="outline"
                >
                  <a
                    href="https://t.me/viclip_group"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Telegram Group
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
