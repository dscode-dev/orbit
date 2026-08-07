/**
 * Template Type Registry — ponto único de apresentação dos tipos de artefato.
 *
 * `import { resolveTemplateType, TemplateTypeBadge } from "@/artifacts";`
 */
export {
  allTemplateTypes,
  getTemplateType,
  isOfficialTemplateKey,
  resolveTemplateType,
  sortByTemplateType,
  templateTypeByOfficialKey,
  templateTypeLabel,
  TEMPLATE_TYPE_CATEGORIES,
  TEMPLATE_TYPE_CATEGORY_LABELS,
  type TemplateTypeCategory,
  type TemplateTypeDefinition,
  type TemplateTypeIcon,
} from "./template-type-registry";
export {
  TemplateTypeBadge,
  TemplateTypeCard,
  TemplateTypeIcon as TemplateTypeGlyph,
  TemplateTypeLabel,
} from "./template-type-components";
