"use client";

/**
 * Query Layer do Automation Engine.
 *
 * ## Nenhum optimistic update
 *
 * Toda escrita aqui pode ser recusada por regra do servidor: gatilho fora do
 * catálogo, campo que o gatilho não oferece, destinatário que não é membro,
 * fila não permitida, exclusão com ação agendada (**409**). Antecipar o novo
 * estado mostraria uma regra que o backend não aceitou — e uma automação que
 * parece configurada e não existe é o pior desfecho possível: ninguém volta
 * para conferir uma coisa que "deu certo".
 *
 * O interruptor de ligar/desligar é o caso mais tentador, e o mais perigoso:
 * ele muda **se a regra vale**. Só vira depois da confirmação.
 *
 * ## Cadência
 *
 * O catálogo é `CACHE.catalog` — muda quando o backend ganha um gatilho novo,
 * não durante a sessão. As execuções são `CACHE.live`: a ação agendada executa
 * sozinha, e é a única coisa nesta tela que muda sem ninguém clicar.
 */
import { useQueryClient } from "@tanstack/react-query";

import { CACHE } from "@/hooks/api/cache-policy";
import { useApiMutation } from "@/hooks/api/use-api-mutation";
import { useApiQuery } from "@/hooks/api/use-api-query";
import { automationsService } from "@/services/automations.service";
import type {
  AutomationExecutionQuery,
  AutomationRuleQuery,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from "@/types/automations";

export const AUTOMATION_REFRESH = {
  /** Gatilhos e ações mudam com o backend, não com o uso. */
  catalog: CACHE.catalog,
  rules: CACHE.stable,
  /** O prazo chega sozinho: a execução muda sem ninguém tocar na tela. */
  executions: CACHE.live,
} as const;

/* ------------------------------------------------------------------ */
/* Leituras                                                            */
/* ------------------------------------------------------------------ */

/**
 * O catálogo publicado pelo servidor.
 *
 * `enabled` existe para a tela não perguntar quando a sessão não tem
 * `automations.read` — a resposta seria 403, e um erro no lugar de uma
 * explicação.
 */
export function useAutomationCatalog(enabled = true) {
  return useApiQuery(
    automationsService.keys.catalog(),
    ({ signal }) => automationsService.catalog({ signal }),
    { ...AUTOMATION_REFRESH.catalog, enabled },
  );
}

export function useAutomationRules(query?: AutomationRuleQuery, enabled = true) {
  return useApiQuery(
    automationsService.keys.list(query),
    ({ signal }) => automationsService.list(query, { signal }),
    { ...AUTOMATION_REFRESH.rules, enabled },
  );
}

export function useAutomationRule(id: string | null) {
  return useApiQuery(
    automationsService.keys.detail(id ?? "none"),
    ({ signal }) => automationsService.get(id as string, { signal }),
    { ...AUTOMATION_REFRESH.rules, enabled: Boolean(id) },
  );
}

export function useAutomationExecutions(
  query?: AutomationExecutionQuery,
  enabled = true,
) {
  return useApiQuery(
    automationsService.keys.executions(query),
    ({ signal }) => automationsService.executions(query, { signal }),
    { ...AUTOMATION_REFRESH.executions, enabled },
  );
}

/* ------------------------------------------------------------------ */
/* Escritas                                                            */
/* ------------------------------------------------------------------ */

/**
 * O que muda quando uma regra muda.
 *
 * Tudo o que veio de `/automations`: a listagem, o detalhe e o histórico —
 * uma regra excluída ou renomeada aparece no histórico das execuções dela.
 *
 * `onError` **também** invalida, e por um motivo concreto: 409 e 404 aqui
 * significam que a tela está velha — a regra ganhou uma pendência, foi
 * desligada ou removida por outra pessoa desde que esta lista carregou.
 * Insistir no que está na tela faria a mensagem de erro parecer inexplicável.
 */
function useAutomationWrite(scopeId: string) {
  const queryClient = useQueryClient();

  const revalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: automationsService.keys.all(),
    });
  };

  return {
    onSuccess: revalidate,
    onError: revalidate,
    /** Dois cliques no mesmo botão não viram duas regras. */
    scope: { id: scopeId },
  };
}

export function useCreateAutomationRule() {
  const write = useAutomationWrite("automation-write");
  return useApiMutation(
    (input: CreateAutomationRuleInput) => automationsService.create(input),
    write,
  );
}

export function useUpdateAutomationRule(id: string) {
  const write = useAutomationWrite("automation-write");
  return useApiMutation(
    (input: UpdateAutomationRuleInput) => automationsService.update(id, input),
    write,
  );
}

/**
 * Ligar e desligar.
 *
 * Desligar **não cancela** o que já está agendado — o backend confere
 * `enabled` na hora de executar e descarta a ação com o motivo. A tela diz
 * isso; o hook só transporta.
 */
export function useToggleAutomationRule() {
  const write = useAutomationWrite("automation-toggle");
  return useApiMutation(
    ({ id, enabled }: { id: string; enabled: boolean }) =>
      automationsService.toggle(id, enabled),
    write,
  );
}

export function useDuplicateAutomationRule() {
  const write = useAutomationWrite("automation-write");
  return useApiMutation(
    (id: string) => automationsService.duplicate(id),
    write,
  );
}

export function useDeleteAutomationRule() {
  const write = useAutomationWrite("automation-write");
  return useApiMutation((id: string) => automationsService.remove(id), write);
}
