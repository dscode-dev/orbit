import {
  generateTotpSecret,
  generateTotpToken,
  generateTotpUri,
  verifyTotp,
} from './totp';

describe('TOTP', () => {
  it('generates and verifies an RFC 6238 token within the allowed window', () => {
    const secret = generateTotpSecret();
    const timestamp = 1_700_000_000_000;
    const token = generateTotpToken(secret, timestamp);

    expect(token).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, token, timestamp)).toBe(true);
    expect(verifyTotp(secret, token, timestamp + 30_000)).toBe(true);
    expect(verifyTotp(secret, token, timestamp + 90_000)).toBe(false);
  });

  it('creates a standards-compatible authenticator URI', () => {
    const uri = generateTotpUri('Orbit', 'person@example.com', 'ABCDEF');
    expect(uri).toContain('otpauth://totp/Orbit:person%40example.com');
    expect(uri).toContain('issuer=Orbit');
  });
});
