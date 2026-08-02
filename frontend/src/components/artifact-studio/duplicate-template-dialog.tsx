"use client";

/**
 * Duplicação de template.
 *
 * O backend copia a **versão corrente** do original para a versão 1 de um
 * rascunho novo, sempre com `visibility: ORGANIZATION` e `status: DRAFT`. É
 * também o único caminho para partir de um template global: o `PATCH` e o
 * `POST /versions` recusam o que não pertence à organização.
 *
 * O formulário só existe enquanto o diálogo está aberto. Assim a sugestão
 * inicial de chave e nome vem do inicializador do `useState`, sem efeito que
 * reancore campos — abrir de novo é montar de novo.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

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
import { useDuplicateArtifactTemplate } from "@/hooks/artifact-templates/use-artifact-templates";
import { toTemplateKey } from "@/lib/artifact-studio";
import { ROUTES } from "@/lib/routes";
import { ARTIFACT_LIMITS } from "@/types/artifact-templates";
import { MutationError } from "./mutation-error";

export interface DuplicateTemplateDialogProps {
  templateId: string;
  templateKey: string;
  templateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuplicateTemplateDialog({
  open,
  onOpenChange,
  ...template
}: DuplicateTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <DuplicateForm {...template} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DuplicateForm({
  templateId,
  templateKey,
  templateName,
  onClose,
}: {
  templateId: string;
  templateKey: string;
  templateName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const duplicate = useDuplicateArtifactTemplate(templateId);
  const [key, setKey] = useState(() => toTemplateKey(`${templateKey}_COPIA`));
  const [name, setName] = useState(() => `${templateName} (cópia)`);

  const submit = () => {
    duplicate.mutate(
      { key, name: name.trim() || undefined },
      {
        onSuccess: (created) => {
          onClose();
          router.push(`${ROUTES.artifacts}/${created.id}`);
        },
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Duplicar template</DialogTitle>
        <DialogDescription>
          A cópia nasce como rascunho da sua organização, na versão 1, com a
          estrutura da versão corrente de “{templateName}”.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="duplicate-key">Chave da cópia</Label>
          <Input
            id="duplicate-key"
            value={key}
            onChange={(event) => setKey(toTemplateKey(event.target.value))}
            maxLength={ARTIFACT_LIMITS.keyMaxLength}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duplicate-name">Nome da cópia</Label>
          <Input
            id="duplicate-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={ARTIFACT_LIMITS.nameMaxLength}
          />
        </div>
        <MutationError error={duplicate.error} />
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={submit}
          disabled={
            !ARTIFACT_LIMITS.keyPattern.test(key) || duplicate.isPending
          }
        >
          <Copy className="size-4" />
          {duplicate.isPending ? "Duplicando…" : "Duplicar"}
        </Button>
      </DialogFooter>
    </>
  );
}
