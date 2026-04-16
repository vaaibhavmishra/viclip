import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OS } from "@/types/download";

const systemRequirements: Record<
  OS,
  {
    os: string;
    processor?: string;
    ram?: string;
    disk: string;
    device?: string;
  }
> = {
  win: {
    os: "Windows 10/11",
    processor: "Intel Core i3 or equivalent",
    ram: "4 GB RAM",
    disk: "200 MB available disk space",
  },
  mac: {
    os: "macOS 11.0 or later",
    processor: "Apple M1 or later",
    ram: "8 GB RAM",
    disk: "200 MB available disk space",
  },
  linux: {
    os: "Ubuntu 20.04+ / Fedora 35+ / Debian 11+",
    processor: "Intel Core i3 or equivalent",
    ram: "4 GB RAM",
    disk: "200 MB available disk space",
  },
  android: {
    os: "Android 10.0 or later",
    processor: "Qualcomm Snapdragon 660 or equivalent",
    ram: "3 GB RAM",
    disk: "100 MB available storage space",
  },
  ios: {
    os: "iOS 14.0 or later",
    device: "iPhone 8 or later, iPad (6th gen) or later",
    disk: "100 MB available storage space",
  },
};

export function SystemRequirements({ os }: { os: OS }) {
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
            System Requirements
          </CardTitle>
        </CardHeader>
      </motion.div>
      <CardContent className="p-4 sm:p-6">
        <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
          <motion.li
            className="flex items-start flex-wrap"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <Check className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-blue-500 mt-0.5 shrink-0" />
            <span>
              <strong>OS:</strong> {systemRequirements[os].os}
            </span>
          </motion.li>
          <motion.li
            className="flex items-start flex-wrap"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <Check className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-blue-500 mt-0.5 shrink-0" />
            <span>
              <strong>Processor:</strong> {systemRequirements[os].processor}
            </span>
          </motion.li>
          <motion.li
            className="flex items-start flex-wrap"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <Check className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-blue-500 mt-0.5 shrink-0" />
            <span>
              <strong>Memory:</strong> {systemRequirements[os].ram}
            </span>
          </motion.li>
          <motion.li
            className="flex items-start flex-wrap"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            viewport={{ once: true }}
          >
            <Check className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-blue-500 mt-0.5 shrink-0" />
            <span>
              <strong>Storage:</strong> {systemRequirements[os].disk}
            </span>
          </motion.li>
        </ul>
      </CardContent>
    </Card>
  );
}
