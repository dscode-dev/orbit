"use client";

/**
 * A escolha das unidades que o PMOC atende.
 *
 * "Unidade" aqui é a parte do sistema que recebe manutenção — condensadora,
 * evaporadora, dutos —, não a máquina sob contrato (essa é o `Asset`, escolhido
 * na etapa Equipamentos). É por unidade que o relatório final descreve o
 * serviço, e é o roteiro vinculado a cada uma que diz o que foi feito.
 *
 * Por isso a lista mostra o roteiro de cada unidade junto do nome: marcar uma
 * unidade sem roteiro é legítimo, mas quem marca precisa ver que ela entrará no
 * relatório sem nada a descrever — e não descobrir isso na emissão.
 */

import Link from "next/link";

import { Checkbox } from "@/components/ui/checkbox";
import { usePmocUnits } from "@/hooks/pmoc/use-pmoc";
import type { PmocUnit } from "@/types/pmoc";

export function PmocUnitsField({
  selecionadas,
  onChange,
}: {
  selecionadas: readonly string[];
  onChange: (ids: readonly string[]) => void;
}) {
  const unidades = usePmocUnits();
  const lista = (unidades.data ?? []).filter((unidade) => unidade.isActive);

  const alternar = (id: string) => {
    onChange(
      selecionadas.includes(id)
        ? selecionadas.filter((atual) => atual !== id)
        : [...selecionadas, id],
    );
  };

  if (unidades.isPending) {
    return (
      <p className="text-sm text-muted-foreground">Carregando unidades…</p>
    );
  }

  if (lista.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm font-medium">Nenhuma unidade cadastrada</p>
        <p className="mt-1 text-sm text-muted-foreground">
          As unidades e os roteiros de cada uma são cadastrados uma vez e
          reaproveitados por todos os planos.
        </p>
        <Link
          href="/pmoc/unidades"
          className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Cadastrar unidades
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Unidades atendidas</p>
        <p className="text-sm text-muted-foreground">
          O relatório final descreve o serviço por unidade. Marque as que este
          PMOC atende.
        </p>
      </div>

      {/* Altura limitada: o catálogo cresce, e o diálogo não deve crescer com
          ele até empurrar os botões para fora da tela. */}
      <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
        {lista.map((unidade) => (
          <li key={unidade.id}>
            <label className="flex cursor-pointer items-start gap-3 p-3">
              <Checkbox
                checked={selecionadas.includes(unidade.id)}
                onCheckedChange={() => alternar(unidade.id)}
                aria-label={unidade.name}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {unidade.name}
                </span>
                {unidade.description ? (
                  <span className="block text-xs text-muted-foreground">
                    {unidade.description}
                  </span>
                ) : null}
                <span className="mt-1 block text-xs">
                  {resumoDoRoteiro(unidade)}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        {selecionadas.length === 0
          ? "Sem unidades, o relatório sai com o plano mas sem o detalhamento por unidade."
          : `${selecionadas.length} de ${lista.length} marcada(s).`}
      </p>
    </div>
  );
}

/** O roteiro da unidade, ou o aviso de que ela não tem um. */
function resumoDoRoteiro(unidade: PmocUnit) {
  const roteiro = unidade.checklist;
  if (!roteiro) {
    return (
      <span className="text-amber-600 dark:text-amber-500">
        Sem roteiro — entra no relatório sem itens a descrever
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {`Roteiro: ${roteiro.name} · ${roteiro.items.length} ${
        roteiro.items.length === 1 ? "item" : "itens"
      }`}
    </span>
  );
}
