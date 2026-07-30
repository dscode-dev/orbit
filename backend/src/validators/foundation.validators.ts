import {
  registerDecorator,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { BusinessUnitType, PlanType } from '../contracts';
import { isUuidV7 } from '../utils';

function propertyValidator(
  name: string,
  validator: ValidatorConstraintInterface,
) {
  return (options?: ValidationOptions) =>
    (target: object, propertyName: string): void =>
      registerDecorator({
        name,
        target: target.constructor,
        propertyName,
        options,
        validator,
      });
}

export const IsUUIDv7 = propertyValidator('isUUIDv7', {
  validate: (value: unknown) => typeof value === 'string' && isUuidV7(value),
  defaultMessage: () => 'must be a valid UUID v7',
});

const digits = (value: string): string => value.replace(/\D/g, '');
const validCpf = (value: string): boolean => {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const check = (length: number): number => {
    const sum = cpf
      .slice(0, length)
      .split('')
      .reduce(
        (total, digit, index) => total + Number(digit) * (length + 1 - index),
        0,
      );
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
};
const validCnpj = (value: string): boolean => {
  const cnpj = digits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calculate = (length: number): number => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = cnpj
      .slice(0, length)
      .split('')
      .reduce(
        (total, digit, index) => total + Number(digit) * (weights[index] ?? 0),
        0,
      );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return (
    calculate(12) === Number(cnpj[12]) && calculate(13) === Number(cnpj[13])
  );
};

export const IsDocument = propertyValidator('isDocument', {
  validate: (value: unknown) =>
    typeof value === 'string' && (validCpf(value) || validCnpj(value)),
  defaultMessage: () => 'must be a valid CPF or CNPJ',
});

export const IsBusinessUnitType = propertyValidator('isBusinessUnitType', {
  validate: (value: unknown) =>
    typeof value === 'string' &&
    new Set<string>(Object.values(BusinessUnitType)).has(value),
});

export const IsPlan = propertyValidator('isPlan', {
  validate: (value: unknown) =>
    typeof value === 'string' &&
    new Set<string>(Object.values(PlanType)).has(value),
});

@ValidatorConstraint({ name: 'isJsonObject' })
export class IsJsonObjectConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  defaultMessage(): string {
    return 'must be a JSON object';
  }
}

export const IsJsonObject = propertyValidator(
  'isJsonObject',
  new IsJsonObjectConstraint(),
);
