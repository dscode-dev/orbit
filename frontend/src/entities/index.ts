/**
 * Entity Registry — ponto único de apresentação e navegação entre entidades.
 *
 * `import { EntityLink, resolveEntity } from "@/entities";`
 *
 * Ver `docs/entity-registry.md` para registrar uma entidade nova.
 */
export {
  allEntities,
  entityBadgeClass,
  entityBadgeLabel,
  entityHref,
  getEntity,
  resolveEntity,
  ENTITY_IDS,
  type EntityBadgeSet,
  type EntityDefinition,
  type EntityIcon,
  type EntityId,
} from "./entity-registry";
export {
  EntityBadge,
  EntityIcon as EntityIconGlyph,
  EntityLink,
  useEntityAccess,
} from "./entity-components";
export {
  RelatedRecordsPanel,
  type RelatedQuery,
  type RelatedRow,
} from "./related-records";
export {
  INVITATION_STATUS_LABELS,
  MEMBER_STATUS_LABELS,
} from "./workforce-labels";
export {
  CATALOG_KIND_LABELS,
  CATALOG_STATUS_LABELS,
} from "./catalog-labels";
export {
  ASSET_CATEGORY_LABELS,
  ASSET_IDENTIFIER_LABELS,
  ASSET_STATUS_LABELS,
} from "./asset-labels";
