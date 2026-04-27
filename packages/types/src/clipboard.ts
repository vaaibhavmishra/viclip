/**
 * Supported content types for clipboard items
 */
export type ClipContentType =
  | "text"
  | "text-formatted"
  | "url"
  | "email"
  | "color"
  | "image"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "unknown";

/**
 * Clipboard item data structure
 */
export interface ClipData {
  id: string;
  content: string;
  type: ClipContentType;
  timestamp: string;
  sourceDevice: string;
  pinned?: boolean;
}

/**
 * State for clipboard synchronization
 */
export interface ClipboardSyncState {
  isActive: boolean;
  isUpdatingFromFirebase: boolean;
  isFirebaseUpdating: boolean;
}

/**
 * Configuration for clipboard operations
 */
export interface ClipboardConfig {
  syncIntervalMs: number;
  updateCooldownMs: number;
  maxContentLength: number;
}
