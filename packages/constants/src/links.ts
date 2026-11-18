/**
 * External links used throughout the application
 */
export const LINKS = {
  website: "https://viclip.shipby.me",
  terms: "https://viclip.shipby.me/terms-of-service",
  privacy: "https://viclip.shipby.me/privacy-policy",
  support: "https://viclip.shipby.me/donate",
  downloads: "https://viclip.shipby.me/download",
} as const;

export type LinkKey = keyof typeof LINKS;
