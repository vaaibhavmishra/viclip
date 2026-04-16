"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "Which platforms are supported?",
    answer:
      "ViClip works seamlessly across Windows, macOS, Linux, iOS, and Android devices. You can sync between any combination of these platforms, making it truly universal.",
  },
  {
    question: "How fast is the sync speed?",
    answer:
      "ViClip syncs your clipboard content almost instantly, with typical sync times under 100ms.",
  },
  {
    question: "How does ViClip handle sensitive information?",
    answer:
      "ViClip gives you control over sensitive content. You can turn off syncing while working with sensitive data.",
  },
  {
    question: "What happens if I'm offline?",
    answer:
      "ViClip stores your clipboard locally when offline and automatically syncs when connectivity is restored. You never lose access to your clipboard history, even without an internet connection.",
  },
  {
    question: "How do I set up ViClip on a new device?",
    answer:
      "Simply download the app from your device's app store, log in with your account, and ViClip will automatically sync your clipboard history.",
  },
  {
    question: "How to report a bug or request a feature?",
    answer:
      "You can report bugs or request features through our GitHub Issue repository or by contacting our support team via email. We value your feedback and continuously improve the app based on user suggestions.",
  },
];

export function FAQ() {
  return (
    <section
      id="faq"
      className="py-12 md:py-16 lg:py-20 relative overflow-hidden"
    >
      {/* <div className="absolute inset-0 bg-linear-to-b from-background via-blue-500/5 to-background" /> */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 md:mb-12 lg:mb-16 bg-clip-text text-transparent bg-linear-to-r from-blue-700 to-blue-400"
        >
          Frequently Asked Questions
        </motion.h2>
        <div className="grid gap-3 sm:gap-4">
          {faqItems.map((item, index) => (
            <motion.div
              key={item.question}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: index * 0.1, // Staggered animation based on index
              }}
              viewport={{ once: true }}
            >
              <Card className="overflow-hidden border-blue-500/20 transition-all duration-300 hover:border-blue-500/30">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem
                    value={`item-${index + 1}`}
                    className="border-none"
                  >
                    <AccordionTrigger className="px-3 sm:px-4 md:px-6 py-3 md:py-4 hover:bg-blue-500/5 transition-all duration-300 text-sm sm:text-base cursor-pointer">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="px-3 sm:px-4 md:px-6 pb-3 md:pb-4">
                      <div className="prose prose-sm dark:prose-invert max-w-full">
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {item.answer}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
