"use client";

import { motion } from "framer-motion";
import { Download, HeartIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center py-10 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10 w-full">
        <div className="text-center">
          {/* Badge */}
          <Link href="/support-us">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="group mb-4 sm:mb-6 md:mb-8 inline-flex items-center gap-2 bg-linear-to-r from-blue-500/10 to-blue-600/10 backdrop-blur-xs border border-blue-500/10 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 transition-all duration-300 hover:bg-linear-to-r hover:from-blue-500/20 hover:to-blue-600/20 hover:border-blue-500/30 hover:shadow-md hover:shadow-blue-500/20"
            >
              <motion.div
                animate={{ scale: [1, 1.25, 1, 1.25, 1] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <HeartIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
              </motion.div>
              <span className="text-xs sm:text-sm font-medium bg-linear-to-r from-blue-500 to-blue-300 text-transparent bg-clip-text">
                Support ViClip's Development
              </span>
              <svg
                className="w-5 h-5 text-blue-300 ml-2 transition-transform duration-300 group-hover:translate-x-1"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-label="Arrow right"
                role="img"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </motion.div>
          </Link>

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-6 sm:mb-8 md:mb-12 relative"
          >
            <div className="relative">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-linear-to-r from-blue-700 to-blue-400 rounded-2xl blur-xl w-24 h-24 sm:w-30 sm:h-30 md:w-35 md:h-35"
              />
              <Image
                src="/icon.png"
                alt="ViClip app icon - Universal clipboard sync across Windows, macOS, Linux, iOS, and Android devices"
                width={140}
                height={140}
                className="rounded-2xl relative w-24 h-24 sm:w-30 sm:h-30 md:w-35 md:h-35"
              />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight bg-linear-to-r from-blue-700 to-blue-400 text-transparent bg-clip-text mb-4 sm:mb-6 md:mb-8"
          >
            Sync Your Clipboard
            <br className="md:block hidden" />
            <span className="md:hidden"> </span>
            Across All Your Devices
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xs sm:max-w-md md:max-w-2xl mx-auto mb-8 "
          >
            Share text, links, and content seamlessly between your devices with
            ViClip. The fastest and most secure way to keep your clipboard in
            sync.
          </motion.p>

          {/* Download Button */}
          <Link href="/downloads">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto"
            >
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-linear-to-r from-blue-600 to-blue-400 rounded-lg blur opacity-0 group-hover:opacity-75 transition duration-300"></div>
                <Button
                  type="submit"
                  className="relative bg-linear-to-r from-blue-700 to-blue-400 text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 text-sm sm:text-base py-1.5 h-auto sm:h-10 cursor-pointer w-full"
                >
                  <span className="flex items-center">
                    <Download className="mr-2 h-6 w-6" />
                    Download ViClip
                  </span>
                </Button>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                Available on Windows, Mac, Linux, iOS, and Android.
              </p>
            </motion.div>
          </Link>
        </div>
      </div>
    </section>
  );
}
