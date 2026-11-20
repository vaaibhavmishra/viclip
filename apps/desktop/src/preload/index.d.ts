import type {
  ClipData,
  DesktopWindowAppearance,
  DeviceData,
} from "@viclip/types";

export interface PreloadAPI {
  toggleClipboardSync: (shouldEnable: boolean) => Promise<boolean>;
  getPlatform: () => Promise<string>;
  toggleNotifications: (shouldEnable: boolean) => Promise<boolean>;
  getNotificationsEnabled: () => Promise<boolean>;
  openSettings: () => void;
  hideWindow: () => void;
  minimizeWindow: () => void;
  closeWindow: () => void;
  onClipsUpdate: (
    callback: (value: Record<string, ClipData>) => void,
  ) => () => void;
  getClips: () => Promise<Record<string, ClipData> | null>;
  getDevices: () => Promise<Record<string, DeviceData> | null>;
  getDeviceId: () => Promise<string>;
  removeDevice: (deviceKey: string) => Promise<void>;
  removeAllClips: () => Promise<void>;
  onAuthStateChanged: (
    callback: (displayName: string | null) => void,
  ) => () => void;
  signOutUser: () => Promise<void>;
  loginUser: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signUpUser: (
    email: string,
    username: string,
    password: string,
  ) => Promise<void>;
  resetAccountData: (email: string, password: string) => Promise<void>;
  recoverAccount: (
    email: string,
    currentPassword: string,
    oldPassword: string,
  ) => Promise<void>;
  getCurrentUser: () => Promise<{
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    uid: string;
  } | null>;
  getSyncState: () => Promise<boolean>;
  onSyncStateChanged: (callback: (active: boolean) => void) => () => void;
  removeClip: (id: string) => Promise<void>;
  pinClip: (id: string, pinned: boolean) => Promise<void>;
  updateClip: (id: string, content: string) => Promise<void>;
  openURL: (url: string) => void;
  openUrl: (url: string) => void;
  pasteClip: (content: string, id?: string) => Promise<void>;
  getShortcut: () => Promise<string>;
  setShortcut: (shortcut: string) => Promise<boolean>;
  checkForUpdates: () => Promise<void>;
  getAppVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electron?: {
      windowAppearance?: DesktopWindowAppearance;
      process: {
        platform: string;
        versions: Record<string, string | undefined>;
      };
    };
    api: PreloadAPI;
  }
}
