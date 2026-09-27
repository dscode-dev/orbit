/**
 * A recusa do login, e o campo que ela abre.
 *
 * Este teste existe por um defeito real: a tela decidia pela mensagem interna em
 * inglês, que o contrato nunca envia, e quem ativava o segundo fator não
 * conseguia mais entrar. A decisão é pelo código publicado — e um código novo no
 * catálogo não muda nada aqui sem alguém decidir.
 */
import { describe, expect, it } from "vitest";

import { ApiError } from "./api-error";
import { loginFailure } from "./login-failure";

function recusa(code: string, message: string): ApiError {
  return new ApiError({ kind: "http", status: 401, code, message });
}

describe("loginFailure", () => {
  it("abre o campo do código quando o servidor diz que ele falta", () => {
    const acao = loginFailure(
      recusa("MFA_REQUIRED", "Informe o código do seu autenticador."),
    );

    expect(acao.revealMfa).toBe(true);
    expect(acao.description).toBe("Informe o código do seu autenticador.");
  });

  it("mantém o campo aberto quando o código não confere", () => {
    /* Fechar obrigaria a digitar e-mail e senha de novo por causa de um dígito. */
    expect(loginFailure(recusa("MFA_INVALID", "não confere")).revealMfa).toBe(
      true,
    );
  });

  it("não abre o campo em credencial errada", () => {
    const acao = loginFailure(
      recusa("UNAUTHORIZED", "Sua sessão não é válida ou expirou."),
    );

    expect(acao.revealMfa).toBe(false);
    expect(acao.title).toBe("Não foi possível entrar");
  });

  it("ignora a mensagem interna em inglês, que o contrato não envia", () => {
    /* O defeito original: decidir por este texto. Se alguém voltar a comparar
       mensagem, este teste cai. */
    expect(
      loginFailure(recusa("UNAUTHORIZED", "MFA code is required")).revealMfa,
    ).toBe(false);
  });

  it("nunca fica sem texto: `ApiError` garante uma mensagem", () => {
    /* Por isso não há fallback nesta função — seria ramo morto. */
    const acao = loginFailure(recusa("UNAUTHORIZED", ""));

    expect(acao.description.length).toBeGreaterThan(0);
  });
});
