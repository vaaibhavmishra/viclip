/**
 * External links used throughout the application
 */
export const LINKS = {
  website: 'https://viclip.shipby.me',
  terms: 'https://viclip.shipby.me/terms',
  privacy: 'https://viclip.shipby.me/privacy',
  support: 'https://viclip.shipby.me/support-us',
  downloads: 'https://viclip.shipby.me/downloads'
} as const;

export type LinkKey = keyof typeof LINKS;
