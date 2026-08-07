const literal = <T extends Record<string, string>>(value: T): Readonly<T> =>
  value;

export const UserStatus = literal({
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DISABLED: 'DISABLED',
});
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const MembershipStatus = literal({
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  REVOKED: 'REVOKED',
});
export type MembershipStatus =
  (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const BusinessUnitType = literal({
  HEADQUARTERS: 'HEADQUARTERS',
  BRANCH: 'BRANCH',
  DEPARTMENT: 'DEPARTMENT',
  SITE: 'SITE',
});
export type BusinessUnitType =
  (typeof BusinessUnitType)[keyof typeof BusinessUnitType];

export const PlanType = literal({
  FREE: 'FREE',
  STARTER: 'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
});
export type PlanType = (typeof PlanType)[keyof typeof PlanType];

export const OperationKind = literal({
  INSTALLATION: 'INSTALLATION',
  MAINTENANCE: 'MAINTENANCE',
  INSPECTION: 'INSPECTION',
  DELIVERY: 'DELIVERY',
  OTHER: 'OTHER',
});
export type OperationKind = (typeof OperationKind)[keyof typeof OperationKind];

export const OperationStatus = literal({
  OPEN: 'OPEN',
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});
export type OperationStatus =
  (typeof OperationStatus)[keyof typeof OperationStatus];

export const OperationPriority = literal({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
});
export type OperationPriority =
  (typeof OperationPriority)[keyof typeof OperationPriority];

export const OperationHistoryAction = literal({
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  USER_ASSIGNED: 'USER_ASSIGNED',
  USER_UNASSIGNED: 'USER_UNASSIGNED',
  ATTACHMENT_ADDED: 'ATTACHMENT_ADDED',
  ATTACHMENT_REMOVED: 'ATTACHMENT_REMOVED',
  DELETED: 'DELETED',
});
export type OperationHistoryAction =
  (typeof OperationHistoryAction)[keyof typeof OperationHistoryAction];

export const ProductKind = literal({
  PRODUCT: 'PRODUCT',
  SERVICE: 'SERVICE',
  PART: 'PART',
});
export type ProductKind = (typeof ProductKind)[keyof typeof ProductKind];

/**
 * Disponibilidade de um item do catálogo.
 *
 * A coluna `products.status` existe desde a criação do modelo e já era
 * publicada no Read Model, mas nenhum contrato a aceitava — nem para escrever,
 * nem para filtrar. Retirar um item de circulação só era possível apagando-o
 * (soft delete), o que some com o registro e com o histórico.
 *
 * O literal formaliza os dois valores que o repositório já usava em texto:
 * `ACTIVE` no `findAvailableProduct` e `INACTIVE` no `softDeleteProduct`.
 */
export const ProductStatus = literal({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

export const AssetCategory = literal({
  EQUIPMENT: 'EQUIPMENT',
  VEHICLE: 'VEHICLE',
  TOOL: 'TOOL',
  FACILITY: 'FACILITY',
  OTHER: 'OTHER',
});
export type AssetCategory = (typeof AssetCategory)[keyof typeof AssetCategory];

export const AssetIdentifierType = literal({
  SERIAL_NUMBER: 'SERIAL_NUMBER',
  QR_CODE: 'QR_CODE',
  NFC: 'NFC',
  INTERNAL_CODE: 'INTERNAL_CODE',
  BARCODE: 'BARCODE',
  RFID: 'RFID',
  CUSTOM: 'CUSTOM',
});
export type AssetIdentifierType =
  (typeof AssetIdentifierType)[keyof typeof AssetIdentifierType];

export const AssetStatus = literal({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  RETIRED: 'RETIRED',
});
export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

export const CustomerType = literal({
  COMPANY: 'COMPANY',
  INDIVIDUAL: 'INDIVIDUAL',
});
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const CustomerStatus = literal({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PROSPECT: 'PROSPECT',
  BLOCKED: 'BLOCKED',
});
export type CustomerStatus =
  (typeof CustomerStatus)[keyof typeof CustomerStatus];

export const NotificationChannel = literal({
  IN_APP: 'IN_APP',
  REALTIME: 'REALTIME',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
});
export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = literal({
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
});
export type NotificationStatus =
  (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const NotificationType = literal({
  SYSTEM: 'SYSTEM',
  OPERATION: 'OPERATION',
  REPORT: 'REPORT',
  REMINDER: 'REMINDER',
});
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const IntegrationProvider = literal({
  GOOGLE: 'GOOGLE',
  MICROSOFT: 'MICROSOFT',
  WHATSAPP: 'WHATSAPP',
  OPENAI_COMPATIBLE: 'OPENAI_COMPATIBLE',
  CUSTOM: 'CUSTOM',
});
export type IntegrationProvider =
  (typeof IntegrationProvider)[keyof typeof IntegrationProvider];

export const IntegrationCategory = literal({
  COMMUNICATION: 'COMMUNICATION',
  STORAGE: 'STORAGE',
  CALENDAR: 'CALENDAR',
  ERP: 'ERP',
  AI: 'AI',
  OTHER: 'OTHER',
});
export type IntegrationCategory =
  (typeof IntegrationCategory)[keyof typeof IntegrationCategory];

export const SignatureStatus = literal({
  PENDING: 'PENDING',
  SIGNED: 'SIGNED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
});
export type SignatureStatus =
  (typeof SignatureStatus)[keyof typeof SignatureStatus];

export const ReportStatus = literal({
  DRAFT: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
});
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const AiExecutionStatus = literal({
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});
export type AiExecutionStatus =
  (typeof AiExecutionStatus)[keyof typeof AiExecutionStatus];
