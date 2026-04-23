/**
 * Extract plain text from shared content, removing URLs
 * @param content - The content to process
 * @returns Cleaned text without URLs
 */
export function extractTextFromShare(content: string): string {
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
}

/**
 * Check if a string is a valid URL
 * @param text - The string to check
 * @returns True if the string is a valid URL
 */
export function isValidUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length (default: 100)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength = 100): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}
