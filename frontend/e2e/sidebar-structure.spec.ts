/**
 * A organização do menu, e o que ela exige das páginas.
 *
 * ## Por que no navegador
 *
 * A estrutura do menu é um array — um teste de unidade provaria que o array
 * mudou. O que só o navegador prova é a consequência: que o item saiu do menu
 * **e** o conteúdo continua alcançável, que a rota antiga não virou 404, e que a
 * aba abre pelo endereço. É esse o par que uma reorganização de navegação pode
 * quebrar, e quebra em silêncio.
 */
import { expect, test } from "@playwright/test";

import { login, record, settled } from "./support";

/** O que o menu principal oferece, em ordem. */
const EXPECTED_MENU = [
  "/dashboard",
  "/agenda",
  "/operacoes",
  "/clientes",
  "/catalogo",
  "/orcamentos",
  "/financeiro",
  "/documentos",
  "/relatorios",
  "/catalogos",
  "/equipe",
  "/configuracoes",
  "/perfil",
];

test("o menu não oferece PMOC, RVT nem Modelos — eles são abas", async ({
  page,
}) => {
  const recorder = record(page);

  await login(page);
  await settled(page);

  const menu = page.getByRole("navigation", { name: "Navegação principal" });
  const destinos = await menu
    .locator("a")
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? ""),
    );

  expect(destinos).toEqual(EXPECTED_MENU);

  /* O que saiu não pode reaparecer por outro caminho no menu. */
  for (const removido of ["/pmoc", "/rvt", "/artefatos"]) {
    expect(destinos).not.toContain(removido);
  }

  /*
   * Operações está no primeiro grupo, sem rótulo — junto de Visão geral e
   * Agenda. Se voltasse para um grupo, haveria um título antes dela.
   */
  expect(destinos.indexOf("/operacoes")).toBe(2);

  expect(recorder.pageErrors, "exceções não tratadas").toEqual([]);
  expect(recorder.reactWarnings, "avisos de React").toEqual([]);
});

test("PMOC, RVT e Modelos abrem como aba, e a rota antiga leva até elas", async ({
  page,
}) => {
  const recorder = record(page);

  await login(page);

  /* Link guardado não pode dar 404: a rota antiga redireciona para a aba. */
  const casos = [
    { antiga: "/pmoc", destino: "/operacoes", secao: "pmoc", aba: "PMOC" },
    { antiga: "/rvt", destino: "/operacoes", secao: "rvt", aba: "RVT" },
    {
      antiga: "/artefatos",
      destino: "/relatorios",
      secao: "modelos",
      aba: "Modelos",
    },
  ] as const;

  for (const caso of casos) {
    await page.goto(caso.antiga);
    await settled(page);

    const url = new URL(page.url());
    expect(url.pathname, `${caso.antiga} redireciona`).toBe(caso.destino);
    expect(url.searchParams.get("secao")).toBe(caso.secao);

    /* A aba pedida é a que está selecionada — não a primeira da lista. */
    await expect(
      page.getByRole("tab", { name: caso.aba, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  }

  expect(recorder.pageErrors, "exceções não tratadas").toEqual([]);
  expect(recorder.reactWarnings, "avisos de React").toEqual([]);
  expect(
    recorder.consoleErrors.filter((erro) => !/403 \(Forbidden\)/.test(erro)),
    "console.error além do 403 esperado",
  ).toEqual([]);
});

test("a aba de Operações sobrevive a recarregar", async ({ page }) => {
  await login(page);

  /* Era estado local: recarregar voltava para a primeira aba, e o endereço não
     descrevia o que estava na tela. */
  await page.goto("/operacoes?secao=rvt");
  await settled(page);
  await page.reload();
  await settled(page);

  await expect(
    page.getByRole("tab", { name: "RVT", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
