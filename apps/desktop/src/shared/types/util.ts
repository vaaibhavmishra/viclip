/*
 * Link type definition with specific links
 * This file defines a mapping of link names to their respective URLs.
 * It is used throughout the application to ensure consistent access to important links.
 */
export type LinkType = {
  [key: string]: string;
};

/*
 * Predefined links mapping
 */

export const LINKS: LinkType = {
  terms: 'https://www.viclip.shipby.me/terms',
  privacy: 'https://www.viclip.shipby.me/privacy'
};
