"use client";

/**
 * Unidades de negócio.
 *
 * ## O que o contrato suporta, e o que não
 *
 * | Ação | Endpoint | Situação |
 * | --- | --- | --- |
 * | Listar | `GET /organizations/current/business-units` | ✓ exige `business_units.read` |
 * | Criar | `POST …` | ✓ |
 * | Editar | `PATCH …` | ✓ — mas só os campos de `CreateBusinessUnitDto` |
 * | Ativar/desativar | — | **não existe**: `status` é publicado na leitura e **não** aceito no `PartialType(CreateBusinessUnitDto)` |
 * | Remover | `DELETE …` | ✓ |
 * | Trocar unidade ativa | — | **não existe** no backend; o escopo ativo é local |
 *
 * Ativação e desativação não são oferecidas como botão: a única forma de tirar
 * uma unidade de circulação hoje é removê-la, que é outra coisa. Um botão
 * "desativar" que envia `status` receberia 400 —
 * `property status should not exist`.
 *
 * ## Unidade ativa
 *
 * O backend deriva a organização das claims do token e **não expõe rota para
 * trocar a unidade ativa**. O escopo ativo do frontend (`useActiveScope`) é
 * uma preferência local que entra como filtro (`businessUnitId`) nas consultas
 * que o aceitam — e é assim que ele é apresentado aqui: seleção de contexto de
 * trabalho, não mudança de sessão.
 */
import { Building2, Check, MapPin, Trash2 } from "lucide-react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { PanelFrame, PanelState, toPanelQuery } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useBusinessUnits,
  useRemoveBusinessUnit,
} from "@/hooks/organization/use-organization";
import { useActiveScope } from "@/providers/use-active-scope";
import { cn } from "@/lib/utils";
import type { BusinessUnit } from "@/types/organization";

export function BusinessUnitsSection({ canManage }: { canManage: boolean }) {
  const units = useBusinessUnits();
  const remove = useRemoveBusinessUnit();
  const { businessUnitId, switchBusinessUnit } = useActiveScope();

  return (
    <PanelFrame
      panelId="organization-business-units"
      title="Unidades de negócio"
      description="Filiais, sedes e departamentos da organização"
    >
      <div className="space-y-4">
        <PanelState
          query={toPanelQuery(units)}
          loadingRows={3}
          isEmpty={(data) => data.length === 0}
          emptyMessage="Nenhuma unidade cadastrada."
        >
          {(data) => (
            <ul className="space-y-2">
              {data.map((unit) => (
                <UnitRow
                  key={unit.id}
                  unit={unit}
                  active={unit.id === businessUnitId}
                  canManage={canManage}
                  removing={remove.isPending}
                  onSelect={() => switchBusinessUnit(unit.id)}
                  onRemove={() => remove.mutate(unit.id)}
                />
              ))}
            </ul>
          )}
        </PanelState>

        <MutationError error={remove.error} />

        <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <p>
            <strong>Ativar e desativar não existem no contrato.</strong> O campo{" "}
            <code>status</code> é publicado na leitura, mas
            <code> UpdateBusinessUnitDto</code> não o aceita — enviá-lo devolve
            400.
          </p>
          <p>
            <strong>Trocar a unidade ativa é local.</strong> O backend deriva o
            escopo das claims do token e não expõe rota de troca; a seleção
            acima muda o filtro <code>businessUnitId</code> das consultas que o
            aceitam, não a sessão.
          </p>
        </div>
      </div>
    </PanelFrame>
  );
}

function UnitRow({
  unit,
  active,
  canManage,
  removing,
  onSelect,
  onRemove,
}: {
  unit: BusinessUnit;
  active: boolean;
  canManage: boolean;
  removing: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2",
        active ? "border-primary/60 bg-primary/5" : "border-border",
      )}
    >
      <Building2
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {unit.tradeName ?? unit.legalName}
          {unit.isPrimary ? (
            <Badge variant="secondary" className="text-[10px]">
              principal
            </Badge>
          ) : null}
          <Badge variant="outline" className="text-[10px]">
            {unit.type}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {unit.status}
          </Badge>
        </p>
        <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" aria-hidden />
          {unit.city}
          {unit.stateCode ? `/${unit.stateCode}` : ""} · {unit.timezone} ·{" "}
          {unit.currency}
          <span className="font-mono">{unit.documentNumber}</span>
        </p>
      </div>

      <Button
        size="sm"
        variant={active ? "default" : "outline"}
        onClick={onSelect}
        disabled={active}
      >
        {active ? <Check className="size-3.5" /> : null}
        {active ? "Contexto atual" : "Trabalhar nesta"}
      </Button>

      {canManage && !unit.isPrimary ? (
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-destructive"
          disabled={removing}
          onClick={onRemove}
          aria-label={`Remover ${unit.tradeName ?? unit.legalName}`}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </li>
  );
}
