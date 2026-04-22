"use client";

import { motion } from "framer-motion";
import {
  Award,
  Code,
  Coffee,
  CreditCard,
  DollarSign,
  Globe,
  Heart,
  InfinityIcon,
  Server,
  Shield,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Footer } from "@/components/sections/Footer";
import { Navigation } from "@/components/sections/Navigation";

export function SupportUsClient() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-12 lg:mb-16"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 bg-linear-to-r from-rose-500 to-amber-500 text-transparent bg-clip-text leading-tight">
            Support ViClip's Development
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            Help keep this student-led project alive and thriving
          </p>
        </motion.div>

        <div className="prose dark:prose-invert max-w-none">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="mb-8 sm:mb-12 lg:mb-16 bg-linear-to-r from-rose-500/10 to-amber-500/10 p-4 sm:p-6 lg:p-8 rounded-xl border border-rose-500/20"
          >
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
              <Heart className="text-rose-500 w-5 h-5 sm:w-6 sm:h-6" />
              Why Your Support Matters
            </h2>
            <div className="space-y-4 text-sm sm:text-base">
              <p>
                Hi there! I'm the developer behind ViClip, and I'm currently a
                student passionate about building tools that make people's lives
                easier. ViClip started as a personal project when I found myself
                constantly struggling to share content between my phone and
                laptop.
              </p>
              <p>
                As a student, I'm funding this project entirely out of my own
                pocket while balancing my studies. What started as a simple tool
                has grown into something I believe can help many people, but
                maintaining and growing it comes with real costs that are
                challenging to sustain on a student budget.
              </p>
            </div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6"
          >
            Where Your Donations Go
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-10 lg:mb-12"
          >
            <div className="bg-card p-4 sm:p-6 rounded-xl border border-border">
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <Globe className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />
                <h3 className="font-medium text-sm sm:text-base">
                  Domain & Hosting
                </h3>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Annual domain registration fees to keep viclip.shipby.me online
                and accessible to everyone.
              </p>
            </div>

            <div className="bg-card p-4 sm:p-6 rounded-xl border border-border">
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <Server className="text-green-500 w-5 h-5 sm:w-6 sm:h-6" />
                <h3 className="font-medium text-sm sm:text-base">
                  Cloud Infrastructure
                </h3>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Cloud hosting and database services to ensure your clipboard
                syncing is fast, reliable, and always available.
              </p>
            </div>

            <div className="bg-card p-4 sm:p-6 rounded-xl border border-border">
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <ShoppingBag className="text-purple-500 w-5 h-5 sm:w-6 sm:h-6" />
                <h3 className="font-medium text-sm sm:text-base">
                  App Store Fees
                </h3>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Apple Developer Program ($99/year), Google Play Store fees
                ($25), and Microsoft Store registration costs to distribute the
                apps.
              </p>
            </div>

            <div className="bg-card p-4 sm:p-6 rounded-xl border border-border">
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <Shield className="text-orange-500 w-5 h-5 sm:w-6 sm:h-6" />
                <h3 className="font-medium text-sm sm:text-base">
                  Development Tools
                </h3>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Tools like Parallels and other software subscriptions needed to
                develop and test the app across Windows, macOS, Linux, iOS, and
                Android platforms.
              </p>
            </div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            viewport={{ once: true }}
            className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6"
          >
            The Future of ViClip
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            viewport={{ once: true }}
            className="text-sm sm:text-base mb-4 sm:mb-6"
          >
            I'm committed to making ViClip the best clipboard sync tool
            available, but I need your help to make this vision sustainable.
            With your support, I can:
          </motion.p>

          <motion.ul
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            viewport={{ once: true }}
            className="my-4 sm:my-6 space-y-2 sm:space-y-3"
          >
            <li className="flex items-start gap-2 sm:gap-3 text-sm sm:text-base">
              <div className="mt-1 min-w-[20px] text-green-500 font-bold">
                ✓
              </div>
              <div>
                Continue maintenance and add new features to make ViClip even
                more useful
              </div>
            </li>
            <li className="flex items-start gap-2 sm:gap-3 text-sm sm:text-base">
              <div className="mt-1 min-w-[20px] text-green-500 font-bold">
                ✓
              </div>
              <div>
                Expand platform support to ensure ViClip works on all your
                devices
              </div>
            </li>
            <li className="flex items-start gap-2 sm:gap-3 text-sm sm:text-base">
              <div className="mt-1 min-w-[20px] text-green-500 font-bold">
                ✓
              </div>
              <div>
                Improve security and privacy features to keep your data safe
              </div>
            </li>
            <li className="flex items-start gap-2 sm:gap-3 text-sm sm:text-base">
              <div className="mt-1 min-w-[20px] text-green-500 font-bold">
                ✓
              </div>
              <div>
                Eventually make ViClip open-source to benefit from community
                contributions and ensure transparency
              </div>
            </li>
          </motion.ul>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            viewport={{ once: true }}
            className="mb-8 sm:mb-12 lg:mb-16 bg-linear-to-r from-blue-500/10 to-indigo-500/10 p-4 sm:p-6 lg:p-8 rounded-xl border border-blue-500/20"
          >
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
              <Code className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />
              Open Source Plans
            </h2>
            <div className="space-y-4 text-sm sm:text-base">
              <p>
                I believe in transparency and community-driven development. As
                ViClip grows, I plan to make the project open-source, which will
                allow for:
              </p>
              <ul className="space-y-2 ml-4 sm:ml-6">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  Better security through code review and community audits
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  More features and improvements from community contributions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  Greater transparency about how your data is handled
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  Long-term sustainability of the project beyond just one
                  developer
                </li>
              </ul>
              <p>
                Your donations now will help me build a solid foundation to make
                this open-source transition possible in the future.
              </p>
            </div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            viewport={{ once: true }}
            className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6"
          >
            Supporter Benefits
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            viewport={{ once: true }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12"
          >
            <div className="bg-card p-4 sm:p-6 rounded-xl border border-border text-center">
              <div className="flex justify-center mb-3 sm:mb-4">
                <InfinityIcon className="text-blue-500 h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-base sm:text-lg font-medium mb-2">
                Free Lifetime Access
              </h3>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Donors who contribute $10 or more will receive lifetime free
                access if we move to a pricing model
              </p>
            </div>

            <div className="bg-card p-4 sm:p-6 rounded-xl border border-border text-center">
              <div className="flex justify-center mb-3 sm:mb-4">
                <Sparkles className="text-purple-500 h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-base sm:text-lg font-medium mb-2">
                Early Access
              </h3>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Be the first to try new features before they're released
                publicly
              </p>
            </div>

            <div className="bg-card p-4 sm:p-6 rounded-xl border border-border text-center sm:col-span-2 lg:col-span-1">
              <div className="flex justify-center mb-3 sm:mb-4">
                <Award className="text-yellow-500 h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-base sm:text-lg font-medium mb-2">
                Supporter Badge
              </h3>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Special recognition in the app and on our website
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.0 }}
            viewport={{ once: true }}
            className="bg-card p-6 sm:p-8 lg:p-10 rounded-xl border border-border mb-8 sm:mb-12 text-center"
          >
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold mb-4 sm:mb-6">
              Support ViClip Today
            </h2>
            <h3 className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
              Choose your preferred payment method
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <motion.a
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.2 }}
                viewport={{ once: true }}
                href="https://www.paypal.com/ncp/payment/4LH4SBKH8ME7G"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-2xl border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1"
              >
                <div className="relative p-4 sm:p-6 flex flex-col items-center text-center gap-3 sm:gap-4">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-foreground">
                    PayPal
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                    Best for international users, supports cards and wallets
                  </p>
                </div>
              </motion.a>

              <motion.a
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.2 }}
                viewport={{ once: true }}
                href="https://github.com/sponsors/vaaibhavmishra"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-2xl border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1"
              >
                <div className="relative p-4 sm:p-6 flex flex-col items-center text-center gap-3 sm:gap-4">
                  <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-foreground">
                    Github
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                    Support through GitHub specially for developers
                  </p>
                </div>
              </motion.a>

              <motion.a
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.2 }}
                viewport={{ once: true }}
                href="https://razorpay.me/@viclip"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-2xl border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1"
              >
                <div className="relative p-4 sm:p-6 flex flex-col items-center text-center gap-3 sm:gap-4">
                  <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-foreground">
                    RazorPay
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                    Best for Indian users, supports UPI, cards, and wallets
                  </p>
                </div>
              </motion.a>

              <motion.a
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.2 }}
                viewport={{ once: true }}
                href="https://buymeacoffee.com/vaibhavmishra"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-2xl border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1"
              >
                <div className="relative p-4 sm:p-6 flex flex-col items-center text-center gap-3 sm:gap-4">
                  <Coffee className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-foreground">
                    Buy me a coffee
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                    Quick and easy way to support
                  </p>
                </div>
              </motion.a>
            </div>

            <div className="text-xs sm:text-sm text-muted-foreground">
              Choose your preferred payment method. All donations help support
              the continued development of ViClip.
              <br />
              Thank you for your generosity!
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.1 }}
            viewport={{ once: true }}
            className="bg-card p-4 sm:p-6 lg:p-8 rounded-xl border border-border"
          >
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-4 sm:mb-6">
              A Personal Thank You
            </h2>
            <div className="space-y-4 text-sm sm:text-base">
              <p>
                As a student developer, your support means the world to me.
                Every contribution helps keep this project alive and allows me
                to continue building something that I hope makes your digital
                life just a little bit easier.
              </p>
              <p>
                Thank you for considering supporting ViClip. If you have any
                questions or would like to discuss other ways to help, please
                don't hesitate to reach out to me at{" "}
                <a
                  href="mailto:support@viclip.shipby.me"
                  className="text-blue-500 hover:underline break-all"
                >
                  vaibhav@viclip.shipby.me
                </a>
                .
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-end mt-6">
              <div className="text-center sm:text-right">
                <p className="font-medium text-sm sm:text-base">
                  With gratitude,
                </p>
                <p className="text-muted-foreground text-sm">The ViClip Team</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
