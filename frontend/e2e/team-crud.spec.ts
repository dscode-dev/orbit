/**
 * Cadastro de pessoas da equipe, senha temporária e troca forçada.
 *
 * ## O que se prova
 *
 * Que o owner cadastra um técnico sem convite, recebe uma senha temporária que
 * aparece **uma vez**, e que essa senha não serve para trabalhar: quem entra
 * com ela é levado para a troca e não sai de lá até trocar.
 *
 * A última parte é a que mais importa. O guard de troca obrigatória existia no
 * frontend desde antes, lendo um campo que o backend **não publicava** — ele
 * nunca disparava, e ninguém tinha como perceber pela tela.
 */
import { expect, test } from "@playwright/test";

import { assertClean, login, record, settled } from "./support";

test("cadastra o técnico, mostra a senha uma vez e força a troca", async ({
  page,
}) => {
  const recorder = record(page);
  await page.setViewportSize({ width: 1440, height: 1200 });
  await login(page);

  await page.goto("/equipe");
  await settled(page);

  /* ---------------------------------------------------------------- */
  /* As abas que saíram                                                */
  /* ---------------------------------------------------------------- */

  for (const rotulo of [
    "Profissionais",
    "Localização",
    "Convites",
    "Papéis",
    "Inteligência",
  ]) {
    await expect(
      page.getByRole("tab", { name: rotulo }),
      `a aba ${rotulo} deveria ter saído`,
    ).toHaveCount(0);
  }
  await expect(page.getByRole("tab", { name: "Usuários" })).toBeVisible();

  /* ---------------------------------------------------------------- */
  /* Cadastro                                                          */
  /* ---------------------------------------------------------------- */

  const carimbo = Date.now();
  const emailTecnico = `tecnico.e2e.${carimbo}@orbit.local`;

  await page.getByRole("button", { name: "Cadastrar usuário" }).click();
  await page.locator("#member-first-name").fill("Joao");
  await page.locator("#member-last-name").fill(`Campo ${carimbo}`);
  await page.locator("#member-email").fill(emailTecnico);

  await page.locator("#member-role").click();
  await page.getByRole("option", { name: "Técnico operacional" }).click();

  /// O papel se explica antes de ser concedido, não depois.
  await expect(page.getByText(/Executa o atendimento em campo/)).toBeVisible();

  await page.getByRole("button", { name: "Cadastrar", exact: true }).click();

  const senhaVisivel = page.getByTestId("temporary-password");
  await expect(senhaVisivel).toBeVisible();
  const senha = ((await senhaVisivel.textContent()) ?? "").trim();
  expect(senha).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  /// O diálogo diz que é a única vez — antes de fechar, não depois.
  await expect(page.getByText(/uma única vez/i)).toBeVisible();
  await page.getByRole("button", { name: "Concluir" }).click();

  await expect(page.getByText(emailTecnico)).toBeVisible();

  /* ---------------------------------------------------------------- */
  /* A senha temporária não serve para trabalhar                       */
  /* ---------------------------------------------------------------- */

  /**
   * Sessão nova, e não a do owner.
   *
   * O logout é `POST` — navegar para a rota deixava a sessão do owner de pé, e
   * `/login` então redirecionava direto para o painel. O contexto continuava
   * autenticado e o teste media a tela errada.
   */
  await page.request.post("/api/auth/logout").catch(() => undefined);
  await page.context().clearCookies();
  await page.goto("/login");
  await settled(page);

  await page.getByLabel(/e-?mail/i).fill(emailTecnico);
  await page.getByLabel(/senha/i).first().fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  /**
   * Levado para a troca, e preso nela.
   *
   * Não basta chegar: tentar ir para o painel tem de trazer de volta, senão o
   * "forçado" seria só uma sugestão que some ao digitar outra URL.
   */
  await page.waitForURL(/\/redefinir-senha/, { timeout: 30_000 });
  await page.goto("/dashboard");
  await page.waitForURL(/\/redefinir-senha/, { timeout: 30_000 });

  /* ---------------------------------------------------------------- */
  /* E a troca é possível aqui, sem e-mail                             */
  /* ---------------------------------------------------------------- */

  /**
   * Esta parte tranca uma regressão específica.
   *
   * A tela mandava pedir um link por e-mail. Quem passa pela troca obrigatória
   * é justamente o técnico que o dono cadastrou — muitas vezes sem e-mail de
   * trabalho —, e ele ficava autenticado, sem nenhuma tela acessível e sem o
   * e-mail que a página exigia.
   */
  const novaSenha = `Tecnico#E2E${carimbo}`;
  await page.locator("#currentPassword").fill(senha);
  await page.locator("#newPassword").fill(novaSenha);
  await page.locator("#confirmPassword").fill(novaSenha);
  await page.getByRole("button", { name: "Salvar e continuar" }).click();

  /// Trocada, o guard solta: a pessoa chega ao sistema.
  await page.waitForURL((url) => !url.pathname.includes("redefinir-senha"), {
    timeout: 30_000,
  });

  assertClean(recorder, "cadastro de equipe");
});
