/**
 * Application-wide configuration constants
 */
export const APP_CONFIG = {
  name: "Viclip",
  description: "Sync Your Clipboard Across All Your Devices",
  version: "2.0.0",
} as const;

/**
 * Clipboard synchronization configuration
 */
export const CLIPBOARD_CONFIG = {
  syncIntervalMs: 1000,
  updateCooldownMs: 500,
  maxContentLength: 100000,
  maxClipCount: 300,
} as const;

/**
 * Firebase database paths
 */
export const DB_PATHS = {
  users: "users",
  profile: "profile",
  devices: "devices",
  clips: "clips",
  waitlist: "waitlist-users",
} as const;

/**
 * Cryptographic settings for encryption/decryption
 */
export const CRYPTO_CONFIG = {
  algorithm: "aes-256-gcm",
  keyLength: 32, // 256 bits
  ivLength: 12, // 96 bits (standard for GCM)
  saltLength: 16,
  pbkdf2Iterations: 100000,
  pbkdf2Digest: "sha256",
} as const;

/**
 * Contact information
 */
export const CONTACT = {
  supportEmail: "support@viclip.shipby.me",
} as const;

/**
 * Required Firebase environment variables
 */
export const FIREBASE_ENV_KEYS = [
  "MAIN_VITE_FIREBASE_API_KEY",
  "MAIN_VITE_FIREBASE_AUTH_DOMAIN",
  "MAIN_VITE_FIREBASE_DATABASE_URL",
  "MAIN_VITE_FIREBASE_PROJECT_ID",
] as const;
