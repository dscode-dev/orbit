/**
 * Modelo do Artifact Studio.
 *
 * `import { insertNode, serializeDocument } from "@/lib/artifact-studio";`
 *
 * A divisão importa: `tree` é o modelo do editor, `parse` e `serialize` são a
 * **fronteira do contrato** — os únicos arquivos que conhecem o formato
 * persistido pelo backend — e `diff` é apresentação sobre dois estados já
 * recebidos.
 */
export * from "./tree";
export { documentFromVersion, emptyDocument } from "./parse";
export {
  inspectDocument,
  serializeDocument,
  type SerializeResult,
  type StructureProblem,
} from "./serialize";
export {
  compareVersions,
  describeValue,
  type AttributeChange,
  type ChangeKind,
  type ChangeScope,
  type StructureChange,
  type VersionComparison,
} from "./diff";
export {
  toIdentifier,
  toTemplateKey,
  toTypeIdentifier,
  uniqueIdentifier,
} from "./identifiers";
