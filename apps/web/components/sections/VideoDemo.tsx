"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { useRef, useState } from "react";

export function VideoDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {
          // Handle autoplay policy restrictions
          setIsPlaying(false);
        });
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  return (
    <section
      className="py-12 md:py-20 relative overflow-hidden"
      ref={containerRef}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 md:mb-12"
        >
          <span className="inline-block text-xs sm:text-sm font-semibold bg-linear-to-r from-blue-700 to-blue-400 text-transparent bg-clip-text mb-1 sm:mb-2">
            Watch Demo
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-linear-to-r from-blue-700 to-blue-400 text-transparent bg-clip-text">
            See ViClip in Action
          </h2>
        </motion.div>

        <motion.div
          style={{ opacity, scale }}
          className="relative w-full max-w-4xl mx-auto rounded-lg sm:rounded-xl overflow-hidden group shadow-lg"
        >
          {/* Video element */}
          <video
            ref={videoRef}
            className="w-full h-full"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster="/ViClip-Hero-Demo-poster.jpg"
          >
            <source src="/ViClip-Hero-Demo.webm" type="video/webm" />
            <source src="/ViClip-Hero-Demo.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause video" : "Play video"}
            className="absolute inset-0 m-auto w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center bg-linear-to-r from-blue-700 to-blue-400 rounded-full text-white opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
            ) : (
              <Play className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
            )}
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
