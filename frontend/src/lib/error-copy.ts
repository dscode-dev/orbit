/**
 * O erro em linguagem de produto.
 *
 * `ApiError.message` é a mensagem **do servidor** — às vezes uma explicação de
 * negócio útil ("Não é possível movimentar itens deste tipo"), às vezes um
 * texto interno em inglês com identificador junto. A tela precisa do primeiro
 * caso e não pode mostrar o segundo.
 *
 * A regra aqui é simples: para as situações em que a resposta do servidor
 * descreve **o que falhou no sistema**, a interface usa a própria frase; para
 * as em que ela descreve **o que está errado no pedido**, a frase do servidor
 * costuma ser a informação mais útil que existe, e apagá-la esconderia o
 * motivo.
 *
 * Isto é apresentação. Nenhuma decisão de autorização, fluxo ou disponibilidade
 * passa por aqui.
 */
import { ApiError } from "@/lib/api-error";

/**
 * Texto que existe para quem mantém o sistema, não para quem o usa.
 *
 * O critério é o **assunto**, não o idioma. "This equipment is already covered
 * by the plan" está em inglês, mas explica uma regra de negócio que a pessoa
 * precisa conhecer para agir; trocá-la por uma frase genérica esconderia o
 * motivo — que é justamente o que a interface deve dizer.
 *
 * O que se descarta é outra coisa: identificador cru, vocabulário de
 * implementação e as frases que só descrevem o transporte.
 */
function looksInternal(message: string): boolean {
  if (!message.trim()) return true;

  /** Identificador no meio da frase: serve ao log, não à tela. */
  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(message)) return true;

  /** Vocabulário de implementação. */
  if (
    /\b(version conflict|optimistic|idempot\w*|constraint|unique violation|foreign key|null|undefined|exception|stack|prisma|typeorm|ECONN\w*|timeout of \d+)\b/i.test(
      message,
    )
  ) {
    return true;
  }

  /** Frases que só repetem o status HTTP. */
  return /^(not found|forbidden|unauthorized|internal server error|bad request|conflict)\.?$/i.test(
    message.trim(),
  );
}

/**
 * A frase que a pessoa lê.
 *
 * Diz o que aconteceu e o que fazer a seguir — nunca o status HTTP, o nome da
 * rota ou a camada que falhou.
 */
export function errorCopy(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Não foi possível concluir a operação.";
  }

  if (error.kind === "timeout") {
    return "A operação demorou mais que o esperado. Tente novamente.";
  }
  if (error.kind === "network") {
    return "Não foi possível conectar. Verifique sua conexão e tente novamente.";
  }
  if (error.kind === "parse") {
    return "A resposta recebida não pôde ser lida. Tente novamente.";
  }

  switch (error.status) {
    case 401:
      return "Sua sessão expirou. Entre novamente.";
    case 403:
      return "Você não tem permissão para realizar esta ação.";
    case 404:
      return "Este item não está mais disponível.";
    case 409:
      /**
       * Conflito é quase sempre uma explicação de negócio — limite atingido,
       * dado alterado por outra pessoa, vínculo existente. A frase do servidor
       * diz qual, e é o que a pessoa precisa saber.
       */
      return looksInternal(error.message)
        ? "Os dados foram alterados. Atualize para continuar."
        : error.message;
    case 400:
    case 422:
      return looksInternal(error.message)
        ? "Alguns dados precisam ser revisados."
        : error.message;
    default:
      break;
  }

  if (error.status >= 500) {
    return "Não foi possível concluir a operação agora. Tente novamente em instantes.";
  }

  return looksInternal(error.message)
    ? "Não foi possível concluir a operação."
    : error.message;
}
