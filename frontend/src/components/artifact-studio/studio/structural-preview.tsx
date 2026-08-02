"use client";

/**
 * Preview estrutural.
 *
 * Mostra a **forma** do artefato: seções na ordem, campos na ordem, o que é
 * obrigatório, o que está oculto, quais assinaturas existem.
 *
 * O que ele deliberadamente **não** faz é simular o preenchimento. O tipo do
 * campo é metadado que, nas palavras do DTO, "the engine does not interpret" —
 * quem decide que `LOCATION` vira mapa e `QR_CODE` vira leitor é o executor do
 * artefato, e cada um pode decidir diferente. Desenhar um controle de mentira
 * aqui prometeria um comportamento que o Studio não conhece e não controla.
 *
 * O preview lê a árvore em edição, não a versão salva: é o retrato do que será
 * publicado.
 */
import { EyeOff, PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  nodeLabel,
  type StudioDocument,
  type StudioFieldNode,
  type StudioNode,
} from "@/lib/artifact-studio";
import { cn } from "@/lib/utils";

export function StructuralPreview({ document }: { document: StudioDocument }) {
  const sections = document.structure.children;
  const signatures = document.signatures.children;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Retrato da estrutura em edição. Não simula o preenchimento — a
        interpretação de cada tipo pertence a quem executa o artefato.
      </p>

      {sections.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          Nenhuma seção na estrutura.
        </p>
      ) : (
        <ol className="space-y-4">
          {sections.map((section, index) => (
            <PreviewNode
              key={section.nodeId}
              node={section}
              index={index + 1}
            />
          ))}
        </ol>
      )}

      {signatures.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <PenLine className="size-4 text-muted-foreground" aria-hidden />
            Assinaturas
          </h3>
          <ul className="space-y-2">
            {signatures.map((slot) => (
              <li
                key={slot.nodeId}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3"
              >
                <span className="text-sm font-medium">{nodeLabel(slot)}</span>
                {slot.kind === "signature" ? (
                  <>
                    <Badge variant="secondary" className="text-[10px]">
                      {slot.signerRole}
                    </Badge>
                    {slot.required ? (
                      <span className="text-xs text-destructive">
                        obrigatória
                      </span>
                    ) : null}
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PreviewNode({ node, index }: { node: StudioNode; index: number }) {
  if (node.kind === "field") return <PreviewField node={node} />;
  if (node.kind === "root") return null;

  const collapsible = node.kind === "section" && node.collapsible;
  const hidden = node.kind === "section" && node.visibility !== "VISIBLE";

  return (
    <li
      className={cn(
        "rounded-xl border border-border p-4",
        hidden && "opacity-60",
      )}
    >
      <header className="space-y-1 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{index}.</span>
          <h3 className="text-sm font-semibold">{nodeLabel(node)}</h3>
          {node.kind === "section" ? (
            <>
              <Badge variant="secondary" className="text-[10px]">
                {node.type}
              </Badge>
              {node.required ? (
                <span className="text-xs text-destructive">obrigatória</span>
              ) : null}
              {collapsible ? (
                <span className="text-xs text-muted-foreground">
                  recolhível
                </span>
              ) : null}
              {hidden ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <EyeOff className="size-3" aria-hidden />
                  {node.visibility}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        {node.kind === "section" && node.description ? (
          <p className="text-xs text-muted-foreground">{node.description}</p>
        ) : null}
      </header>

      {node.children.length === 0 ? (
        <p className="pt-3 text-xs text-muted-foreground">Seção sem campos.</p>
      ) : (
        <ul className="space-y-2 pt-3">
          {node.children.map((child) => (
            <PreviewNode key={child.nodeId} node={child} index={0} />
          ))}
        </ul>
      )}
    </li>
  );
}

function PreviewField({ node }: { node: StudioFieldNode }) {
  return (
    <li
      className={cn(
        "rounded-lg border border-dashed border-border px-3 py-2",
        node.hidden && "opacity-50",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">{node.label}</span>
        {node.required ? (
          <span className="text-destructive" aria-label="obrigatório">
            *
          </span>
        ) : null}
        <Badge variant="secondary" className="text-[10px]">
          {node.type}
        </Badge>
        {node.unit ? (
          <span className="text-xs text-muted-foreground">({node.unit})</span>
        ) : null}
        {node.readOnly ? (
          <span className="text-xs text-muted-foreground">somente leitura</span>
        ) : null}
        {node.hidden ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <EyeOff className="size-3" aria-hidden />
            oculto
          </span>
        ) : null}
      </div>
      {node.description ? (
        <p className="mt-1 text-xs text-muted-foreground">{node.description}</p>
      ) : null}
      {node.placeholder ? (
        <p className="mt-1 font-mono text-xs text-muted-foreground/70">
          {node.placeholder}
        </p>
      ) : null}
      {node.validations.length > 0 || node.dependencies.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {node.validations.length} validação(ões) · {node.dependencies.length}{" "}
          dependência(s)
        </p>
      ) : null}
    </li>
  );
}
