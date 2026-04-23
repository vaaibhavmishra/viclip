"use client";

import { IconBrandGithub, IconBrandTwitter } from "@tabler/icons-react";
import { CONTACT } from "@viclip/constants";
import { motion } from "framer-motion";
import { ExternalLink, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContactButton {
  icon: React.ElementType;
  label: string;
  gradient: string;
  delay: number;
  href: string;
}

const contactButtons: ContactButton[] = [
  {
    icon: Mail,
    label: "Email",
    gradient: "from-blue-700 to-blue-400",
    delay: 0,
    href: `mailto:${CONTACT.supportEmail}`,
  },
  {
    icon: IconBrandGithub,
    label: "GitHub",
    gradient: "from-blue-700 to-blue-400",
    delay: 0.1,
    href: "https://github.com/ViClip-Org",
  },
  {
    icon: IconBrandTwitter,
    label: "Twitter",
    gradient: "from-blue-700 to-blue-400",
    delay: 0.2,
    href: "https://twitter.com/destroyer__v",
  },
  {
    icon: Send,
    label: "Telegram",
    gradient: "from-blue-700 to-blue-400",
    delay: 0.3,
    href: "https://t.me/viclip_group",
  },
];

export function Contact() {
  return (
    <section
      id="contact"
      className="py-12 sm:py-16 md:py-20 relative overflow-hidden"
    >
      {/* <div className="absolute inset-0 bg-linear-to-b from-background via-blue-500/5 to-background" /> */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="inline-block text-sm font-semibold bg-linear-to-r from-blue-700 to-blue-400 text-transparent bg-clip-text mb-2">
            Get in Touch
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4 bg-clip-text text-transparent bg-linear-to-r from-blue-700 to-blue-400">
            Let's Connect
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-12">
            Have questions or feedback? We'd love to hear from you.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto">
          {contactButtons.map((button, _index) => (
            <motion.div
              key={button.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: button.delay }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              viewport={{ once: true }}
            >
              <a href={button.href}>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-16 sm:h-20 md:h-24 flex-col gap-1 sm:gap-2 group relative overflow-hidden cursor-pointer border-blue-500/20 transition-all duration-300 hover:border-blue-500/40"
                >
                  <div
                    className={`absolute inset-0 bg-linear-to-r ${button.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                  />
                  <button.icon
                    className={`w-5 h-5 sm:w-6 sm:h-6 text-blue-500 transition-transform duration-300 group-hover:scale-110`}
                  />
                  <span className="font-medium text-sm sm:text-base">
                    {button.label}
                  </span>
                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 absolute bottom-1 right-1 sm:bottom-2 sm:right-2 opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
                </Button>
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
