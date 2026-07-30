import { generateUuidV7, isUuidV7 } from './uuid-v7';

describe('UUID v7', () => {
  it('generates a valid UUID v7 containing the timestamp prefix', () => {
    const value = generateUuidV7(1_700_000_000_000);
    expect(isUuidV7(value)).toBe(true);
    expect(value[14]).toBe('7');
  });

  it('rejects other UUID versions and malformed values', () => {
    expect(isUuidV7('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    expect(isUuidV7('invalid')).toBe(false);
  });
});
