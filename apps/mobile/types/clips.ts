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
