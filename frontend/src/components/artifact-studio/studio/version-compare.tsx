"use client";

/**
 * Comparação entre duas versões.
 *
 * O backend não expõe rota de diferença; a comparação acontece sobre dois
 * payloads imutáveis já recebidos, o que a torna apresentação — e permite
 * cachear indefinidamente cada versão (`staleTime: Infinity`), já que uma
 * versão publicada não muda.
 */
import { useMemo, useState } from "react";
import { ArrowRight, GitCompare } from "lucide-react";

import { PanelError, PanelLoading } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useArtifactTemplateVersion,
  useArtifactTemplateVersions,
} from "@/hooks/artifact-templates/use-artifact-templates";
import {
  compareVersions,
  describeValue,
  type ChangeKind,
  type StructureChange,
} from "@/lib/artifact-studio";
import { cn } from "@/lib/utils";

const KIND_LABELS: Readonly<Record<ChangeKind, string>> = {
  added: "Adicionado",
  removed: "Removido",
  changed: "Alterado",
  moved: "Movido",
};

const KIND_CLASSES: Readonly<Record<ChangeKind, string>> = {
  added: "bg-emerald-500/15 text-emerald-400",
  removed: "bg-destructive/15 text-destructive",
  changed: "bg-amber-500/15 text-amber-400",
  moved: "bg-primary/15 text-primary",
};

const SCOPE_LABELS: Readonly<Record<string, string>> = {
  section: "Seção",
  field: "Campo",
  signature: "Assinatura",
};

export function VersionCompare({
  templateId,
  currentVersion,
}: {
  templateId: string;
  currentVersion: number;
}) {
  const versions = useArtifactTemplateVersions(templateId);
  const available = useMemo(() => versions.data ?? [], [versions.data]);

  const [chosenLeft, setChosenLeft] = useState<number | null>(null);
  const [rightVersion, setRightVersion] = useState<number>(currentVersion);

  /**
   * Padrão útil: a versão imediatamente anterior contra a corrente. É valor
   * derivado, não estado sincronizado — some a necessidade de um efeito para
   * escolher por quem ainda não escolheu.
   */
  const defaultLeft = useMemo(() => {
    const previous = available
      .map((version) => version.version)
      .filter((version) => version < rightVersion)
      .sort((a, b) => b - a);
    return previous[0] ?? null;
  }, [available, rightVersion]);

  const leftVersion = chosenLeft ?? defaultLeft;
  const setLeftVersion = setChosenLeft;

  const left = useArtifactTemplateVersion(templateId, leftVersion);
  const right = useArtifactTemplateVersion(templateId, rightVersion);

  if (versions.isPending) return <PanelLoading rows={4} />;
  if (versions.error) {
    return (
      <PanelError
        error={versions.error}
        onRetry={() => void versions.refetch()}
      />
    );
  }
  if (available.length < 2) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        A comparação precisa de pelo menos duas versões publicadas.
      </p>
    );
  }

  const comparison =
    left.data && right.data ? compareVersions(left.data, right.data) : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <VersionSelect
          id="compare-left"
          label="De"
          value={leftVersion}
          options={available.map((version) => version.version)}
          onChange={setLeftVersion}
        />
        <div className="flex items-end justify-center pb-2">
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <VersionSelect
          id="compare-right"
          label="Para"
          value={rightVersion}
          options={available.map((version) => version.version)}
          onChange={(value) => setRightVersion(value ?? currentVersion)}
        />
      </div>

      {left.isPending || right.isPending ? (
        <PanelLoading rows={4} />
      ) : left.error || right.error ? (
        <PanelError error={left.error ?? right.error} />
      ) : !comparison ? null : comparison.identical ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          As duas versões têm estrutura idêntica.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <GitCompare className="size-4 text-muted-foreground" aria-hidden />
            {(Object.keys(KIND_LABELS) as ChangeKind[])
              .filter((kind) => comparison.summary[kind] > 0)
              .map((kind) => (
                <span
                  key={kind}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-medium",
                    KIND_CLASSES[kind],
                  )}
                >
                  {comparison.summary[kind]} {KIND_LABELS[kind].toLowerCase()}
                </span>
              ))}
          </div>

          <ul className="space-y-2">
            {comparison.changes.map((change, index) => (
              <ChangeRow
                key={`${change.scope}-${change.id}-${index}`}
                change={change}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChangeRow({ change }: { change: StructureChange }) {
  return (
    <li className="rounded-lg border border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium",
            KIND_CLASSES[change.kind],
          )}
        >
          {KIND_LABELS[change.kind]}
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {SCOPE_LABELS[change.scope] ?? change.scope}
        </Badge>
        <span className="text-sm font-medium">{change.path}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {change.id}
        </span>
      </div>

      {change.attributes.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {change.attributes.map((attribute) => (
            <li
              key={attribute.attribute}
              className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
            >
              <span className="min-w-32 font-medium">{attribute.label}</span>
              <span className="line-through opacity-70">
                {describeValue(attribute.from)}
              </span>
              <ArrowRight className="size-3" aria-hidden />
              <span className="text-foreground">
                {describeValue(attribute.to)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function VersionSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  options: readonly number[];
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value === null ? "" : String(value)}
        onValueChange={(next) => onChange(next ? Number(next) : null)}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Escolha uma versão" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>
              Versão {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
