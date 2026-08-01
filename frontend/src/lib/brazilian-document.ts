export type BrazilianDocumentType = "CPF" | "CNPJ";

export function normalizeBrazilianDocument(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14);
}

export function detectBrazilianDocumentType(
  value: string,
): BrazilianDocumentType | null {
  const length = normalizeBrazilianDocument(value).length;
  if (length === 11) return "CPF";
  if (length === 14) return "CNPJ";
  return null;
}

export function formatBrazilianDocument(value: string): string {
  const digits = normalizeBrazilianDocument(value);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function isValidCpf(value: string): boolean {
  const cpf = normalizeBrazilianDocument(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const check = (length: number) => {
    const sum = [...cpf.slice(0, length)].reduce(
      (total, digit, index) => total + Number(digit) * (length + 1 - index),
      0,
    );
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
}

function isValidCnpj(value: string): boolean {
  const cnpj = normalizeBrazilianDocument(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calculate = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = [...cnpj.slice(0, length)].reduce(
      (total, digit, index) => total + Number(digit) * weights[index],
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return (
    calculate(12) === Number(cnpj[12]) && calculate(13) === Number(cnpj[13])
  );
}

export function isValidBrazilianDocument(value: string): boolean {
  const type = detectBrazilianDocumentType(value);
  return type === "CPF"
    ? isValidCpf(value)
    : type === "CNPJ" && isValidCnpj(value);
}
