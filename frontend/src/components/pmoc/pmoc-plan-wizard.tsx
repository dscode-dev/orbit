"use client";

/**
 * Criação de um PMOC, em cinco etapas.
 *
 * ## Por que deixou de ser um formulário plano
 *
 * A versão anterior pedia código, nome, datas e periodicidade numa tela só, e
 * mandava escolher os equipamentos **depois**, no detalhe. O resultado está no
 * banco: setenta e cinco planos ativos sem equipamento nenhum — planos que
 * têm execução, aparecem na lista e não mandam ninguém a lugar nenhum, porque
 * sem equipamento não há execução para projetar.
 *
 * A ordem aqui não é estética. O cliente vem primeiro porque tudo depende
 * dele: o código sugerido, quais equipamentos existem, e a validação de posse
 * que o servidor refaz no fim.
 *
 * ## O que esta tela **não** decide
 *
 * Nem a sequência do código, nem quantas execuções vão existir, nem quais
 * equipamentos são elegíveis. Tudo isso vem do servidor — a etapa de revisão
 * mostra a matriz que o `POST /pmoc/plans/preview` devolveu, não uma
 * multiplicação feita aqui. Uma vigência que começa dia 31 tem regra de
 * calendário, e ela mora no domínio e no banco; uma terceira cópia em
 * JavaScript de formulário divergiria na primeira virada de mês.
 */
import { useMemo, useState } from "react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssetsList } from "@/hooks/assets/use-assets";
import { useCustomersList } from "@/hooks/customers/use-customers";
import {
  useCreatePmocPlan,
  usePmocCodeSuggestion,
  usePmocPreview,
  usePmocPlanNameOptions,
} from "@/hooks/pmoc/use-pmoc";
import { useFieldTechnicians } from "@/hooks/workforce/use-workforce";
import { useActiveScope } from "@/providers/use-active-scope";
import type { Asset, AssetQuery } from "@/types/assets";
import { PmocFrequencyUnit } from "@/types/contracts";
import type { PmocPreview } from "@/types/pmoc";
import { Package } from "lucide-react";

import { ListState, Pagination, SearchField, useListController } from "@/workspace";

const FREQUENCY_LABELS: Readonly<Record<string, string>> = {
  DAYS: "dia(s)",
  WEEKS: "semana(s)",
  MONTHS: "mês(es)",
  YEARS: "ano(s)",
};

/** `Select` não aceita item de valor vazio; este é o "ninguém ainda". */
const SEM_TECNICO = "__none__";

/** A saída do catálogo: quem escolhe isto digita o próprio nome. */
const NOME_OUTROS = "__outros__";

const ETAPAS = [
  "Cliente",
  "Equipamentos",
  "Programação",
  "Responsáveis",
  "Revisão",
] as const;

