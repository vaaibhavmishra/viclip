"use client";

import { motion } from "framer-motion";
import {
  Cloud,
  Globe,
  History,
  Layout,
  type LucideIcon,
  MonitorSmartphone,
  Shield,
  Smartphone,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  details: string;
}

const features: Feature[] = [
  {
    icon: Zap,
    title: "Lightning Fast Sync",
    description:
      "Experience real-time synchronization with sub-100ms latency across all your devices.",
    details:
      "Powered by WebSocket technology for instant updates and minimal latency.",
  },
  {
    icon: Shield,
    title: "Military-Grade Security",
    description:
      "Your data is protected with AES-256 encryption and zero-knowledge architecture.",
    details:
      "End-to-end encryption ensures your data remains private and secure at all times.",
  },
  {
    icon: Globe,
    title: "Universal Compatibility",
    description:
      "Seamlessly works across Windows, macOS, iOS, Android, and Linux platforms.",
    details:
      "Native apps for all major platforms with consistent experience across devices.",
  },
  {
    icon: History,
    title: "Infinite History",
    description:
      "Never lose important content with unlimited clipboard history and smart categorization.",
    details:
      "Intelligent storage management with automatic archiving and retrieval.",
  },
  {
    icon: Cloud,
    title: "Automatic Backup",
    description:
      "Your clipboard history is continuously backed up and synced across devices.",
    details:
      "Redundant cloud storage with version history and recovery options.",
  },
  {
    icon: Smartphone,
    title: "Mobile Integration",
    description:
      "Deep integration with Android and iOS for seamless copy-paste functionality.",
    details: "Native keyboard integration and system-wide accessibility.",
  },
  {
    icon: MonitorSmartphone,
    title: "Device Management",
    description:
      "Control which devices have access to your clipboard with detailed permission settings.",
    details: "Granular device authorization with remote disconnect.",
  },
  {
    icon: Layout,
    title: "Full Control",
    description:
      "Customize every aspect of your app with powerful personalization options.",
    details: "Comprehensive settings for preferences and sync behavior.",
  },
];

export function Features() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [touchedIndex, setTouchedIndex] = useState<number | null>(null);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <section
      id="features"
      className="py-12 sm:py-16 md:py-20 relative overflow-hidden"
    >
      {/* <div className="absolute inset-0 bg-linear-to-b from-background via-blue-500/5 to-background" /> */}
      {/* <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-30" /> */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-16"
        >
          {/* <div className="inline-flex items-center justify-center mb-4">
            <CirclePlus className="w-12 h-12 text-blue-500" />
          </div> */}
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 bg-clip-text text-transparent bg-linear-to-r from-blue-500 to-blue-600">
            Why Choose ViClip?
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience the future of clipboard management with our powerful
            features
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onTouchStart={() => setTouchedIndex(index)}
              onTouchEnd={() => setTimeout(() => setTouchedIndex(null), 1000)}
            >
              <Card className="group relative overflow-hidden border-blue-500/20 bg-card/30 backdrop-blur-xs hover:border-blue-500/40 transition-all duration-500 hover:shadow-lg hover:shadow-blue-500/5">
                <div className="p-4 sm:p-6 relative">
                  <div className="mb-3 sm:mb-4 relative">
                    <div className="absolute inset-0 bg-linear-to-r from-blue-400 to-blue-700 opacity-20 blur-xl rounded-full transition-all duration-500 group-hover:scale-125" />
                    <feature.icon className="w-8 h-8 sm:w-10 sm:h-10 relative z-10 text-blue-500 transition-transform duration-500 group-hover:scale-110" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2 transition-all duration-500">
                    {feature.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 transition-all duration-500">
                    {feature.description}
                  </p>
                  <div
                    className={`text-xs text-blue-500/70 transition-all duration-500 ${
                      hoveredIndex === index || touchedIndex === index
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-2"
                    }`}
                  >
                    {feature.details}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
