import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const encodeBase32 = (input: Buffer): string => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

const decodeBase32 = (input: string): Buffer => {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of input.toUpperCase().replace(/=+$/g, '')) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

const tokenAt = (secret: string, counter: number): string => {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret))
    .update(message)
    .digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    ((digest[offset + 1] ?? 0) << 16) |
    ((digest[offset + 2] ?? 0) << 8) |
    (digest[offset + 3] ?? 0);
  return String(binary % 1_000_000).padStart(6, '0');
};

export const generateTotpToken = (
  secret: string,
  timestamp = Date.now(),
): string => tokenAt(secret, Math.floor(timestamp / 30_000));

export const generateTotpSecret = (): string => encodeBase32(randomBytes(20));

export const generateTotpUri = (
  issuer: string,
  label: string,
  secret: string,
): string => {
  const account = `${encodeURIComponent(issuer)}:${encodeURIComponent(label)}`;
  return `otpauth://totp/${account}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
};

export const verifyTotp = (
  secret: string,
  token: string,
  timestamp = Date.now(),
): boolean => {
  if (!/^\d{6}$/.test(token)) return false;
  const counter = Math.floor(timestamp / 30_000);
  return [-1, 0, 1].some((offset) => {
    const expected = Buffer.from(tokenAt(secret, counter + offset));
    const received = Buffer.from(token);
    return timingSafeEqual(expected, received);
  });
};
