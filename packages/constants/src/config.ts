/**
 * Application-wide configuration constants
 */
export const APP_CONFIG = {
  name: 'Viclip',
  description: 'Sync Your Clipboard Across All Your Devices',
  version: '2.0.0'
} as const;

/**
 * Clipboard synchronization configuration
 */
export const CLIPBOARD_CONFIG = {
  syncIntervalMs: 1000,
  updateCooldownMs: 500,
  maxContentLength: 100000,
  maxClipCount: 10
} as const;

/**
 * Firebase database paths
 */
export const DB_PATHS = {
  users: 'users',
  profile: 'profile',
  devices: 'devices',
  clips: 'clips',
  waitlist: 'waitlist-users'
} as const;
