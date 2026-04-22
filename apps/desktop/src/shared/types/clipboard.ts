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

export interface ClipData {
  id: string;
  content: string;
  type: ClipContentType;
  timestamp: string;
  sourceDevice: string;
  pinned?: boolean;
}

export interface DeviceData {
  id: string;
  deviceName: string;
  platform: string;
  lastActive: string;
}

// State interfaces
export interface ClipboardSyncState {
  isActive: boolean;
  isUpdatingFromFirebase: boolean;
  isFirebaseUpdating: boolean;
}

// Configuration constants as types
export interface ClipboardConfig {
  syncIntervalMs: number;
  updateCooldownMs: number;
  maxContentLength: number;
}
