import { Minus, X } from "lucide-react";

export function WindowTitleBar({ title }: { title: string }) {
  return (
    <header className="window-drag-region flex h-8 shrink-0 items-center border-b border-border pl-3 select-none">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <div className="ml-auto flex h-full">
        <button
          type="button"
          aria-label="Minimize window"
          className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          onClick={() => window.api.minimizeWindow()}
        >
          <Minus className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Close window"
          className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-red-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          onClick={() => window.api.closeWindow()}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
