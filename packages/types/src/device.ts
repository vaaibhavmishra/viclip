/**
 * Supported platforms
 */
export type Platform = 'macOS' | 'Windows' | 'Linux' | 'Android' | 'iOS' | 'Web';

/**
 * Device information
 */
export interface DeviceData {
  id: string;
  deviceName: string;
  platform: string;
  lastActive: string;
}

/**
 * Device registration payload
 */
export interface DeviceRegistration {
  deviceName: string;
  platform: Platform;
}
