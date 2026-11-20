import { Clipboard } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

interface LoadingIndicatorProps extends ComponentProps<"div"> {
  label: string;
}

export function LoadingIndicator({
  className,
  label,
  ...props
}: LoadingIndicatorProps) {
  return (
    <div
      {...props}
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center", className)}
    >
      <div
        aria-hidden="true"
        className="relative grid size-14 place-items-center"
      >
        <span className="absolute inset-0 rounded-full border-2 border-primary/15" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-primary/40 border-t-primary motion-reduce:animate-none" />
        <Clipboard className="size-5 text-primary" strokeWidth={1.8} />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
