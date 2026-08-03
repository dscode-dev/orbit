/**
 * Template Type Registry — ponto único de apresentação dos tipos de artefato.
 *
 * `import { resolveTemplateType, TemplateTypeBadge } from "@/artifacts";`
 */
export {
  allTemplateTypes,
  getTemplateType,
  isOfficialTemplateKey,
  isTemplateActionEnabled,
  resolveTemplateType,
  sortByTemplateType,
  templateTypeAction,
  templateTypeByOfficialKey,
  templateTypeLabel,
  TEMPLATE_TYPE_CATEGORIES,
  TEMPLATE_TYPE_CATEGORY_LABELS,
  type TemplateTypeAction,
  type TemplateTypeCategory,
  type TemplateTypeDefinition,
  type TemplateTypeIcon,
  type TemplateTypeRenderer,
} from "./template-type-registry";
export {
  TemplateTypeBadge,
  TemplateTypeCard,
  TemplateTypeIcon as TemplateTypeGlyph,
  TemplateTypeLabel,
} from "./template-type-components";
