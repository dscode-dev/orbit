import {
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { BusinessUnitType, PlanType } from '../contracts';
import { isUuidV7, isValidBrazilianDocument } from '../utils';

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

export const IsDocument = propertyValidator('isDocument', {
  validate: (value: unknown, args?: ValidationArguments) => {
    if (typeof value !== 'string') return false;
    const object = args?.object as { documentType?: unknown } | undefined;
    const expectedType =
      typeof object?.documentType === 'string'
        ? object.documentType
        : undefined;
    return isValidBrazilianDocument(value, expectedType);
  },
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
