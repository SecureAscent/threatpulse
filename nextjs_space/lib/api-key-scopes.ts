/** Scopes an API key may be granted. Mirrors the Permission union. */
export const AVAILABLE_SCOPES = [
  'threats.read',
  'threats.manage',
  'assets.read',
  'assets.manage',
] as const;

export type ApiKeyScope = (typeof AVAILABLE_SCOPES)[number];
