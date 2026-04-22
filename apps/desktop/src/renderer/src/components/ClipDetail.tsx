import type { ClipData } from "@shared/types/clipboard";
import React from "react";

interface ClipDetailProps {
  clip: ClipData | null;
}

export const ClipDetail: React.FC<ClipDetailProps> = ({ clip }) => {
  const [content, setContent] = React.useState("");

  React.useEffect(() => {
    if (clip) {
      setContent(clip.content);
    } else {
      setContent("");
    }
  }, [clip]);

  const handleBlur = React.useCallback(async () => {
    if (clip && content !== clip.content) {
      try {
        await window.api.updateClip(clip.id, content);
      } catch (error) {
        console.error("Failed to update clip:", error);
      }
    }
  }, [clip, content]);

  if (!clip) {
    return (
      <div className="flex-1 flex items-center justify-center text-foreground/50">
        Select a clip to view details
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Content Area */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        {clip.type === "color" && (
          <div
            className="w-full h-32 rounded-lg border border-border flex items-center justify-center shrink-0 mb-4 shadow-sm transition-colors"
            style={{ backgroundColor: content.trim() }}
          >
            <span className="bg-background/80 px-3 py-1 rounded-md text-sm font-medium backdrop-blur-md border border-border/50">
              {content}
            </span>
          </div>
        )}
        <textarea
          className="w-full flex-1 bg-transparent resize-none focus:outline-none font-mono text-xs text-foreground p-0 border-none"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          spellCheck={false}
        />
      </div>

      {/* Footer Info */}
      <div className="border-t border-border p-4">
        <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm mb-6">
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Source
            </div>
            <div className="flex items-center gap-2 text-foreground">
              {/* Icon based on source? */}
              <span>{clip.sourceDevice}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Content type
            </div>
            <div className="text-gray-900 dark:text-gray-100">{clip.type}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Characters
            </div>
            <div className="text-gray-900 dark:text-gray-100">
              {content.length}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Words
            </div>
            <div className="text-gray-900 dark:text-gray-100">
              {content.split(/\s+/).filter(Boolean).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
