import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DownloadCardProps {
  delay?: number;
  cardTitle: string;
  cardDescription: string;
  cardContent: string;
  buttonText: string;
  onClick: () => void;
}

export function DownloadCard({
  delay = 0.1,
  cardTitle,
  cardDescription,
  cardContent,
  buttonText,
  onClick,
}: DownloadCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      viewport={{ once: true }}
    >
      <Card className="flex flex-col h-full border border-blue-500/20 hover:border-blue-500/40 bg-muted/5 hover:bg-muted/10 transition-colors group">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">{cardTitle}</CardTitle>
          <CardDescription className="text-muted-foreground text-xs sm:text-sm">
            {cardDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow p-4 sm:p-6 pt-0 sm:pt-0">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {cardContent}
          </p>
        </CardContent>
        <CardFooter className="p-4 sm:p-6">
          <Button
            className="w-full border-blue-600 text-blue-600 hover:bg-blue-600/10 group-hover:shadow-md group-hover:shadow-blue-500/5 transition-all text-xs sm:text-sm cursor-pointer"
            variant="outline"
            onClick={onClick}
          >
            <Download className="mr-2 h-3 w-3 sm:h-4 sm:w-4" /> {buttonText}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
