// Update your types.ts file to remove ThemeProps
export interface Device {
  id: string;
  name: string;
  type: 'desktop' | 'mobile';
  // other device properties
}

export interface ClipboardItem {
  id: string;
  content: string;
  timestamp: number;
  device: string;
  // other clipboard item properties
}
