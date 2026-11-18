import { CLIPBOARD_CONFIG } from "@viclip/constants";
import type { ClipContentType } from "@viclip/types";

// Helper function to format the last active timestamp
export function formatLastActive(timestamp: string): string {
  // Keep the existing implementation
  if (!timestamp) return "unknown";

  const lastActive = new Date(timestamp);
  if (Number.isNaN(lastActive.getTime())) return "unknown";
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();

  // Less than a minute
  if (diffMs < 60000) {
    return "just now";
  }

  // Less than an hour
  if (diffMs < 3600000) {
    const minutes = Math.floor(diffMs / 60000);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  // Less than a day
  if (diffMs < 86400000) {
    const hours = Math.floor(diffMs / 3600000);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  // More than a day
  const days = Math.floor(diffMs / 86400000);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/**
 * Format timestamp into a clean, compact string tailored for mobile clip cards.
 * e.g., "Just now", "5m ago", "10:45 AM", "Yesterday", "Nov 4".
 */
export function formatClipTime(timestamp: string | number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Future timestamps or just now (< 1 min)
  if (diffMs < 60000) {
    return "Just now";
  }

  // Within the last hour: "5m ago"
  if (diffMs < 3600000) {
    const minutes = Math.floor(diffMs / 60000);
    return `${minutes}m ago`;
  }

  // Same calendar day: "10:45 AM"
  const isToday =
    now.getDate() === date.getDate() &&
    now.getMonth() === date.getMonth() &&
    now.getFullYear() === date.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    yesterday.getDate() === date.getDate() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getFullYear() === date.getFullYear();

  if (isYesterday) {
    return "Yesterday";
  }

  // Same year: "Nov 4"
  if (now.getFullYear() === date.getFullYear()) {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  // Different year: "Nov 4, '25"
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

/**
 * Clean up device name (e.g. remove trailing .local from macOS hostnames)
 */
export function formatDeviceName(deviceName?: string): string {
  if (!deviceName) return "Unknown Device";
  return deviceName.replace(/\.local$/i, "").trim() || "Device";
}

/**
 * Determine the appropriate Ionicons name based on device name / type
 */
export function getDeviceIcon(
  deviceName?: string,
):
  | "phone-portrait-outline"
  | "tablet-portrait-outline"
  | "laptop-outline"
  | "desktop-outline"
  | "globe-outline" {
  if (!deviceName) return "laptop-outline";
  const name = deviceName.toLowerCase();
  if (
    name.includes("iphone") ||
    name.includes("android") ||
    name.includes("phone") ||
    name.includes("pixel") ||
    name.includes("samsung") ||
    name.includes("mobile") ||
    name.includes("galaxy")
  ) {
    return "phone-portrait-outline";
  }
  if (name.includes("ipad") || name.includes("tablet")) {
    return "tablet-portrait-outline";
  }
  if (
    name.includes("mac") ||
    name.includes("laptop") ||
    name.includes("book") ||
    name.includes("thinkpad")
  ) {
    return "laptop-outline";
  }
  if (
    name.includes("desktop") ||
    name.includes("pc") ||
    name.includes("windows") ||
    name.includes("linux") ||
    name.includes("imac")
  ) {
    return "desktop-outline";
  }
  if (
    name.includes("web") ||
    name.includes("browser") ||
    name.includes("chrome") ||
    name.includes("safari")
  ) {
    return "globe-outline";
  }
  return "laptop-outline";
}

export const extractTextFromShare = (content: string): string => {
  if (typeof content !== "string") return "";
  // Preserve the payload so shared text matches the same text sent from the clipboard.
  return content;
};

/** Share extensions provide untrusted text and temporary, device-local URIs. */
export function getSharedText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const share = value as { text?: unknown; webUrl?: unknown; files?: unknown };
  for (const content of [share.text, share.webUrl]) {
    if (
      typeof content === "string" &&
      content.length > CLIPBOARD_CONFIG.maxContentLength
    ) {
      throw new Error("Shared content exceeds the maximum allowed length.");
    }
  }
  if (typeof share.text === "string" && share.text.trim()) {
    return extractTextFromShare(share.text);
  }
  if (typeof share.webUrl === "string" && share.webUrl.trim()) {
    const url = new URL(share.webUrl.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Only HTTP and HTTPS web links can be shared.");
    }
    return share.webUrl;
  }
  if (Array.isArray(share.files) && share.files.length > 0) {
    throw new Error("File sharing is not supported. Share text or a web link.");
  }
  return "";
}

export async function detectClipboardType(
  text?: string,
): Promise<ClipContentType> {
  const trimmed = text ? text.trim() : "";

  if (trimmed.length === 0) {
    return "unknown";
  }

  // 3. React Native File URIs (file:// or content://)
  if (/^(file|content):\/\//i.test(trimmed)) {
    const lower = trimmed.toLowerCase();
    const ext = lower.includes(".")
      ? lower.substring(lower.lastIndexOf("."))
      : "";

    const docExts = [".doc", ".docx", ".pdf", ".txt", ".rtf", ".odt", ".pages"];
    if (docExts.includes(ext)) return "document";

    const spreadsheetExts = [".xls", ".xlsx", ".csv", ".numbers"];
    if (spreadsheetExts.includes(ext)) return "spreadsheet";

    const presentationExts = [".ppt", ".pptx", ".key"];
    if (presentationExts.includes(ext)) return "presentation";

    // Fallback for other file types
    return "document";
  }

  // 3. URL detection (plain text)
  if (/^https?:\/\//i.test(trimmed)) {
    return "url";
  }

  // 4. Email detection
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "email";
  }

  // 5. Color code detection
  if (
    /^#([0-9A-Fa-f]{3,8})$/.test(trimmed) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+|100%|\d{1,2}%))?\s*\)$/i.test(
      trimmed,
    ) ||
    /^hsla?\(\s*\d{1,3}\s*,\s*(\d{1,3}%\s*,\s*){2}(0|1|0?\.\d+|100%|\d{1,2}%)\s*\)$/i.test(
      trimmed,
    )
  ) {
    return "color";
  }

  // 6. Formatted Text / HTML sniffing
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) {
    return "text-formatted";
  }

  // 7. Plain text fallback
  return "text";
}
