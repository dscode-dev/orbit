/**
 * Registry Kernel — infraestrutura comum dos registries.
 *
 * `import { createRegistry, allowsAccess } from "@/registry";`
 *
 * Ver `docs/registry-kernel.md`.
 */
export {
  createRegistry,
  humanizeId,
  sortByRegistryOrder,
  warnUnknown,
  type Registry,
  type RegistryEntry,
  type RegistryOptions,
} from "./kernel";
export {
  accessBlockReason,
  allowsAccess,
  type AccessContext,
  type AccessRequirement,
} from "./access";
export {
  actionAuthority,
  availableTransitions,
  type ActionAuthority,
} from "./allowed-actions";