export function PmocPlanWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { businessUnitId } = useActiveScope();
  const customers = useCustomersList({ limit: 100 });
  const tecnicos = useFieldTechnicians();
  const nomeOpcoes = usePmocPlanNameOptions();

  /** O que está marcado no seletor — um rótulo do catálogo, ou "Outros". */
  const [nomeEscolhido, setNomeEscolhido] = useState("");
  const create = useCreatePmocPlan();
  const preview = usePmocPreview();

  const [etapa, setEtapa] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [code, setCode] = useState("");

  /**
   * O usuário mexeu no código?
   *
   * Só para a UX do §121/§122: enquanto ele não mexeu, trocar o cliente
   * recalcula o campo. Depois que mexeu, não sobrescrevemos o que ele
   * escreveu — o campo é dele.
   */
  const [codigoEditado, setCodigoEditado] = useState(false);

  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [vigenciaAmount, setVigenciaAmount] = useState("12");
  const [vigenciaUnit, setVigenciaUnit] = useState<string>(
    PmocFrequencyUnit.MONTHS,
  );
  const [frequenciaAmount, setFrequenciaAmount] = useState("1");
  const [frequenciaUnit, setFrequenciaUnit] = useState<string>(
    PmocFrequencyUnit.MONTHS,
  );
  const [tecnicoId, setTecnicoId] = useState("");
  const [selecionados, setSelecionados] = useState<readonly Asset[]>([]);

  const sugestao = usePmocCodeSuggestion(customerId || null);

  /**
   * O código exibido é **derivado**, não sincronizado.
   *
   * A primeira versão empurrava a sugestão para o estado dentro de um efeito.
   * Funcionava e estava errado: o campo passava a ter duas fontes de verdade —
   * o que o servidor sugeriu e o que o estado guardou — e elas divergiam por
   * um render a cada troca de cliente. Derivando, existe uma só: enquanto o
   * usuário não digitou, o campo **é** a sugestão.
   */
  const codigoExibido = codigoEditado
    ? code
    : (sugestao.data?.suggestedCode ?? "");

  /**
   * Trocar de cliente limpa a seleção — no evento, não num efeito.
   *
   * Os ids que sobrariam são de equipamentos de outro cliente, e o servidor
   * recusaria a criação inteira no fim do wizard, depois de a pessoa ter
   * percorrido cinco etapas.
   */
  const trocarCliente = (proximo: string) => {
    if (proximo === customerId) return;
    setCustomerId(proximo);
    setSelecionados([]);
    if (!codigoEditado) setCode("");
  };

  const assetsController = useListController<AssetQuery>({
    limit: 8,
    initial: { customerId, businessUnitId: businessUnitId ?? undefined },
  });

  /**
   * Cliente e unidade sobrescrevem o que o controlador guardou.
   *
   * O controlador nasce com o cliente da primeira renderização; trocar de
   * cliente na etapa 1 precisa alcançar a consulta, senão a lista continuaria
   * mostrando os equipamentos do cliente anterior.
   */
  const assetsQuery = useMemo(
    () => ({
      ...assetsController.query,
      customerId,
      businessUnitId: businessUnitId ?? undefined,
    }),
    [assetsController.query, customerId, businessUnitId],
  );
  const assets = useAssetsList(assetsQuery);

  const selecionadoIds = useMemo(
    () => new Set(selecionados.map((asset) => asset.id)),
    [selecionados],
  );

  /**
   * A seleção sobrevive à paginação e à busca.
   *
   * Guardamos o objeto inteiro, e não só o id: a revisão precisa do nome, e na
   * página três o equipamento da página um já não está na resposta.
   */
  const alternar = (asset: Asset, marcado: boolean) => {
    setSelecionados((atual) =>
      marcado
        ? atual.some((item) => item.id === asset.id)
          ? atual
          : [...atual, asset]
        : atual.filter((item) => item.id !== asset.id),
    );
  };

  const pagina = assets.data?.data ?? [];
  const paginaInteiraMarcada =
    pagina.length > 0 && pagina.every((asset) => selecionadoIds.has(asset.id));

  const cliente = (customers.data?.data ?? []).find(
    (item) => item.id === customerId,
  );

  const entradaDoPreview = useMemo(
    () => ({
      businessUnitId: businessUnitId ?? "",
      customerId,
      startsOn,
      coverageAmount: Number(vigenciaAmount) || 0,
      coverageUnit: vigenciaUnit,
      frequencyAmount: Number(frequenciaAmount) || 0,
      frequencyUnit: frequenciaUnit,
      assetIds: selecionados.map((asset) => asset.id),
    }),
    [
      businessUnitId,
      customerId,
      startsOn,
      vigenciaAmount,
      vigenciaUnit,
      frequenciaAmount,
      frequenciaUnit,
      selecionados,
    ],
  );

  /**
   * A projeção é pedida ao entrar na revisão, e não a cada tecla.
   *
   * Recalcular a cada dígito da data mandaria uma requisição por caractere, e
   * as respostas chegariam fora de ordem — a tela mostraria a projeção de uma
   * data que o usuário já terminou de apagar.
   */
  const [projecao, setProjecao] = useState<PmocPreview | null>(null);
  const projetar = () => {
    if (!businessUnitId || !customerId) return;
    preview.mutate(entradaDoPreview, { onSuccess: setProjecao });
  };

  const podeAvancar = [
    Boolean(customerId && name.trim()),
    selecionados.length > 0,
    Boolean(startsOn) &&
      Number(vigenciaAmount) > 0 &&
      Number(frequenciaAmount) > 0,
    true,
    Boolean(projecao),
  ][etapa];

  const avancar = () => {
    if (!podeAvancar) return;
    if (etapa === 3) projetar();
    setEtapa((atual) => Math.min(atual + 1, ETAPAS.length - 1));
  };

  const fechar = () => {
    setEtapa(0);
    setProjecao(null);
    onOpenChange(false);
  };

  /** Só a última etapa cria. Avançar de etapa nunca escreve nada. */
  const criar = () => {
    if (!businessUnitId || !projecao) return;
    create.mutate(
      {
        businessUnitId,
        customerId,
        /**
         * Código só vai quando o usuário mexeu. Mandar o sugerido de volta
         * seria uma corrida perdida: duas telas abertas leem o mesmo `003` e
         * a segunda falharia ao salvar. Omitindo, o servidor aloca o próximo
         * dentro da própria transação.
         */
        ...(codigoEditado && code.trim() ? { code: code.trim() } : {}),
        name: name.trim(),
        startsOn,
        endsOn: projecao.endsOn ?? undefined,
        frequencyAmount: Number(frequenciaAmount),
        frequencyUnit: frequenciaUnit,
        ...(tecnicoId ? { technicianUserId: tecnicoId } : {}),
        assetIds: selecionados.map((asset) => asset.id),
      },
      { onSuccess: fechar },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : fechar())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo PMOC</DialogTitle>
          <DialogDescription>
            {`Etapa ${etapa + 1} de ${ETAPAS.length} — ${ETAPAS[etapa]}`}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap gap-2" aria-label="Etapas">
          {ETAPAS.map((rotulo, indice) => (
            <li
              key={rotulo}
              aria-current={indice === etapa ? "step" : undefined}
              className={
                indice === etapa
                  ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                  : indice < etapa
                    ? "rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                    : "rounded-full px-3 py-1 text-xs text-muted-foreground"
              }
            >
              {rotulo}
            </li>
          ))}
        </ol>

        <div className="min-h-[18rem] space-y-4 py-2">
          {etapa === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pmoc-customer">Cliente</Label>
                <Select value={customerId} onValueChange={trocarCliente}>
                  <SelectTrigger id="pmoc-customer">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {(customers.data?.data ?? []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.tradeName ?? item.legalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pmoc-code">Código</Label>
                <Input
                  id="pmoc-code"
                  value={codigoExibido}
                  maxLength={60}
                  placeholder={
                    sugestao.isPending && customerId
                      ? "Gerando sugestão…"
                      : "Selecione o cliente"
                  }
                  onChange={(event) => {
                    setCode(event.target.value);
                    setCodigoEditado(true);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {codigoEditado
                    ? "Código próprio. Avisamos se ele já estiver em uso."
                    : "Sugerido automaticamente. Você pode editar."}
                </p>
              </div>

              {/*
                O nome vem de um catálogo, com saída para o que não está nele.

                Era campo livre, e cada plano nascia com uma grafia diferente
                do mesmo serviço — "Manutenção preventiva", "Preventiva",
                "MANUT. PREV." —, o que torna a lista de planos impossível de
                ler e o relatório inconsistente. O catálogo é da plataforma;
                "Outros" continua permitindo qualquer nome.
              */}
              <div className="space-y-2">
                <Label htmlFor="pmoc-name-option">Nome</Label>
                <Select
                  value={nomeEscolhido}
                  onValueChange={(valor) => {
                    setNomeEscolhido(valor);
                    /// Escolher da lista grava o rótulo; "Outros" limpa o
                    /// campo para quem vai digitar.
                    setName(valor === NOME_OUTROS ? "" : valor);
                  }}
                >
                  <SelectTrigger id="pmoc-name-option">
                    <SelectValue placeholder="Selecione o tipo de plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {(nomeOpcoes.data ?? []).map((opcao) => (
                      <SelectItem key={opcao.key} value={opcao.label}>
                        {opcao.label}
                      </SelectItem>
                    ))}
                    <SelectItem value={NOME_OUTROS}>Outros…</SelectItem>
                  </SelectContent>
                </Select>

                {nomeEscolhido === NOME_OUTROS ? (
                  <Input
                    id="pmoc-name"
                    value={name}
                    maxLength={160}
                    autoFocus
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Como este plano se chama"
                  />
                ) : null}
              </div>
            </>
          )}

          {etapa === 1 && (
            <>
              {/*
                A busca ocupa a linha inteira.

                Dividindo espaço com a contagem, ela ficava com pouco mais de
                um terço da largura do diálogo — estreita demais para o que se
                digita nela (nome, identificação, série ou fabricante). A
                contagem é curta e cabe embaixo.
              */}
              <div className="space-y-2">
                <SearchField
                  id="pmoc-wizard-equipment-search"
                  className="w-full"
                  value={assetsController.searchTerm}
                  onChange={assetsController.setSearchTerm}
                  label="Buscar"
                  placeholder="Nome, identificação, série ou fabricante"
                />
                <p className="text-sm text-muted-foreground">
                  {selecionados.length} selecionado
                  {selecionados.length === 1 ? "" : "s"}
                </p>
              </div>

              <ListState
                isPending={assets.isPending}
                error={assets.error}
                onRetry={() => void assets.refetch()}
                items={pagina}
                rows={4}
                empty={{
                  icon: <Package className="size-5" />,
                  title: "Nenhum equipamento para este cliente",
                  description:
                    "Cadastre o equipamento no cliente, ou ajuste a busca.",
                }}
              >
                {(linhas) => (
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  <label className="flex items-center gap-3 border-b px-1 py-2 text-sm font-medium">
                    <Checkbox
                      checked={paginaInteiraMarcada}
                      onCheckedChange={(valor) => {
                        for (const asset of pagina) {
                          alternar(asset, valor === true);
                        }
                      }}
                      aria-label="Selecionar todos desta página"
                    />
                    Selecionar todos desta página
                  </label>

                  {linhas.map((asset) => (
                    <label
                      key={asset.id}
                      className="flex items-start gap-3 rounded-md px-1 py-2 text-sm hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={selecionadoIds.has(asset.id)}
                        onCheckedChange={(valor) =>
                          alternar(asset, valor === true)
                        }
                        aria-label={asset.name}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {asset.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[asset.manufacturer, asset.model, asset.location]
                            .filter(Boolean)
                            .join(" · ") || "Sem detalhes cadastrados"}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                )}
              </ListState>

              <Pagination
                meta={assets.data?.meta}
                onPrevious={assetsController.previousPage}
                onNext={assetsController.nextPage}
                isFetching={assets.isFetching}
              />
            </>
          )}

          {etapa === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pmoc-starts">Data inicial</Label>
                <Input
                  id="pmoc-starts"
                  type="date"
                  value={startsOn}
                  onChange={(event) => setStartsOn(event.target.value)}
                />
              </div>

              <fieldset className="space-y-2 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">Vigência</legend>
                <p className="text-xs text-muted-foreground">
                  Por quanto tempo o contrato vale.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    id="pmoc-vigencia"
                    type="number"
                    min={1}
                    value={vigenciaAmount}
                    aria-label="Duração da vigência"
                    onChange={(event) => setVigenciaAmount(event.target.value)}
                  />
                  <Select value={vigenciaUnit} onValueChange={setVigenciaUnit}>
                    <SelectTrigger aria-label="Unidade da vigência">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(PmocFrequencyUnit).map((valor) => (
                        <SelectItem key={valor} value={valor}>
                          {FREQUENCY_LABELS[valor] ?? valor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </fieldset>

              <fieldset className="space-y-2 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">
                  Frequência de atendimento
                </legend>
                <p className="text-xs text-muted-foreground">
                  De quanto em quanto tempo a equipe vai ao local.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    id="pmoc-frequencia"
                    type="number"
                    min={1}
                    value={frequenciaAmount}
                    aria-label="Intervalo entre atendimentos"
                    onChange={(event) =>
                      setFrequenciaAmount(event.target.value)
                    }
                  />
                  <Select
                    value={frequenciaUnit}
                    onValueChange={setFrequenciaUnit}
                  >
                    <SelectTrigger aria-label="Unidade da frequência">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(PmocFrequencyUnit).map((valor) => (
                        <SelectItem key={valor} value={valor}>
                          {FREQUENCY_LABELS[valor] ?? valor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </fieldset>
            </>
          )}

          {etapa === 3 && (
            <div className="space-y-2">
              <Label htmlFor="pmoc-tecnico">Responsável operacional</Label>
              {/*
                Seletor, e não campo livre.

                O campo pedia o **id** do técnico e ninguém o tem de cabeça:
                era um `Input` de texto onde se esperava um UUID. Quem
                preenchesse errado só descobriria na recusa do servidor.
              */}
              <Select
                value={tecnicoId || SEM_TECNICO}
                onValueChange={(valor) =>
                  setTecnicoId(valor === SEM_TECNICO ? "" : valor)
                }
              >
                <SelectTrigger id="pmoc-tecnico">
                  <SelectValue placeholder="Definir depois" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_TECNICO}>Definir depois</SelectItem>
                  {(tecnicos.data ?? []).map((pessoa) => (
                    <SelectItem key={pessoa.id} value={pessoa.id}>
                      {pessoa.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O Responsável Técnico profissional é definido no detalhe do
                plano, antes da ativação.
              </p>
            </div>
          )}

          {etapa === 4 && (
            <RevisaoDoPlano
              carregando={preview.isPending}
              projecao={projecao}
              clienteNome={cliente?.tradeName ?? cliente?.legalName ?? ""}
              codigo={codigoEditado ? code.trim() : codigoExibido}
              codigoEditado={codigoEditado}
            />
          )}
        </div>

        <MutationError error={create.error ?? preview.error} />

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() =>
              etapa === 0 ? fechar() : setEtapa((atual) => atual - 1)
            }
          >
            {etapa === 0 ? "Cancelar" : "Voltar"}
          </Button>

          {etapa < ETAPAS.length - 1 ? (
            <Button disabled={!podeAvancar} onClick={avancar}>
              Continuar
            </Button>
          ) : (
            <Button
              disabled={!projecao || create.isPending}
              onClick={criar}
            >
              {create.isPending ? "Criando…" : "Criar PMOC"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A revisão — e a matriz que o servidor projetou.
 *
 * Em telas estreitas a matriz é uma lista, não uma tabela horizontal: doze
 * colunas de números em 375 pixels não se lê, e rolagem lateral dentro de um
 * diálogo é a pior forma de esconder informação.
 */
function RevisaoDoPlano({
  carregando,
  projecao,
  clienteNome,
  codigo,
  codigoEditado,
}: {
  carregando: boolean;
  projecao: PmocPreview | null;
  clienteNome: string;
  codigo: string;
  codigoEditado: boolean;
}) {
  if (carregando) {
    return (
      <p className="text-sm text-muted-foreground">Calculando a programação…</p>
    );
  }
  if (!projecao) {
    return (
      <p className="text-sm text-muted-foreground">
        Volte uma etapa e confirme a programação para ver a projeção.
      </p>
    );
  }

  const linhas: readonly [string, string][] = [
    ["Cliente", clienteNome],
    ["Código", codigoEditado ? codigo : `${codigo} (gerado ao salvar)`],
    [
      "Vigência",
      `${projecao.startsOn} a ${projecao.endsOn ?? "sem prazo final"}`,
    ],
    ["Frequência", projecao.frequency.label],
    ["Equipamentos", String(projecao.equipmentCount)],
    ["Execuções", String(projecao.cycleCount)],
    ["Execuções previstas", String(projecao.projectedExecutions)],
  ];

  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex justify-between gap-3 border-b py-1">
            <dt className="text-sm text-muted-foreground">{rotulo}</dt>
            <dd className="text-sm font-medium tabular-nums">{valor}</dd>
          </div>
        ))}
      </dl>

      {projecao.truncated && (
        <p className="text-xs text-muted-foreground">
          A vigência é aberta; a projeção mostra as primeiras execuções.
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Execuções por equipamento</h3>
        <ul className="space-y-2">
          {projecao.matrix.map((linha) => (
            <li key={linha.equipment.id} className="rounded-md border p-3">
              <p className="truncate text-sm font-medium">
                {linha.equipment.name}
              </p>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {linha.executions
                  .map((execucao) => execucao.executionNumber)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
