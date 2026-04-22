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
  const handlePin = async () => {
    if (selectedClipId) {
      await window.api.pinClip(selectedClipId, !isPinned);
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (selectedClipId) {
      await window.api.removeClip(selectedClipId);
      onOpenChange(false);
    }
  };

  const handleDeleteAll = async () => {
    await window.api.removeAllClips();
    onOpenChange(false);
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
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={handlePin} disabled={!selectedClipId}>
            <Pin className="mr-2 h-4 w-4" />
            <span>{isPinned ? "Unpin Clip" : "Pin Clip"}</span>
            {/* <CommandShortcut>⌘P</CommandShortcut> */}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Danger Zone">
          <CommandItem onSelect={handleDelete} disabled={!selectedClipId}>
            <Trash className="mr-2 h-4 w-4" />
            <span>Delete Clip</span>
            {/* <CommandShortcut>⌘D</CommandShortcut> */}
          </CommandItem>
          <CommandItem
            onSelect={handleDeleteAll}
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
