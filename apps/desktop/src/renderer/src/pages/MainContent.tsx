import type { ClipContentType, ClipData } from "@shared/types/clipboard";
import {
  FileText,
  Image,
  LayoutGrid,
  Link,
  Mail,
  Palette,
  Search,
  Settings,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { ClipDetail } from "../components/ClipDetail";
import { CommandMenu } from "../components/CommandMenu";
import { Sidebar } from "../components/Sidebar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export const MainContent: React.FC = () => {
  const [clips, setClips] = useState<ClipData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<ClipContentType | "all">(
    "all",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedClip = clips.find((c) => c.id === selectedId) || null;
  const [commandOpen, setCommandOpen] = useState(false);

  // Load clips logic
  useEffect(() => {
    const loadClips = async (): Promise<void> => {
      try {
        const clipsData = (await window.api.getClips()) as Record<
          string,
          ClipData
        >;
        if (clipsData && Object.keys(clipsData).length > 0) {
          const sortedClips = Object.values(clipsData).sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
          setClips(sortedClips);

          setSelectedId(sortedClips[0].id);
        }
      } catch (error) {
        console.error("Failed to load clips:", error);
      }
    };

    loadClips();

    window.api.onClipsUpdate((value: Record<string, ClipData>) => {
      const sortedClips = Object.values(value).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      });
      setClips(sortedClips);
    });
  }, []);

  const filteredClips = clips.filter((clip) => {
    const matchesSearch = clip.content
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || clip.type === selectedType;
    return matchesSearch && matchesType;
  });

  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!commandOpen) {
      // Small timeout to ensure the command menu is fully closed and focus is ready to be moved
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [commandOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }

      if (filteredClips.length === 0) return;

      if (e.key === "Enter" && !commandOpen && selectedId) {
        const clipToPaste = filteredClips.find((c) => c.id === selectedId);
        if (clipToPaste) {
          window.api.pasteClip(clipToPaste.content, clipToPaste.id);
        }
      }

      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !commandOpen) {
        e.preventDefault();
        const currentIndex = filteredClips.findIndex(
          (c) => c.id === selectedId,
        );

        if (currentIndex === -1 && filteredClips.length > 0) {
          // If nothing selected, select the first one
          setSelectedId(filteredClips[0].id);
          return;
        }

        if (e.key === "ArrowDown") {
          const nextIndex = Math.min(
            currentIndex + 1,
            filteredClips.length - 1,
          );
          setSelectedId(filteredClips[nextIndex].id);
        } else if (e.key === "ArrowUp") {
          const prevIndex = Math.max(currentIndex - 1, 0);
          setSelectedId(filteredClips[prevIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredClips, selectedId, commandOpen]);

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="h-14 border-b border-border flex items-center px-4 gap-4">
        <div className="flex items-center w-[60%]">
          <Search className="size-6 text-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type to filter entries..."
            className=" bg-transparent! border-none! focus-visible:ring-0! focus-visible:border-transparent! text-sm shadow-none!"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={selectedType}
            onValueChange={(val) =>
              setSelectedType(val as ClipContentType | "all")
            }
          >
            <SelectTrigger className="w-[140px] h-8 text-xs bg-muted/50 border-transparent hover:bg-muted transition-colors">
              <div className="flex items-center gap-2">
                {selectedType === "all"}
                {selectedType === "text"}
                {selectedType === "image"}
                {selectedType === "url"}
                {selectedType === "email"}
                {selectedType === "color"}
                <SelectValue placeholder="All Types" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="size-3.5 text-muted-foreground" />
                  <span>All Types</span>
                </div>
              </SelectItem>
              <SelectItem value="text">
                <div className="flex items-center gap-2">
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span>Text</span>
                </div>
              </SelectItem>
              <SelectItem value="image">
                <div className="flex items-center gap-2">
                  <Image className="size-3.5 text-muted-foreground" />
                  <span>Image</span>
                </div>
              </SelectItem>
              <SelectItem value="url">
                <div className="flex items-center gap-2">
                  <Link className="size-3.5 text-muted-foreground" />
                  <span>URL</span>
                </div>
              </SelectItem>
              <SelectItem value="email">
                <div className="flex items-center gap-2">
                  <Mail className="size-3.5 text-muted-foreground" />
                  <span>Email</span>
                </div>
              </SelectItem>
              <SelectItem value="color">
                <div className="flex items-center gap-2">
                  <Palette className="size-3.5 text-muted-foreground" />
                  <span>Color</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.api.openSettings()}
          >
            <Settings className="size-6 text-foreground" />
          </Button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          clips={filteredClips}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ClipDetail clip={selectedClip} />
      </div>
      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        selectedClipId={selectedId}
        isPinned={selectedClip?.pinned}
        clipContent={selectedClip?.content}
      />
    </div>
  );
};
