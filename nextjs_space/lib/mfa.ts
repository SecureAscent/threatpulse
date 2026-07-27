import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const ISSUER = 'ThreatPulse';

// Allow one step of clock drift in either direction.
authenticator.options = { window: 1 };

/** Generate a fresh base32 TOTP secret. */
export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

/** Build the otpauth:// URI used to seed authenticator apps. */
export function buildOtpAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

/** Render the otpauth URI as a PNG data URL for display as a QR code. */
export async function buildQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
}

/** Verify a 6-digit TOTP token against a secret. */
export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ''), secret });
  } catch {
    return false;
  }
}
