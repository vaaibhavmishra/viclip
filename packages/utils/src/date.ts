/**
 * Format a timestamp into a human-readable relative time string
 * @param timestamp - ISO timestamp string
 * @returns Human-readable string like "just now", "5 minutes ago", etc.
 */
export function formatLastActive(timestamp: string): string {
  if (!timestamp) return 'unknown';

  const lastActive = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();

  // Less than a minute
  if (diffMs < 60000) {
    return 'just now';
  }

  // Less than an hour
  if (diffMs < 3600000) {
    const minutes = Math.floor(diffMs / 60000);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  // Less than a day
  if (diffMs < 86400000) {
    const hours = Math.floor(diffMs / 3600000);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  // More than a day
  const days = Math.floor(diffMs / 86400000);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/**
 * Format a date to ISO string
 * @returns ISO formatted date string
 */
export function getCurrentISOTimestamp(): string {
  return new Date().toISOString();
}
