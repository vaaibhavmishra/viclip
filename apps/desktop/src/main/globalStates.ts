import type { ClipData } from "@viclip/types";
import type { BrowserWindow, Tray } from "electron";
import { settingsStorage } from "./services/settings";

// Global instances
let mainWindowInstance: BrowserWindow | null = null;
let authWindowInstance: BrowserWindow | null = null;
let settingsWindowInstance: BrowserWindow | null = null;
let trayInstance: Tray | null = null;
let cachedClips: Record<string, ClipData> = {};

// Getters and setters for mainWindow
export function getMainWindow(): BrowserWindow | null {
  return mainWindowInstance;
}

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindowInstance = window;
}

// Getters and setters for authWindow
export function getAuthWindow(): BrowserWindow | null {
  return authWindowInstance;
}

export function setAuthWindow(window: BrowserWindow | null): void {
  authWindowInstance = window;
}

// Getters and setters for settingsWindow
export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindowInstance;
}

export function setSettingsWindow(window: BrowserWindow | null): void {
  settingsWindowInstance = window;
}

// Getters and setters for tray
export function getTray(): Tray | null {
  return trayInstance;
}

export function setTray(tray: Tray | null): void {
  trayInstance = tray;
}

// Getters and setters for notificationsEnabled
export function getNotificationsEnabled(): boolean {
  return settingsStorage.getNotificationsEnabled();
}
export function setNotificationsEnabled(enabled: boolean): void {
  settingsStorage.setNotificationsEnabled(enabled);
}

// Getters and setters for cachedClips
export function getCachedClips(): Record<string, ClipData> {
  return cachedClips;
}
export function setCachedClips(clips: Record<string, ClipData>): void {
  cachedClips = clips;
}
export function clearCachedClips(): void {
  cachedClips = {};
}
