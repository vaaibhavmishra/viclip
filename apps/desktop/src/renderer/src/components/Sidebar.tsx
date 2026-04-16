'use client';

import type { ClipData } from '@shared/types/clipboard';
import { FileText } from 'lucide-react';
import type React from 'react';
import { useEffect } from 'react';
import { cn } from '../lib/utils';
import { Kbd, KbdGroup } from './ui/kbd';

interface SidebarProps {
  clips: ClipData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ clips, selectedId, onSelect }) => {
  // Group clips
  const pinnedClips = clips.filter((c) => c.pinned);
  const unpinnedClips = clips.filter((c) => !c.pinned);

  const groupedClips = unpinnedClips.reduce(
    (acc, clip) => {
      const date = new Date(clip.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let key = date.toLocaleDateString();
      if (date.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      }

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(clip);
      return acc;
    },
    {} as Record<string, ClipData[]>
  );

  useEffect(() => {
    if (selectedId) {
      const element = document.getElementById(`clip-${selectedId}`);
      if (element) {
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedId]);

  return (
    <div className="w-80 border-r border-border flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-2 space-y-6">
        {/* Pinned Section */}
        {pinnedClips.length > 0 && (
          <div>
            <h3 className="px-3 mb-2 text-xs font-medium text-muted-foreground tracking-wider">
              Pinned
            </h3>
            <div className="space-y-1">
              {pinnedClips.map((clip) => (
                <button
                  key={clip.id}
                  id={`clip-${clip.id}`}
                  onClick={() => onSelect(clip.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-start gap-3',
                    selectedId === clip.id
                      ? 'bg-background/50 text-foreground'
                      : 'text-foreground hover:bg-background/30'
                  )}
                >
                  {clip.type === 'color' ? (
                    <div
                      className="w-4 h-4 mt-0.5 shrink-0 rounded-full border border-border/50 shadow-sm"
                      style={{ backgroundColor: clip.content.trim() }}
                    />
                  ) : (
                    <FileText className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                  )}
                  <span className="line-clamp-1 break-all">{clip.content}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Unpinned Sections */}
        {Object.entries(groupedClips).map(([date, groupClips]) => (
          <div key={date}>
            <h3 className="px-3 mb-2 text-xs font-medium text-muted-foreground tracking-wider">
              {date}
            </h3>
            <div className="space-y-1">
              {groupClips.map((clip) => (
                <button
                  key={clip.id}
                  id={`clip-${clip.id}`}
                  onClick={() => onSelect(clip.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-start gap-3',
                    selectedId === clip.id
                      ? 'bg-background/50 text-foreground'
                      : 'text-foreground hover:bg-background/30'
                  )}
                >
                  {clip.type === 'color' ? (
                    <div
                      className="w-4 h-4 mt-0.5 shrink-0 rounded-full border border-border/50 shadow-sm"
                      style={{ backgroundColor: clip.content.trim() }}
                    />
                  ) : (
                    <FileText className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                  )}
                  <span className="line-clamp-1 break-all">{clip.content}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {clips.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">No clips found</div>
        )}
      </div>

      {/* Keyboard hint footer */}
      <div className="p-3 border-t border-border flex justify-center items-center gap-2 text-xs text-muted-foreground">
        <span>Navigate</span>
        <KbdGroup>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
        </KbdGroup>
        <div className="w-px h-4 bg-border mx-2" />
        <div className="flex gap-1 items-center">
          <span className="mr-1">Actions</span>
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <span>+</span>
            <Kbd>K</Kbd>
          </KbdGroup>
        </div>
      </div>
    </div>
  );
};
