/**
 * Supported platforms
 */
export type Platform =
  | "macOS"
  | "Windows"
  | "Linux"
  | "Android"
  | "iOS"
  | "Web";

/**
 * Device information
 */
export interface DeviceData {
  id: string;
  deviceName: string;
  platform: string;
  lastActive: string;
  fcmToken?: string;
  /** Authentication session that last registered the installation's push token. */
  fcmTokenSessionId?: string;
}

/**
 * Device registration payload
 */
export interface DeviceRegistration {
  deviceName: string;
  platform: Platform;
}
