import type { ClipContentType } from "@shared/types/clipboard";

export function detectClipboardType(
  text: string,
  formats: string[],
): ClipContentType {
  const trimmed = text.trim();
  if (trimmed.length === 0 && formats.length === 0) return "unknown";

  // 1. Image detection by format
  if (
    formats.includes("image/png") ||
    formats.includes("image/jpeg") ||
    formats.includes("image/jpg") ||
    formats.includes("image/gif") ||
    formats.includes("image/webp") ||
    formats.includes("image/bmp") ||
    formats.includes("image/svg+xml") ||
    formats.includes("image/tiff")
  ) {
    return "image";
  }

  // 2. Formatted text detection
  if (formats.includes("text/html") || formats.includes("text/rtf")) {
    return "text-formatted";
  }

  // 3. File/URI-list detection (by extension)
  if (formats.includes("text/uri-list")) {
    const lower = trimmed.toLowerCase();
    const ext = lower.substring(lower.lastIndexOf("."));
    const imageExts = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".svg",
      ".webp",
      ".ico",
      ".tiff",
    ];
    if (imageExts.includes(ext)) return "image";

    const docExts = [".doc", ".docx", ".pdf", ".txt", ".rtf", ".odt", ".pages"];
    if (docExts.includes(ext)) return "document";

    const spreadsheetExts = [".xls", ".xlsx", ".csv", ".numbers"];
    if (spreadsheetExts.includes(ext)) return "spreadsheet";

    const presentationExts = [".ppt", ".pptx", ".key"];
    if (presentationExts.includes(ext)) return "presentation";

    // If it's a URL in uri-list
    if (/^https?:\/\//i.test(trimmed)) return "url";
  }

  // 4. URL detection (plain text)
  if (/^https?:\/\//i.test(trimmed)) {
    return "url";
  }

  // 5. Email detection
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "email";
  }

  // 6. Color code detection (hex, rgb/rgba, hsl/hsla)
  if (
    /^#([0-9A-Fa-f]{3,8})$/.test(trimmed) ||
    /^rgba?\(\s*(\d{1,3}\s*,\s*){2,3}\d{1,3}\s*\)$/.test(trimmed) ||
    /^hsla?\(\s*\d{1,3}\s*,\s*(\d{1,3}%\s*,\s*){2}\d{1,3}%\s*\)$/.test(trimmed)
  ) {
    return "color";
  }

  // 7. Plain text fallback
  if (trimmed.length > 0) {
    return "text";
  }

  return "unknown";
}
