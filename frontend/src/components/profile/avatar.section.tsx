"use client";

/**
 * Foto de perfil.
 *
 * ## Sem foto não é erro
 *
 * A ausência mostra as **iniciais**, que é o que a plataforma já usa em toda
 * lista. Nenhuma imagem genérica de pessoa: um avatar padrão de silhueta diz
 * menos do que duas letras e ainda parece um lugar por preencher.
 *
 * ## A validação que vale é a do servidor
 *
 * O `accept` do campo e a conferência de tamanho aqui existem para dar
 * resposta rápida ao erro comum. Quem recusa de verdade é o backend, que relê
 * os bytes gravados e confere assinatura de formato e hash — e é por isso que
 * a mensagem de recusa dele é exibida como veio.
 */
import { useRef, useState } from "react";
import { Trash2, Upload, UserRound } from "lucide-react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { PanelFrame, PanelState, toPanelQuery } from "@/components/panels";
import { Button } from "@/components/ui/button";
import {
  useAvatar,
  useRemoveAvatar,
  useUploadAvatar,
} from "@/hooks/profile/use-me-media";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/services/me-media.service";

export function AvatarSection({ initials }: { initials: string }) {
  const query = useAvatar();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const input = useRef<HTMLInputElement | null>(null);
  const [recusa, setRecusa] = useState<string | null>(null);

  const escolher = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    /** O campo é zerado sempre: escolher o mesmo arquivo de novo deve disparar. */
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as never)) {
      setRecusa("Escolha uma imagem PNG, JPEG ou WEBP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setRecusa("A imagem deve ter no máximo 2 MB.");
      return;
    }
    setRecusa(null);
    upload.mutate(file);
  };

  return (
    <PanelFrame
      panelId="profile-avatar"
      title="Foto"
      description="Aparece no topo da plataforma e nas listas da equipe"
    >
      <PanelState query={toPanelQuery(query)} loadingRows={2}>
        {(avatar) => (
          <div className="flex flex-wrap items-center gap-5">
            <div
              className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted"
              data-testid="profile-avatar-preview"
            >
              {avatar.available && avatar.url ? (
                /*
                 * `<img>`, e não `next/image`: o endereço é assinado e expira,
                 * então não há o que otimizar num CDN — e o otimizador
                 * guardaria uma cópia de uma URL temporária.
                 */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar.url}
                  alt="Sua foto de perfil"
                  className="size-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="font-display text-xl font-semibold text-muted-foreground"
                >
                  {initials || <UserRound className="size-7" />}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={upload.isPending || remove.isPending}
                  onClick={() => input.current?.click()}
                >
                  <Upload className="size-4" aria-hidden />
                  {avatar.available ? "Trocar foto" : "Enviar foto"}
                </Button>

                {avatar.available ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={upload.isPending || remove.isPending}
                    onClick={() => remove.mutate()}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Remover
                  </Button>
                ) : null}
              </div>

              <p className="text-xs text-muted-foreground">
                PNG, JPEG ou WEBP, até 2 MB. Sem foto, aparecem suas iniciais.
              </p>

              {recusa ? (
                <p role="alert" className="text-xs text-destructive">
                  {recusa}
                </p>
              ) : null}
              <MutationError error={upload.error} />
              <MutationError error={remove.error} />
            </div>

            <input
              ref={input}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="sr-only"
              aria-label="Escolher foto de perfil"
              onChange={escolher}
            />
          </div>
        )}
      </PanelState>
    </PanelFrame>
  );
}
