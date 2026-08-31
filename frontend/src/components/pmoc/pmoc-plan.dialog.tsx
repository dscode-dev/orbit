"use client";

/**
 * Criação de uma configuração de PMOC.
 *
 * Só os campos que o `CreatePmocPlanDto` aceita. Cobertura, procedimento e
 * Responsável Técnico entram depois, no detalhe — não por preguiça de tela,
 * mas porque escolher equipamentos exige o contexto de cliente e unidade que
 * este formulário está justamente definindo.
 *
 * A validação aqui é de usabilidade: campo obrigatório vazio, número fora de
 * faixa. As regras do domínio — código único na organização, vigência
 * coerente, unidade no escopo do ator — são do servidor, e a recusa dele é
 * exibida como veio.
 */
import { useState } from "react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { Button } from "@/components/ui/button";
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
import { useCustomersList } from "@/hooks/customers/use-customers";
import { useCreatePmocPlan } from "@/hooks/pmoc/use-pmoc";
import { useActiveScope } from "@/providers/use-active-scope";
import { PmocFrequencyUnit } from "@/types/contracts";

const FREQUENCY_LABELS: Readonly<Record<string, string>> = {
  DAYS: "dia(s)",
  WEEKS: "semana(s)",
  MONTHS: "mês(es)",
  YEARS: "ano(s)",
};

export function PmocPlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { businessUnitId } = useActiveScope();
  const customers = useCustomersList({ limit: 100 });
  const create = useCreatePmocPlan();

  const [customerId, setCustomerId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [amount, setAmount] = useState("6");
  const [unit, setUnit] = useState<string>(PmocFrequencyUnit.MONTHS);

  const ready =
    Boolean(customerId && code.trim() && name.trim() && startsOn) &&
    Number(amount) > 0 &&
    Boolean(businessUnitId);

  const submit = () => {
    if (!ready || !businessUnitId) return;
    create.mutate(
      {
        businessUnitId,
        customerId,
        code: code.trim(),
        name: name.trim(),
        startsOn,
        frequencyAmount: Number(amount),
        frequencyUnit: unit,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo PMOC</DialogTitle>
          <DialogDescription>
            O plano nasce como rascunho. Cobertura e Responsável Técnico são
            definidos no detalhe, antes da ativação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pmoc-customer">Cliente</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger id="pmoc-customer">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {(customers.data?.data ?? []).map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.tradeName ?? customer.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pmoc-code">Código</Label>
              <Input
                id="pmoc-code"
                value={code}
                maxLength={40}
                onChange={(event) => setCode(event.target.value)}
                placeholder="PMOC-2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pmoc-starts">Início da vigência</Label>
              <Input
                id="pmoc-starts"
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pmoc-name">Nome</Label>
            <Input
              id="pmoc-name"
              value={name}
              maxLength={160}
              onChange={(event) => setName(event.target.value)}
              placeholder="Manutenção preventiva — sede administrativa"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pmoc-amount">Periodicidade</Label>
              <Input
                id="pmoc-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pmoc-unit">Unidade</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="pmoc-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(PmocFrequencyUnit).map((value) => (
                    <SelectItem key={value} value={value}>
                      {FREQUENCY_LABELS[value] ?? value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <MutationError error={create.error} />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!ready || create.isPending} onClick={submit}>
            {create.isPending ? "Criando…" : "Criar PMOC"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
