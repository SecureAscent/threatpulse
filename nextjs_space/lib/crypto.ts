import crypto from 'crypto';

/**
 * SHA-256 hash of an arbitrary string, returned as lowercase hex.
 * Used for storing password-reset tokens and API keys at rest so the
 * raw secret is never persisted.
 */
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Generate a URL-safe random token (hex) of `bytes` entropy. */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a full API key plus its displayable prefix.
 * Format: tp_live_<8-char-id><48-hex-secret>
 * The prefix (tp_live_ + first 8 chars) is safe to show in listings;
 * only the SHA-256 hash of the whole key is stored.
 */
export function generateApiKey(): { fullKey: string; keyPrefix: string; keyHash: string } {
  const id = crypto.randomBytes(4).toString('hex'); // 8 chars
  const secret = crypto.randomBytes(24).toString('hex'); // 48 chars
  const fullKey = `tp_live_${id}${secret}`;
  const keyPrefix = `tp_live_${id}`;
  const keyHash = sha256(fullKey);
  return { fullKey, keyPrefix, keyHash };
}

/** Generate `count` human-friendly backup codes (e.g. "A1B2-C3D4"). */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  for (let i = 0; i < count; i++) {
    let raw = '';
    for (let j = 0; j < 8; j++) {
      raw += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

/** Constant-time string comparison to avoid timing attacks. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
