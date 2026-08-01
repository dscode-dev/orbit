import { Injectable } from '@nestjs/common';
import type { BusinessUnitType } from '../../contracts';
import type {
  BusinessUnitReadModel,
  OrganizationContextReadModel,
  OrganizationPlanReadModel,
} from './organization.read-models';

type DateValue = Date | string;
type DecimalValue = { toString(): string } | string | number | null;

interface BusinessUnitSource {
  id: string;
  organizationId: string;
  parentId: string | null;
  slug: string;
  code: string | null;
  type: BusinessUnitType;
  isPrimary: boolean;
  legalName: string;
  tradeName: string | null;
  documentType: string;
  documentNumber: string;
  city: string;
  street: string;
  number: string | null;
  stateCode: string | null;
  postalCode: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  locale: string;
  currency: string;
  status: string;
  createdAt: DateValue;
  updatedAt: DateValue;
}

interface PlanSource {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthlyPrice: DecimalValue;
  annualPrice: DecimalValue;
  currency: string;
  capabilities: readonly string[];
  limits: unknown;
  isActive: boolean;
}

interface OrganizationSource {
  id: string;
  ownerUserId: string;
  planId: string;
  slug: string;
  displayName: string;
  primarySegment: string;
  status: string;
  subscriptionStatus: string;
  subscriptionStartedAt: DateValue | null;
  currentPeriodStart: DateValue | null;
  currentPeriodEnd: DateValue | null;
  settings: unknown;
  createdAt: DateValue;
  updatedAt: DateValue;
  plan: PlanSource;
  businessUnits: readonly BusinessUnitSource[];
}

@Injectable()
export class OrganizationReadModelMapper {
  context(source: OrganizationSource): OrganizationContextReadModel {
    return {
      id: source.id,
      ownerUserId: source.ownerUserId,
      planId: source.planId,
      slug: source.slug,
      displayName: source.displayName,
      primarySegment: source.primarySegment,
      status: source.status,
      subscriptionStatus: source.subscriptionStatus,
      subscriptionStartedAt: this.nullableDate(source.subscriptionStartedAt),
      currentPeriodStart: this.nullableDate(source.currentPeriodStart),
      currentPeriodEnd: this.nullableDate(source.currentPeriodEnd),
      settings: source.settings,
      createdAt: this.date(source.createdAt),
      updatedAt: this.date(source.updatedAt),
      plan: this.plan(source.plan),
      businessUnits: source.businessUnits.map((unit) =>
        this.businessUnit(unit),
      ),
    };
  }

  businessUnit(source: BusinessUnitSource): BusinessUnitReadModel {
    return {
      id: source.id,
      organizationId: source.organizationId,
      parentId: source.parentId,
      slug: source.slug,
      code: source.code,
      type: source.type,
      isPrimary: source.isPrimary,
      legalName: source.legalName,
      tradeName: source.tradeName,
      documentType: source.documentType,
      documentNumber: source.documentNumber,
      city: source.city,
      street: source.street,
      number: source.number,
      stateCode: source.stateCode,
      postalCode: source.postalCode,
      email: source.email,
      phone: source.phone,
      timezone: source.timezone,
      locale: source.locale,
      currency: source.currency,
      status: source.status,
      createdAt: this.date(source.createdAt),
      updatedAt: this.date(source.updatedAt),
    };
  }

  private plan(source: PlanSource): OrganizationPlanReadModel {
    return {
      id: source.id,
      key: source.key,
      name: source.name,
      description: source.description,
      monthlyPrice: this.decimal(source.monthlyPrice),
      annualPrice: this.decimal(source.annualPrice),
      currency: source.currency,
      capabilities: [...source.capabilities],
      limits: this.limits(source.limits),
      isActive: source.isActive,
    };
  }

  private limits(value: unknown): Readonly<Record<string, number | null>> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, number | null>)
      : {};
  }

  private decimal(value: DecimalValue): string | number | null {
    if (
      value === null ||
      typeof value === 'number' ||
      typeof value === 'string'
    )
      return value;
    return value.toString();
  }

  private date(value: DateValue): string {
    return value instanceof Date ? value.toISOString() : value;
  }

  private nullableDate(value: DateValue | null): string | null {
    return value === null ? null : this.date(value);
  }
}
