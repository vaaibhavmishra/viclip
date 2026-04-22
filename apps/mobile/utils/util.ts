import * as Clipboard from "expo-clipboard";
import type { ClipContentType } from "@/types/clips";

// Helper function to format the last active timestamp
export function formatLastActive(timestamp: string): string {
  // Keep the existing implementation
  if (!timestamp) return "unknown";

  const lastActive = new Date(timestamp);
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

export const extractTextFromShare = (content: string): string => {
  // Split content by lines and filter out URLs
  const lines = content.split("\n").filter((line) => {
    const trimmedLine = line.trim();
    // Filter out empty lines and URLs
    return (
      trimmedLine &&
      !trimmedLine.startsWith("http://") &&
      !trimmedLine.startsWith("https://") &&
      !trimmedLine.startsWith("www.") &&
      // Also filter out lines that are just domain names
      !/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(trimmedLine)
    );
  });

  // Join lines and remove quotation marks
  return lines
    .join("\n")
    .trim()
    .replace(/["""'']/g, "");
};

export async function detectClipboardType(
  text: string,
): Promise<ClipContentType> {
  // 1. Image detection natively via expo-clipboard
  try {
    const hasImage = await Clipboard.hasImageAsync();
    if (hasImage) return "image";
  } catch (error) {
    console.warn("Failed to check clipboard image status:", error);
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) return "unknown";

  // 2. React Native File URIs (file:// or content://)
  if (/^(file|content):\/\//i.test(trimmed)) {
    const lower = trimmed.toLowerCase();
    const ext = lower.includes(".")
      ? lower.substring(lower.lastIndexOf("."))
      : "";

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
    /^rgba?\(\s*(\d{1,3}\s*,\s*){2,3}\d{1,3}\s*\)$/.test(trimmed) ||
    /^hsla?\(\s*\d{1,3}\s*,\s*(\d{1,3}%\s*,\s*){2}\d{1,3}%\s*\)$/.test(trimmed)
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
