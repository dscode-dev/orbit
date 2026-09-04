/**
 * O shell — o que a navegação principal mostra e promete.
 *
 * O que se prova aqui: que a sidebar oferece navegação, contexto e conta, e
 * nada além disso; que o contexto exibido é o da sessão e não um nome de
 * exemplo; e que a navegação consolidada pelas etapas anteriores continua de pé.
 */
import { expect, test, type Page } from "@playwright/test";

import { assertClean, login, record } from "./support";

const aside = (page: Page) => page.locator("aside");
const nav = (page: Page) =>
  page.locator('nav[aria-label="Navegação principal"]');

async function expand(page: Page) {
  const toggle = page.getByRole("button", { name: "Expandir menu lateral" });
  await toggle.click();
  await expect(
    page.getByRole("button", { name: "Recolher menu lateral" }),
  ).toBeVisible();
}

test.describe("shell", () => {
  test("a sidebar expandida não promove funcionalidade", async ({ page }) => {
    const recorder = record(page);
    await login(page);
    await page.goto("/dashboard");
    await expand(page);

    /**
     * O card dizia "Orbit Copilot — Automatize rotinas operacionais" com um
     * botão "Ativar" sem `onClick`, promovendo o que o produto não tem: não
     * existe "copilot" em backend, contrato, rota ou capability.
     */
    await expect(aside(page)).not.toContainText(/copilot/i);
    await expect(aside(page).getByRole("button", { name: "Ativar" })).toHaveCount(0);

    /** E nenhum bloco vazio ficou no lugar dele. */
    const vazios = await aside(page).evaluate((el) =>
      Array.from(el.children).filter(
        (c) =>
          !(c.textContent ?? "").trim() &&
          !c.querySelector("img,svg") &&
          c.getBoundingClientRect().height > 8,
      ).length,
    );
    expect(vazios).toBe(0);

    assertClean(recorder, "sidebar expandida");
  });

  test("o contexto mostra a organização da sessão, não um exemplo", async ({
    page,
  }) => {
    const recorder = record(page);
    await login(page);
    await page.goto("/dashboard");
    await expand(page);

    /** Havia "Acme Industries — Workspace produção", inventados, num botão inerte. */
    await expect(aside(page)).not.toContainText("Acme Industries");
    await expect(aside(page)).not.toContainText("Workspace produção");

    const contexto = aside(page).locator('a[href*="secao=contexto"]');
    await expect(contexto).toBeVisible();
    /** Leva para onde a unidade de fato se troca. */
    await contexto.click();
    await page.waitForURL(/\/perfil\?secao=contexto/, { timeout: 20_000 });
    await expect(page.locator('[role="tab"][data-state="active"]')).toHaveText(
      "Contexto",
    );

    assertClean(recorder, "contexto da sessão");
  });

  test("a navegação consolidada das etapas anteriores continua de pé", async ({
    page,
  }) => {
    const recorder = record(page);
    await login(page);
    await page.goto("/dashboard");
    await expand(page);

    const menu = nav(page);
    /** H04: o centro de artefatos diz de que execução se trata. */
    await expect(menu.getByRole("link", { name: "Execuções de artefato" })).toBeVisible();
    /** H05: duas entradas de administração, e "Organização" não é uma delas. */
    await expect(menu.getByRole("link", { name: "Configurações" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Minha conta" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Organização" })).toHaveCount(0);
    /** H03: Clientes segue no lugar. */
    await expect(menu.getByRole("link", { name: "Clientes" })).toBeVisible();

    assertClean(recorder, "navegação preservada");
  });

  test("o item ativo é anunciado, não só pintado", async ({ page }) => {
    const recorder = record(page);
    await login(page);
    await page.goto("/clientes");
    await expand(page);

    const ativo = nav(page).locator('a[aria-current="page"]');
    await expect(ativo).toHaveCount(1);
    await expect(ativo).toHaveAttribute("aria-label", "Clientes");

    assertClean(recorder, "item ativo");
  });

  test("recolhida, cada item continua tendo nome", async ({ page }) => {
    const recorder = record(page);
    await login(page);
    await page.goto("/dashboard");

    /** A sidebar abre recolhida: só ícones, e o nome vem do rótulo acessível. */
    const links = nav(page).getByRole("link");
    await expect(links.first()).toBeAttached({ timeout: 20_000 });
    const total = await links.count();
    expect(total).toBeGreaterThan(10);
    for (let i = 0; i < total; i++) {
      await expect(links.nth(i)).toHaveAttribute("aria-label", /\S/);
    }

    await expect(
      page.getByRole("button", { name: "Expandir menu lateral" }),
    ).toBeVisible();

    assertClean(recorder, "sidebar recolhida");
  });

  test("a navegação é um marco de página e rola dentro de si", async ({
    page,
  }) => {
    const recorder = record(page);
    await login(page);
    await page.goto("/dashboard");
    await expand(page);

    await expect(nav(page)).toHaveAttribute("aria-label", "Navegação principal");
    /** O menu longo rola no próprio painel; a página não ganha barra horizontal. */
    const sideways = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(sideways).toBe(0);

    assertClean(recorder, "marco de navegação");
  });
});
