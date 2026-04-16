"use client";

import { motion } from "framer-motion";

export function Footer() {
  return (
    <footer className="bg-muted/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="flex flex-col justify-center items-center"
          >
            <p className="text-sm text-muted-foreground">
              © 2025 ViClip. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Crafted with care for a better clipboard experience
            </p>
            <div className="flex space-x-4 mt-2">
              <a
                href="/terms"
                className="text-muted-foreground/60 underline text-sm"
              >
                Terms of Service
              </a>
              <a
                href="/privacy"
                className="text-muted-foreground/60 underline text-sm"
              >
                Privacy Policy
              </a>
              {/* <a
                href="/cancellation-refund"
                className="text-muted-foreground/60 underline text-sm"
              >
                Cancellation & Refund
              </a>
              <a
                href="/shipping-delivery"
                className="text-muted-foreground/60 underline text-sm"
              >
                Shipping & Delivery
              </a> */}
            </div>
          </motion.div>
        </div>
      </div>
    </footer>
  );
}
