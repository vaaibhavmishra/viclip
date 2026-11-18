import { CLIPBOARD_CONFIG } from "@viclip/constants";
import type { ClipData } from "@viclip/types";
import React from "react";

interface ClipDetailProps {
  clip: ClipData | null;
}

export const ClipDetail: React.FC<ClipDetailProps> = ({ clip }) => {
  interface Draft {
    content: string;
    base: string;
    error: string;
  }
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [saving, setSaving] = React.useState<Record<string, boolean>>({});
  const pending = React.useRef(new Set<string>());
  const mounted = React.useRef(true);
  const latestClip = React.useRef(clip);
  latestClip.current = clip;
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const draft =
    clip && Object.hasOwn(drafts, clip.id) ? drafts[clip.id] : undefined;
  const isSaving = clip ? saving[clip.id] === true : false;
  const content = draft?.content ?? clip?.content ?? "";

  const id = clip?.id;
  const remoteContent = clip?.content;
  React.useEffect(() => {
    if (!id) return;
    setDrafts((current) => {
      const existing = current[id];
      if (
        !existing ||
        existing.content !== existing.base ||
        pending.current.has(id) ||
        existing.content === remoteContent
      )
        return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, [id, remoteContent]);

  const handleBlur = React.useCallback(async () => {
    if (
      !clip ||
      content === (draft?.base ?? clip.content) ||
      pending.current.has(clip.id)
    )
      return;
    if (clip.content === "[Encrypted Content - Decryption Failed]") return;
    if (
      content.trim().length === 0 ||
      content.length > CLIPBOARD_CONFIG.maxContentLength
    ) {
      setDrafts((current) => ({
        ...current,
        [clip.id]: {
          content,
          base: draft?.base ?? clip.content,
          error: "Enter non-empty text within the clipboard size limit.",
        },
      }));
      return;
    }
    const id = clip.id;
    pending.current.add(id);
    setSaving((current) => ({ ...current, [id]: true }));
    try {
      await window.api.updateClip(id, content);
      if (mounted.current)
        setDrafts((current) => {
          const latest = current[id];
          const remote = latestClip.current;
          if (
            (!latest || latest.content === content) &&
            remote?.id === id &&
            remote.content !== clip.content &&
            remote.content !== content
          ) {
            const next = { ...current };
            delete next[id];
            return next;
          }
          return {
            ...current,
            [id]: {
              content: latest?.content ?? content,
              base: content,
              error: "",
            },
          };
        });
    } catch {
      if (mounted.current)
        setDrafts((current) => ({
          ...current,
          [id]: {
            content: current[id]?.content ?? content,
            base: draft?.base ?? clip.content,
            error:
              "Unable to save. Your draft is kept here; retry when connected.",
          },
        }));
    } finally {
      pending.current.delete(id);
      if (mounted.current)
        setSaving((current) => ({ ...current, [id]: false }));
    }
  }, [clip, content, draft?.base]);

  if (!clip) {
    return (
      <div className="flex-1 flex items-center justify-center text-foreground/50">
        Select a clip to view details
      </div>
    );
  }

  const isDecryptionFailed =
    clip.content === "[Encrypted Content - Decryption Failed]";

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Content Area */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        {clip.type === "color" && (
          <div
            className="w-full h-32 rounded-lg border border-border flex items-center justify-center shrink-0 mb-4 shadow-sm transition-colors"
            style={{ backgroundColor: (content || "").trim() }}
          >
            <span className="bg-background/80 px-3 py-1 rounded-md text-sm font-medium backdrop-blur-md border border-border/50">
              {content}
            </span>
          </div>
        )}
        <textarea
          className="w-full flex-1 bg-transparent resize-none focus:outline-none font-mono text-xs text-foreground p-0 border-none disabled:opacity-50"
          value={content}
          onChange={(e) => {
            const value = e.target.value;
            setDrafts((current) => ({
              ...current,
              [clip.id]: {
                content: value,
                base: current[clip.id]?.base ?? clip.content,
                error: "",
              },
            }));
          }}
          onBlur={(event) => {
            if (
              event.relatedTarget instanceof HTMLElement &&
              event.relatedTarget.hasAttribute("data-draft-action")
            )
              return;
            void handleBlur();
          }}
          maxLength={CLIPBOARD_CONFIG.maxContentLength}
          aria-label="Clip content"
          spellCheck={false}
          disabled={isDecryptionFailed}
        />
      </div>

      {draft && (draft.content !== draft.base || draft.error || isSaving) && (
        <div className="px-6 pb-3 text-sm">
          {draft.error && (
            <div role="alert" className="text-red-500">
              {draft.error}
            </div>
          )}
          {clip.content !== draft.base && clip.content !== draft.content && (
            <div role="status">
              This clip changed remotely. Your draft is retained.
            </div>
          )}
          <button
            type="button"
            data-draft-action
            disabled={isSaving}
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleBlur}
          >
            {isSaving ? "Saving..." : "Save draft"}
          </button>
          <button
            type="button"
            data-draft-action
            disabled={isSaving}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              setDrafts((current) => {
                const next = { ...current };
                delete next[clip.id];
                return next;
              })
            }
            className="ml-3"
          >
            Discard draft
          </button>
        </div>
      )}
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
              {(content || "").length}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Words
            </div>
            <div className="text-gray-900 dark:text-gray-100">
              {(content || "").split(/\s+/).filter(Boolean).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
