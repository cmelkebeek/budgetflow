// TOTP (RFC 6238) : codes à 6 chiffres sur 30 s, compatibles Google Authenticator, Aegis, Bitwarden…
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of s.replace(/=+$/, '').toUpperCase()) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac('sha1', secret).update(msg).digest();
  const offset = hash[hash.length - 1] & 0xf;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

export const newSecret = () => base32Encode(randomBytes(20));

export const otpauthUri = (secret: string, account: string) =>
  `otpauth://totp/BudgetFlow:${encodeURIComponent(account)}?secret=${secret}&issuer=BudgetFlow&digits=6&period=${STEP_SECONDS}`;

/**
 * Renvoie le pas de temps validé, ou null. Accepte ±1 pas de décalage d'horloge,
 * et refuse tout pas déjà utilisé (`lastStep`) pour empêcher le rejeu d'un code.
 */
export function verifyTotp(secret: string, code: string, lastStep: number, now = Date.now()): number | null {
  const cleaned = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleaned)) return null;
  const key = base32Decode(secret);
  const current = Math.floor(now / 1000 / STEP_SECONDS);
  for (const step of [current - 1, current, current + 1]) {
    if (step > lastStep && timingSafeEqual(Buffer.from(hotp(key, step)), Buffer.from(cleaned))) return step;
  }
  return null;
}
