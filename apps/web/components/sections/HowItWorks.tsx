"use client";

import { motion } from "framer-motion";
import { ArrowRight, Clipboard, Laptop, Smartphone } from "lucide-react";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-12 md:py-20 relative overflow-hidden"
    >
      {/* <div className="absolute inset-0 bg-linear-to-r from-blue-500/5 to-purple-500/5 z-0" /> */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-16"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 md:mb-16 bg-clip-text text-transparent bg-linear-to-r from-blue-700 to-blue-400">
            How It Works
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-center relative">
          {/* <div className="hidden md:block absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-linear-to-r from-blue-500 to-purple-500 transform -translate-y-1/2" /> */}

          {/* Step 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="relative group"
          >
            <div className="text-center transform transition-transform duration-300 group-hover:scale-105">
              <div className="flex justify-center mb-4 md:mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-700/20 rounded-full blur-xl group-hover:bg-blue-700/30 transition-all duration-300" />
                  <div className="relative bg-card p-4 md:p-6 rounded-full border border-blue-700/20 group-hover:border-blue-700/40 transition-all duration-300">
                    <Clipboard className="w-10 h-10 md:w-16 md:h-16 text-blue-700" />
                  </div>
                </div>
              </div>
              <h3 className="text-xl md:text-2xl font-semibold mb-2 md:mb-4">
                Copy
              </h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Copy anything from any of your devices
              </p>
            </div>
            <div className="hidden md:block absolute -right-4 top-1/2 transform -translate-y-1/2 z-10">
              <ArrowRight className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
            {/* Mobile arrow indicator */}
            <div className="flex justify-center mt-4 md:hidden">
              <ArrowRight className="w-6 h-6 text-blue-500 transform rotate-90" />
            </div>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="relative group"
          >
            <div className="text-center transform transition-transform duration-300 group-hover:scale-105">
              <div className="flex justify-center mb-4 md:mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl group-hover:bg-blue-500/30 transition-all duration-300" />
                  <div className="relative bg-card p-4 md:p-6 rounded-full border border-blue-500/20 group-hover:border-blue-500/40 transition-all duration-300">
                    <Smartphone className="w-10 h-10 md:w-16 md:h-16 text-blue-500" />
                  </div>
                </div>
              </div>
              <h3 className="text-xl md:text-2xl font-semibold mb-2 md:mb-4">
                Sync
              </h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Sync securely with encryption to the cloud
              </p>
            </div>
            <div className="hidden md:block absolute -right-4 top-1/2 transform -translate-y-1/2 z-10">
              <ArrowRight className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
            {/* Mobile arrow indicator */}
            <div className="flex justify-center mt-4 md:hidden">
              <ArrowRight className="w-6 h-6 text-blue-500 transform rotate-90" />
            </div>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            viewport={{ once: true }}
            className="relative group"
          >
            <div className="text-center transform transition-transform duration-300 group-hover:scale-105">
              <div className="flex justify-center mb-4 md:mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-xl group-hover:bg-blue-400/30 transition-all duration-300" />
                  <div className="relative bg-card p-4 md:p-6 rounded-full border border-blue-400/20 group-hover:border-blue-400/40 transition-all duration-300">
                    <Laptop className="w-10 h-10 md:w-16 md:h-16 text-blue-400" />
                  </div>
                </div>
              </div>
              <h3 className="text-xl md:text-2xl font-semibold mb-2 md:mb-4">
                Paste
              </h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Paste seamlessly on any of your devices
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
