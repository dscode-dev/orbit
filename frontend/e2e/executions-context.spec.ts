/**
 * Onde cada execução é encontrada.
 *
 * O produto tem três execuções distintas, e elas não se confundem:
 *
 * - `PmocEquipmentExecution` — por equipamento, dentro de um ciclo do plano;
 * - `RvtExecution` — por ocorrência, dentro de uma configuração;
 * - `ArtifactExecution` — o preenchimento de um artefato, que pode vir de uma
 *   operação, de um RVT ou de nada além de si.
 *
 * O que se prova aqui é que as duas primeiras são alcançadas dentro do pai, e
 * que a terceira preserva o vínculo quando ele vem na URL.
 */
import { expect, test, type Page } from "@playwright/test";

import { assertClean, login, record } from "./support";

/**
 * Uma leitura pelo BFF, com a sessão do navegador.
 *
 * O proxy exige metadados de origem — `sec-fetch-site: same-origin` — e recusa
 * com `FORBIDDEN_ORIGIN` quem não os manda. É a proteção contra requisição
 * disparada de outra página, e o teste manda exatamente o que o navegador
 * mandaria em vez de contorná-la.
 */
async function bff(page: Page, path: string) {
  const origin = new URL(page.url()).origin;
  return page.request.get(path, {
    headers: {
      Origin: origin,
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "cors",
    },
  });
}

/** Abre o primeiro registro da listagem e devolve a URL do detalhe. */
async function openFirst(page: Page, base: string): Promise<string | null> {
  await page.goto(base);
  await page.waitForLoadState("networkidle").catch(() => {});
  const link = page.locator(`a[href^="${base}/"]`).first();
  if ((await link.count()) === 0) return null;
  await link.click();
  await page.waitForURL(new RegExp(`${base}/[0-9a-f-]{36}`), { timeout: 20_000 });
  return new URL(page.url()).pathname;
}

test("as execuções do PMOC são vistas dentro do plano, por ciclo", async ({
  page,
}) => {
  const recorder = record(page);
  await login(page);

  const detail = await openFirst(page, "/pmoc");
  expect(detail, "nenhum plano PMOC na listagem").not.toBeNull();

  await expect(page.getByRole("tab", { name: "Ciclos" })).toBeVisible();
  await page.getByRole("tab", { name: "Ciclos" }).click();

  /** A seção é do ciclo selecionado — a granularidade é o equipamento. */
  const section = page.locator('section[aria-label="Execuções por equipamento"]');
  await expect(section).toBeVisible({ timeout: 20_000 });

  /** O contexto do plano não é pedido de novo: a URL continua a do plano. */
  expect(new URL(page.url()).pathname).toBe(detail);

  assertClean(recorder, "execuções do PMOC");
});

test("as consultas do PMOC são recortadas pelo servidor, por plano e ciclo", async ({
  page,
}) => {
  const recorder = record(page);
  await login(page);

  const scoped: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/equipment-executions$/.test(path)) scoped.push(path);
  });

  const detail = await openFirst(page, "/pmoc");
  expect(detail).not.toBeNull();
  const planId = detail!.split("/").pop()!;

  await page.getByRole("tab", { name: "Ciclos" }).click();
  await expect(
    page.locator('section[aria-label="Execuções por equipamento"]'),
  ).toBeVisible({ timeout: 20_000 });

  /** Nada de buscar tudo e filtrar no navegador: plano e ciclo vão na rota. */
  expect(scoped.length).toBeGreaterThan(0);
  for (const path of scoped) {
    expect(path).toContain(`/pmoc/plans/${planId}/cycles/`);
  }

  assertClean(recorder, "recorte do PMOC");
});

test("as visitas do RVT são vistas dentro da configuração", async ({ page }) => {
  const recorder = record(page);
  await login(page);

  const detail = await openFirst(page, "/rvt");
  expect(detail, "nenhuma configuração RVT na listagem").not.toBeNull();

  await expect(page.getByRole("tab", { name: "Visitas" })).toBeVisible();
  await page.getByRole("tab", { name: "Visitas" }).click();

  /**
   * As ocorrências vêm embutidas no detalhe: abrir a aba não dispara uma
   * segunda consulta que pudesse discordar da primeira.
   */
  const calls: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/\/api\/orbit\/rvt\//.test(path)) calls.push(path);
  });
  await page.waitForTimeout(1_500);
  expect(calls).toEqual([]);

  expect(new URL(page.url()).pathname).toBe(detail);

  assertClean(recorder, "visitas do RVT");
});

