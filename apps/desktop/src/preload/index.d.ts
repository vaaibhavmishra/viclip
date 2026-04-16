import { ElectronAPI } from '@electron-toolkit/preload';

export interface PreloadAPI {
  toggleClipboardSync: (shouldEnable: boolean) => Promise<boolean>;
  getPlatform: () => Promise<string>;
  toggleNotifications: (shouldEnable: boolean) => void;
  openSettings: () => void;
  onClipsUpdate: (callback: (value: ClipData) => void) => void;
  getClips: () => Promise<Record<string, ClipData> | null>;
  getDevices: () => Promise<Record<string, DeviceData> | null>;
  removeDevice: (deviceKey: string) => Promise<void>;
  removeAllClips: () => Promise<void>;
  onAuthStateChanged: (callback: (displayName: string | null) => void) => void;
  signOutUser: () => void;
  loginUser: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signUpUser: (email: string, username: string, password: string) => Promise<void>;
  getCurrentUser: () => Promise<{
    email: string | null;
    displayName: string | null;
    uid: string;
  } | null>;
  getSyncState: () => Promise<boolean>;
  removeClip: (id: string) => Promise<void>;
  pinClip: (id: string, pinned: boolean) => Promise<void>;
  updateClip: (id: string, content: string) => Promise<void>;
  openURL: (url: string) => void;
  pasteClip: (content: string, id?: string) => Promise<void>;
  getShortcut: () => Promise<string>;
  setShortcut: (shortcut: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: PreloadAPI;
  }
}
