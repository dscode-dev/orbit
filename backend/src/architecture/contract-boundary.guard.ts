import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';

export type ContractImportViolation = {
  file: string;
  imported: string;
  reason: string;
};

function targets(from: string, imported: string): string[] {
  if (!imported.startsWith('.')) return [];
  const raw = resolve(dirname(from), imported);
  return raw.endsWith('.ts') ? [raw] : [`${raw}.ts`, join(raw, 'index.ts')];
}

export function validateContractImports(
  file: string,
  source: string,
  allowedFiles: ReadonlySet<string>,
): ContractImportViolation[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const violations: ContractImportViolation[] = [];
  const inspect = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const imported = node.moduleSpecifier.text;
      const resolved = targets(file, imported);
      if (
        !resolved.length ||
        !resolved.some((path) => allowedFiles.has(path))
      ) {
        violations.push({
          file,
          imported,
          reason: resolved.length
            ? 'target is outside the synchronized public-contract boundary'
            : 'external/runtime packages are forbidden in synchronized contracts',
        });
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(ast);
  return violations;
}

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? typescriptFiles(path)
      : entry.name.endsWith('.ts')
        ? [resolve(path)]
        : [];
  });
}

export function validateSynchronizedContracts(
  root: string,
): ContractImportViolation[] {
  const src = resolve(root, 'src');
  const contracts = typescriptFiles(resolve(src, 'contracts'));
  const manifest = JSON.parse(
    readFileSync(resolve(root, 'contracts-sync.manifest.json'), 'utf8'),
  ) as { readModels: string[] };
  const readModels = manifest.readModels.map((file) => resolve(src, file));
  const files = [...contracts, ...readModels];
  const allowed = new Set(files);
  return files.flatMap((file) =>
    validateContractImports(file, readFileSync(file, 'utf8'), allowed),
  );
}
