/**
 * ARQUIVO GERADO — NÃO EDITE MANUALMENTE.
 * Fonte: backend/src
 * Regenerar: npm run contracts:sync
 */

import type { BusinessUnitType } from '../..';

export interface BusinessUnitReadModel {
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
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationPlanReadModel {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthlyPrice: string | number | null;
  annualPrice: string | number | null;
  currency: string;
  capabilities: readonly string[];
  limits: Readonly<Record<string, number | null>>;
  isActive: boolean;
}

export interface OrganizationContextReadModel {
  id: string;
  ownerUserId: string;
  planId: string;
  slug: string;
  displayName: string;
  primarySegment: string;
  status: string;
  subscriptionStatus: string;
  subscriptionStartedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
  plan: OrganizationPlanReadModel;
  businessUnits: readonly BusinessUnitReadModel[];
}
