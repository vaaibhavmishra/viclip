import { useGlobalStore } from "@renderer/components/global-context";
import type { ClipContentType, ClipData } from "@viclip/types";
import {
  FileText,
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
  const { user } = useGlobalStore();
  const [clips, setClips] = useState<ClipData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<ClipContentType | "all">(
    "all",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedClip = clips.find((c) => c.id === selectedId) || null;
  const [commandOpen, setCommandOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const pastePending = React.useRef(false);
  const mounted = React.useRef(false);
  const generation = React.useRef(0);
  const previousAccount = React.useRef(user?.uid);
  const latestReload = React.useRef(reload);
  latestReload.current = reload;

  // Load clips logic
  useEffect(() => {
    const requestedReload = reload;
    const requestedUserId = user?.uid;
    if (previousAccount.current !== requestedUserId) {
      setClips([]);
      setSelectedId(null);
      setError("");
      setSearchQuery("");
      setSelectedType("all");
      setCommandOpen(false);
      previousAccount.current = requestedUserId;
    }
    const revision = ++generation.current;
    let active = true;
    mounted.current = true;
    let receivedUpdate = false;
    setLoading(true);
    const applyClips = (value: Record<string, ClipData> | null): void => {
      if (
        !active ||
        latestReload.current !== requestedReload ||
        useGlobalStore.getState().user?.uid !== requestedUserId
      )
        return;
      const sortedClips = Object.values(value || {})
        .filter(Boolean)
        .sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return (
            (Number.isNaN(timeB) ? 0 : timeB) -
            (Number.isNaN(timeA) ? 0 : timeA)
          );
        });
      setClips(sortedClips);
      setSelectedId((previous) =>
        previous && sortedClips.some((clip) => clip.id === previous)
          ? previous
          : sortedClips[0]?.id || null,
      );
      setLoading(false);
      setError("");
    };
    const unsubscribe = window.api.onClipsUpdate((value) => {
      receivedUpdate = true;
      applyClips(value);
    });
    window.api
      .getClips()
      .then((value) => {
        if (!receivedUpdate) applyClips(value);
      })
      .catch(() => {
        if (
          active &&
          !receivedUpdate &&
          latestReload.current === requestedReload &&
          useGlobalStore.getState().user?.uid === requestedUserId
        ) {
          setError("Unable to load clips. Check your connection and retry.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
      mounted.current = false;
      if (generation.current === revision) generation.current++;
      unsubscribe();
    };
  }, [reload, user?.uid]);

  const pasteClip = React.useCallback(async (clip: ClipData): Promise<void> => {
    if (pastePending.current) return;
    const revision = generation.current;
    const requestedUserId = useGlobalStore.getState().user?.uid;
    pastePending.current = true;
    try {
      await window.api.pasteClip(clip.content, clip.id);
    } catch {
      if (
        mounted.current &&
        generation.current === revision &&
        useGlobalStore.getState().user?.uid === requestedUserId
      )
        setError("Unable to paste this clip. Please retry.");
    } finally {
      pastePending.current = false;
    }
  }, []);

  const filteredClips = clips.filter((clip) => {
    const content = clip.content || "";
    const matchesSearch = content
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
    const handleFocus = () => {
      if (!commandOpen) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [commandOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const isTextarea = target?.tagName === "TEXTAREA";
      if (isTextarea) {
        if (e.key === "Escape") {
          target?.blur();
        }
        return;
      }

      if (target?.closest("button, [role='listbox'], [role='dialog']")) return;

      if (e.key === "Escape") {
        if (commandOpen || e.defaultPrevented) return;
        e.preventDefault();
        setSearchQuery("");
        window.api.hideWindow();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }

      if (filteredClips.length === 0) return;

      if (e.key === "Enter" && !commandOpen && selectedId) {
        const clipToPaste = filteredClips.find((c) => c.id === selectedId);
        if (
          clipToPaste &&
          clipToPaste.content !== "[Encrypted Content - Decryption Failed]"
        ) {
          void pasteClip(clipToPaste);
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
  }, [filteredClips, selectedId, commandOpen, pasteClip]);

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
                {selectedType === "all" && (
                  <LayoutGrid className="size-3.5 text-muted-foreground" />
                )}
                {selectedType === "text" && (
                  <FileText className="size-3.5 text-muted-foreground" />
                )}
                {selectedType === "url" && (
                  <Link className="size-3.5 text-muted-foreground" />
                )}
                {selectedType === "email" && (
                  <Mail className="size-3.5 text-muted-foreground" />
                )}
                {selectedType === "color" && (
                  <Palette className="size-3.5 text-muted-foreground" />
                )}
                <SelectValue placeholder="All Types" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <span>All Types</span>
                </div>
              </SelectItem>
              <SelectItem value="text">
                <div className="flex items-center gap-2">
                  <span>Text</span>
                </div>
              </SelectItem>
              <SelectItem value="url">
                <div className="flex items-center gap-2">
                  <span>URL</span>
                </div>
              </SelectItem>
              <SelectItem value="email">
                <div className="flex items-center gap-2">
                  <span>Email</span>
                </div>
              </SelectItem>
              <SelectItem value="color">
                <div className="flex items-center gap-2">
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

      {loading && (
        <div role="status" className="px-4 py-2 text-sm">
          Loading clips...
        </div>
      )}
      {error && (
        <div role="alert" className="px-4 py-2 text-sm text-red-500">
          {error}{" "}
          <button type="button" onClick={() => setReload((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}
      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          clips={filteredClips}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ClipDetail key={user?.uid} clip={selectedClip} />
      </div>
      <CommandMenu
        key={user?.uid}
        open={commandOpen}
        onOpenChange={setCommandOpen}
        selectedClipId={selectedId}
        isPinned={selectedClip?.pinned}
        clipContent={selectedClip?.content}
      />
    </div>
  );
};
