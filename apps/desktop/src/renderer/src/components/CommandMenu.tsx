import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@renderer/components/ui/command";
import { Pin, Trash, Trash2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClipId: string | null;
  isPinned?: boolean;
  clipContent?: string;
}

export const CommandMenu: React.FC<CommandMenuProps> = ({
  open,
  onOpenChange,
  selectedClipId,
  isPinned = false,
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const generation = useRef(0);
  const context = useRef({ open, selectedClipId });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    context.current = { open, selectedClipId };
    generation.current++;
    setError("");
    return () => {
      generation.current++;
    };
  }, [open, selectedClipId]);
  const performAction = async (action: () => Promise<void>): Promise<void> => {
    if (busy.current) return;
    const revision = generation.current;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await action();
      if (generation.current === revision && context.current.open)
        onOpenChange(false);
    } catch {
      if (generation.current === revision)
        setError(
          "Unable to complete the action. Check your connection and retry.",
        );
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  };
  const handlePin = async () => {
    if (selectedClipId)
      await performAction(() => window.api.pinClip(selectedClipId, !isPinned));
  };
  const handleDelete = async () => {
    if (selectedClipId)
      await performAction(() => window.api.removeClip(selectedClipId));
  };
  const handleDeleteAll = async () => {
    if (
      !busy.current &&
      window.confirm(
        "Are you sure you want to delete all unpinned clips? This action cannot be undone.",
      )
    ) {
      await performAction(() => window.api.removeAllClips());
    }
  };

  // const handleShare = async () => {
  // 	if (clipContent) {
  // 		// Fallback for native share or detailed share implementation
  // 		try {
  // 			await navigator.clipboard.writeText(clipContent);
  // 			// Could show a toast here if we had access to toast function
  // 		} catch (err) {
  // 			console.error("Failed to copy", err);
  // 		}
  // 		onOpenChange(false);
  // 	}
  // };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      {error && (
        <div role="alert" className="p-3 text-sm text-red-500">
          {error}
        </div>
      )}
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={handlePin}
            disabled={!selectedClipId || pending}
          >
            <Pin className="mr-2 h-4 w-4" />
            <span>{isPinned ? "Unpin Clip" : "Pin Clip"}</span>
            {/* <CommandShortcut>⌘P</CommandShortcut> */}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Danger Zone">
          <CommandItem
            onSelect={handleDelete}
            disabled={!selectedClipId || pending}
          >
            <Trash className="mr-2 h-4 w-4" />
            <span>Delete Clip</span>
            {/* <CommandShortcut>⌘D</CommandShortcut> */}
          </CommandItem>
          <CommandItem
            onSelect={handleDeleteAll}
            disabled={pending}
            className="text-red-500 data-[selected=true]:text-red-500"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete All Clips</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
