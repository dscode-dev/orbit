import {
  detectBrazilianDocumentType,
  isValidBrazilianDocument,
  normalizeBrazilianDocument,
} from './brazilian-document';

describe('Brazilian document utilities', () => {
  it('normalizes and detects formatted documents', () => {
    expect(normalizeBrazilianDocument('11.222.333/0001-81')).toBe(
      '11222333000181',
    );
    expect(detectBrazilianDocumentType('529.982.247-25')).toBe('CPF');
    expect(detectBrazilianDocumentType('11.222.333/0001-81')).toBe('CNPJ');
  });

  it('accepts valid formatted and unformatted CPF/CNPJ values', () => {
    expect(isValidBrazilianDocument('529.982.247-25')).toBe(true);
    expect(isValidBrazilianDocument('52998224725')).toBe(true);
    expect(isValidBrazilianDocument('11.222.333/0001-81')).toBe(true);
    expect(isValidBrazilianDocument('11222333000181')).toBe(true);
  });

  it('rejects invalid check digits and a mismatched declared type', () => {
    expect(isValidBrazilianDocument('12.233.222/0001-23')).toBe(false);
    expect(isValidBrazilianDocument('529.982.247-25', 'CNPJ')).toBe(false);
    expect(isValidBrazilianDocument('11.222.333/0001-81', 'CPF')).toBe(false);
  });
});