test("a execução de um RVT abre na rota do próprio RVT", async ({ page }) => {
  const recorder = record(page);
  await login(page);

  await openFirst(page, "/rvt");
  await page.getByRole("tab", { name: "Visitas" }).click();

  const link = page.locator('a[href^="/rvt/execucoes/"]').first();
  if ((await link.count()) === 0) {
    test.skip(true, "a configuração aberta não tem visita executada");
    return;
  }
  await link.click();
  await page.waitForURL(/\/rvt\/execucoes\/[0-9a-f-]{36}/, { timeout: 20_000 });

  /** O contexto pai está na própria rota — não é uma superfície global. */
  expect(new URL(page.url()).pathname).toMatch(/^\/rvt\/execucoes\//);

  assertClean(recorder, "execução do RVT");
});

test("o vínculo na URL recorta as execuções de artefato no servidor", async ({
  page,
}) => {
  const recorder = record(page);
  await login(page);

  const queries: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/artifact-executions") && url.searchParams.has("assetId")) {
      queries.push(url.search);
    }
  });

  const asset = "01a057ee-cfda-72de-9874-63bb83b988d8";
  await page.goto(`/execucoes?assetId=${asset}`);
  await page.waitForLoadState("networkidle").catch(() => {});

  /** Chega já na fila, e não na visão geral: é o recorte que a pessoa veio ver. */
  await expect(page.locator('[role="tab"][data-state="active"]')).toHaveText(
    "Filas",
  );

  /** O filtro viaja para o servidor — nada de buscar tudo e recortar aqui. */
  await expect
    .poll(() => queries.length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  for (const search of queries) expect(search).toContain(asset);

  assertClean(recorder, "recorte por ativo");
});

test("sem vínculo, o centro de artefatos abre na visão geral", async ({
  page,
}) => {
  const recorder = record(page);
  await login(page);

  await page.goto("/execucoes");
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator('[role="tab"][data-state="active"]')).toHaveText(
    "Visão geral",
  );

  assertClean(recorder, "centro sem recorte");
});

test("a navegação nomeia o domínio de cada execução", async ({ page }) => {
  const recorder = record(page);
  await login(page);
  await page.goto("/dashboard");

  const nav = page.locator("nav").first();
  /** PMOC e RVT têm as suas áreas; o centro de artefatos diz o que reúne. */
  await expect(nav.getByRole("link", { name: "PMOC" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "RVT" })).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Execuções de artefato" }),
  ).toBeVisible();

  assertClean(recorder, "navegação");
});

/* ------------------------------------------------------------------ */
/* Operação — a superfície contextual da H04.1                          */
/* ------------------------------------------------------------------ */

/**
 * Duas operações que têm execução de artefato, descobertas pela própria API.
 *
 * Não é "o primeiro registro que casar": o teste escolhe dois vínculos
 * distintos e depois afirma o conteúdo de cada um. Se o ambiente não tiver
 * dois, o cenário diz isso em vez de fingir que passou.
 */
async function twoOperationsWithExecutions(page: Page) {
  const response = await bff(page, "/api/orbit/artifact-executions?limit=60&page=1");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  const rows: Array<{ id: string; code: string; operationId: string | null }> =
    body.data?.data ?? body.data ?? [];

  const byOperation = new Map<string, { id: string; code: string }>();
  for (const row of rows) {
    if (row.operationId && !byOperation.has(row.operationId)) {
      byOperation.set(row.operationId, { id: row.id, code: row.code });
    }
  }
  const pairs = [...byOperation.entries()];
  return pairs.length >= 2
    ? { a: pairs[0], b: pairs[1] }
    : null;
}

test("a operação mostra as suas execuções de artefato, e só as suas", async ({
  page,
}) => {
  const recorder = record(page);
  await login(page);

  const found = await twoOperationsWithExecutions(page);
  if (!found) {
    test.skip(true, "o ambiente não tem duas operações com execução");
    return;
  }
  const [operationA, executionA] = found.a;
  const [, executionB] = found.b;

  const scoped: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.endsWith("/artifact-executions") &&
      url.searchParams.get("operationId")
    ) {
      scoped.push(url.searchParams.get("operationId")!);
    }
  });

  await page.goto(`/operacoes/${operationA}`);
  await page.waitForLoadState("networkidle").catch(() => {});

  const panel = page.locator('[data-panel="operation-artifact-executions"]');
  await expect(panel).toBeVisible({ timeout: 20_000 });

  /** O que é desta operação aparece. */
  await expect(panel).toContainText(executionA.code);
  /** O que é de outra, não. */
  await expect(panel).not.toContainText(executionB.code);

  /** O recorte foi decidido no servidor, não aqui. */
  expect(scoped).toContain(operationA);

  assertClean(recorder, "execuções de artefato da operação");
});

test("o recorte da operação viaja no “Ver tudo”", async ({ page }) => {
  const recorder = record(page);
  await login(page);

  const found = await twoOperationsWithExecutions(page);
  if (!found) {
    test.skip(true, "o ambiente não tem operação com execução");
    return;
  }
  const [operationA] = found.a;

  await page.goto(`/operacoes/${operationA}`);
  const panel = page.locator('[data-panel="operation-artifact-executions"]');
  await expect(panel).toBeVisible({ timeout: 20_000 });

  await panel.getByRole("link", { name: /Ver tudo/i }).click();
  await page.waitForURL(new RegExp(`/execucoes\\?operationId=${operationA}`), {
    timeout: 20_000,
  });

  /** A fila abre já recortada, e não na visão geral da organização. */
  await expect(page.locator('[role="tab"][data-state="active"]')).toHaveText(
    "Filas",
  );

  assertClean(recorder, "ver tudo da operação");
});

