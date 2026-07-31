#!/usr/bin/env node
/**
 * Copia os contratos do backend (NestJS) para o frontend.
 *
 * O backend é a única fonte de verdade dos contratos da API. O diretório
 * `backend/src/contracts` contém apenas tipos e literais TypeScript puros
 * (sem dependências de runtime), o que permite reutilizá-los no frontend.
 *
 * Não usamos import direto (`../backend/src/contracts`) porque o build de
 * produção do frontend roda em um contexto Docker isolado (`./frontend`),
 * onde o diretório do backend não existe.
 *
 * Uso: npm run contracts:sync
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, "..");
const source = resolve(frontendRoot, "..", "backend", "src", "contracts");
const target = resolve(frontendRoot, "src", "types", "contracts");

const BANNER = `/**
 * ARQUIVO GERADO — NÃO EDITE MANUALMENTE.
 * Fonte: backend/src/contracts
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
