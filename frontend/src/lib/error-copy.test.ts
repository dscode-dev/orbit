/**
 * A mensagem que a pessoa lê.
 *
 * O que se protege aqui é a fronteira: status HTTP e texto interno do servidor
 * não chegam à tela, e a explicação de negócio — que é a informação útil —
 * chega inteira.
 */
import { describe, expect, it } from "vitest";

import { ApiError } from "./api-error";
import { errorCopy } from "./error-copy";

function http(status: number, message = "") {
  return new ApiError({ kind: "http", message, status });
}

describe("mensagem de erro", () => {
  it("traduz sessão expirada", () => {
    expect(errorCopy(http(401, "Unauthorized"))).toBe(
      "Sua sessão expirou. Entre novamente.",
    );
  });

  it("traduz falta de permissão", () => {
    expect(errorCopy(http(403, "Forbidden"))).toBe(
      "Você não tem permissão para realizar esta ação.",
    );
  });

  it("traduz recurso ausente sem devolver o identificador", () => {
    const copy = errorCopy(
      http(404, "Operation with identifier 01a0-aaaa was not found"),
    );
    expect(copy).toBe("Este item não está mais disponível.");
    expect(copy).not.toContain("01a0");
    expect(copy).not.toContain("Operation");
  });

  it("preserva a explicação de negócio de um conflito", () => {
    /// "Limite atingido" é a informação que a pessoa precisa. Trocá-la por um
    /// texto genérico esconderia o motivo.
    expect(
      errorCopy(http(409, "O limite de 6 evidências foi atingido")),
    ).toBe("O limite de 6 evidências foi atingido");
  });

  it("preserva explicação de negócio mesmo em inglês", () => {
    /// O idioma é um problema separado, e do backend. Esconder "o equipamento
    /// já está coberto" tiraria da pessoa a única informação que a faz agir —
    /// uma perda maior do que a frase estar em inglês.
    expect(
      errorCopy(http(409, "This equipment is already covered by the plan")),
    ).toBe("This equipment is already covered by the plan");
  });

  it("usa texto genérico quando o conflito vem em linguagem interna", () => {
    expect(errorCopy(http(409, "Version conflict detected"))).toBe(
      "Os dados foram alterados. Atualize para continuar.",
    );
  });

  it("preserva a explicação de validação em português", () => {
    expect(errorCopy(http(400, "Quantidade de material inválida"))).toBe(
      "Quantidade de material inválida",
    );
  });

  it("nunca expõe status HTTP nem detalhe de servidor em 5xx", () => {
    const copy = errorCopy(http(500, "Internal server error at UserRepository"));
    expect(copy).toBe(
      "Não foi possível concluir a operação agora. Tente novamente em instantes.",
    );
    expect(copy).not.toMatch(/500|Repository|server/i);
  });

  it("distingue falta de conexão de tempo esgotado", () => {
    expect(
      errorCopy(new ApiError({ kind: "network", message: "fetch failed" })),
    ).toContain("Verifique sua conexão");
    expect(
      errorCopy(new ApiError({ kind: "timeout", message: "timeout" })),
    ).toContain("demorou mais que o esperado");
  });

  it("um erro que não é da API ainda produz frase de produto", () => {
    expect(errorCopy(new Error("boom"))).toBe(
      "Não foi possível concluir a operação.",
    );
  });

  it("nenhuma mensagem menciona a arquitetura", () => {
    const todas = [
      errorCopy(http(401)),
      errorCopy(http(403)),
      errorCopy(http(404)),
      errorCopy(http(409, "x")),
      errorCopy(http(500)),
      errorCopy(new ApiError({ kind: "network", message: "" })),
    ].join(" ");
    expect(todas).not.toMatch(/backend|servidor|endpoint|API|HTTP/i);
  });
});

describe("respostas do servidor reescritas em linguagem de produto", () => {
  it("diz que o documento já está cadastrado, sem falar de banco", () => {
    const copy = errorCopy(
      http(409, "Customer document is already registered"),
    );
    expect(copy).toBe("Já existe um cliente cadastrado com este CPF ou CNPJ.");
    expect(copy).not.toMatch(/customer|document|registered/i);
  });

  it("traduz a recusa de e-mail sem citar a propriedade do contrato", () => {
    expect(errorCopy(http(400, "email must be an email"))).toBe(
      "Informe um e-mail válido.",
    );
  });

  it("traduz a exigência de tipo e número juntos", () => {
    expect(
      errorCopy(http(400, "Document type and number must be provided together")),
    ).toBe("Informe o tipo e o número do documento juntos.");
  });

  it("traduz o documento que não fecha", () => {
    expect(errorCopy(http(400, "must be a valid CPF or CNPJ"))).toBe(
      "Este CPF ou CNPJ não confere.",
    );
  });

  it("regra de negócio que a tabela não conhece continua passando como veio", () => {
    const message = "This equipment is already covered by the plan";
    expect(errorCopy(http(409, message))).toBe(message);
  });
});