test("a execução abre pela rota canônica do artefato", async ({ page }) => {
  const recorder = record(page);
  await login(page);

  const found = await twoOperationsWithExecutions(page);
  if (!found) {
    test.skip(true, "o ambiente não tem operação com execução");
    return;
  }
  const [operationA, executionA] = found.a;

  await page.goto(`/operacoes/${operationA}`);
  const panel = page.locator('[data-panel="operation-artifact-executions"]');
  await expect(panel).toBeVisible({ timeout: 20_000 });

  /** O código fica na linha de apoio; o link é o título, na mesma linha da lista. */
  await panel
    .getByRole("listitem")
    .filter({ hasText: executionA.code })
    .getByRole("link")
    .click();
  await page.waitForURL(new RegExp(`/execucoes/${executionA.id}`), {
    timeout: 20_000,
  });

  assertClean(recorder, "detalhe da execução");
});

test("execuções de artefato e checklists continuam seções distintas", async ({
  page,
}) => {
  const recorder = record(page);
  await login(page);

  const found = await twoOperationsWithExecutions(page);
  if (!found) {
    test.skip(true, "o ambiente não tem operação com execução");
    return;
  }
  const [operationA] = found.a;

  await page.goto(`/operacoes/${operationA}`);
  await expect(
    page.locator('[data-panel="operation-artifact-executions"]'),
  ).toBeVisible({ timeout: 20_000 });
  /** `ChecklistExecution` é outro conceito, e continua no seu lugar. */
  await expect(page.locator('[data-panel="operation-checklists"]')).toBeVisible();

  assertClean(recorder, "seções distintas");
});

/* ------------------------------------------------------------------ */
/* PMOC — a elegibilidade no Read Model                                 */
/* ------------------------------------------------------------------ */

test("a lista do ciclo não pede uma preparação por equipamento", async ({
  page,
}) => {
  const recorder = record(page);
  await login(page);

  const preparations: string[] = [];
  const lists: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/execution-preparation$/.test(path)) preparations.push(path);
    if (/equipment-executions$/.test(path)) lists.push(path);
  });

  await openFirst(page, "/pmoc");
  await page.getByRole("tab", { name: "Ciclos" }).click();
  const section = page.locator(
    'section[aria-label="Execuções por equipamento"]',
  );
  await expect(section).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2_000);

  /** Uma consulta traz a lista inteira, disponibilidade incluída. */
  expect(lists.length).toBeGreaterThan(0);
  /** E nenhuma requisição por linha só para desenhar a disponibilidade. */
  expect(preparations).toEqual([]);

  assertClean(recorder, "ciclo sem N+1");
});

test("a disponibilidade da lista concorda com a preparação canônica", async ({
  page,
}) => {
  const recorder = record(page);
  await login(page);

  const detail = await openFirst(page, "/pmoc");
  expect(detail).not.toBeNull();
  const planId = detail!.split("/").pop()!;

  const cycles = await bff(page, `/api/orbit/pmoc/plans/${planId}/executions`);
  expect(cycles.ok()).toBe(true);
  const cycleBody = await cycles.json();
  const cycleId = (cycleBody.data?.data ?? cycleBody.data ?? [])[0]?.id;
  if (!cycleId) {
    test.skip(true, "o plano aberto não tem ciclo");
    return;
  }

  const listResponse = await bff(
    page,
    `/api/orbit/pmoc/plans/${planId}/cycles/${cycleId}/equipment-executions`,
  );
  expect(listResponse.ok()).toBe(true);
  const rows = (await listResponse.json()).data as Array<{
    equipment: { id: string };
    eligibility: { ready: boolean; blockedReasons: string[] };
  }>;
  expect(rows.length).toBeGreaterThan(0);

  /** Toda linha publica a disponibilidade — não é um campo opcional na prática. */
  for (const row of rows) expect(row.eligibility).toBeTruthy();

  /**
   * Mesma regra, duas leituras: a da lista e a da preparação canônica têm de
   * dizer a mesma coisa sobre o mesmo equipamento no mesmo estado.
   */
  const sample = rows[0];
  const preparation = await bff(
    page,
    `/api/orbit/pmoc/plans/${planId}/cycles/${cycleId}/equipment/${sample.equipment.id}/execution-preparation`,
  );
  expect(preparation.ok()).toBe(true);
  const canonical = (await preparation.json()).data.eligibility;
  expect(sample.eligibility).toEqual(canonical);

  assertClean(recorder, "paridade da disponibilidade");
});
