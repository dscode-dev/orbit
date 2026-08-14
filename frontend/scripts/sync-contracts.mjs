#!/usr/bin/env node
/**
 * Copia os contratos do backend (NestJS) para o frontend.
 *
 * O backend é a única fonte de verdade dos contratos da API. Dois conjuntos
 * são sincronizados:
 *
 * 1. `backend/src/contracts` — tipos e literais base da plataforma.
 * 2. Read Models de módulos (dashboards, analytics, scheduling) — tipos puros
 *    que descrevem exatamente o que cada endpoint devolve.
 *
 * Ambos contêm apenas TypeScript puro, sem dependências de runtime. Os Read
 * Models são copiados preservando `modules/<módulo>/` para que os imports
 * relativos entre eles continuem válidos.
 *
 * Não usamos import direto (`../backend/src/...`) porque o build de produção
 * do frontend roda em um contexto Docker isolado (`./frontend`), onde o
 * diretório do backend não existe.
 *
 * Uso: npm run contracts:sync
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, "..");
const backendSrc = resolve(frontendRoot, "..", "backend", "src");
const source = resolve(backendSrc, "contracts");
const target = resolve(frontendRoot, "src", "types", "contracts");

/**
 * Read Models expostos pela API e consumidos pelo frontend.
 * Caminhos relativos a `backend/src`.
 */
const READ_MODELS = [
  "modules/dashboards/dashboard.read-models.ts",
  "modules/analytics/analytics.read-models.ts",
  "modules/scheduling/scheduling.read-models.ts",
  "modules/identity/identity.read-models.ts",
  "modules/organizations/organization.read-models.ts",
  "modules/operations/operation.read-models.ts",
  "modules/artifact-templates/artifact-template.read-models.ts",
  "modules/artifact-executions/artifact-execution.read-models.ts",
  "modules/organizations/business-units/customers/customer.read-models.ts",
  "modules/storage/file-object.read-models.ts",
  "modules/artifact-manifests/artifact-manifest.read-models.ts",
  "modules/artifact-rendering/artifact-render.read-models.ts",
  "modules/workforce/workforce.read-models.ts",
  "modules/financial/financial.read-models.ts",
  "modules/quotes/quote.read-models.ts",
  "modules/inventory/inventory.read-models.ts",
  "modules/automations/automation.read-models.ts",
  "modules/management-reports/report.read-models.ts",
];

const BANNER = `/**
 * ARQUIVO GERADO — NÃO EDITE MANUALMENTE.
 * Fonte: backend/src
 * Regenerar: npm run contracts:sync
 */
`;

if (!existsSync(source)) {
  console.error(`[contracts] diretório de origem não encontrado: ${source}`);
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

for (const readModel of READ_MODELS) {
  const from = resolve(backendSrc, readModel);
  if (!existsSync(from)) {
    console.error(`[contracts] Read Model não encontrado: ${from}`);
    process.exit(1);
  }
  const to = join(target, readModel);
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to);
  const content = await readFile(to, "utf8");
  await writeFile(
    to,
    content.replaceAll("from '../../contracts'", "from '../..'"),
    "utf8",
  );
}

/** @param {string} directory */
async function stampBanner(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await stampBanner(path);
      continue;
    }
    if (!entry.name.endsWith(".ts")) {
      await rm(path);
      continue;
    }
    const content = await readFile(path, "utf8");
    await writeFile(path, `${BANNER}\n${content}`, "utf8");
    console.log(`[contracts] ${relative(frontendRoot, path)}`);
  }
}

await stampBanner(target);
console.log("[contracts] sincronização concluída.");
