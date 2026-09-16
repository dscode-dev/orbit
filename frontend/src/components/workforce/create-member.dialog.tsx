"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, UserPlus } from "lucide-react";

import { MutationError } from "@/components/artifact-studio/mutation-error";
import { MemberAccessEditor } from "@/components/workforce/member-access-editor";
import { Badge } from "@/components/ui/badge";
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
import { useBusinessUnits } from "@/hooks/organization/use-organization";
import {
  useAccessCatalog,
  useCreateTeamMember,
  useTeamRoles,
} from "@/hooks/workforce/use-workforce";
import type { CreatedTeamMember } from "@/types/workforce";

const STEPS = ["Dados", "Papel", "Acessos", "Revisão"] as const;

export function CreateMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <Body onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function Body({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const create = useCreateTeamMember();
  const roles = useTeamRoles();
  const units = useBusinessUnits();
  const catalog = useAccessCatalog();

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [businessUnitIds, setBusinessUnitIds] = useState<string[] | null>(null);
  const [useRoleDefaults, setUseRoleDefaults] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [allowedSurfaces, setAllowedSurfaces] = useState<string[]>([]);
  const [created, setCreated] = useState<CreatedTeamMember | null>(null);

  const role = (roles.data ?? []).find((item) => item.id === roleId);
  const primaryUnit =
    units.data?.find((unit) => unit.isPrimary) ?? units.data?.[0];
  const selectedBusinessUnitIds =
    businessUnitIds ?? (primaryUnit ? [primaryUnit.id] : []);

  const selectRole = (value: string) => {
    setRoleId(value);
    const selected = (roles.data ?? []).find((item) => item.id === value);
    if (!selected) return;
    setPermissions([...selected.permissions]);
    setAllowedSurfaces([...selected.allowedSurfaces]);
  };

  const setDefaults = (enabled: boolean) => {
    setUseRoleDefaults(enabled);
    if (!enabled && role) {
      setPermissions([...role.permissions]);
      setAllowedSurfaces([...role.allowedSurfaces]);
    }
  };

  const dataValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.includes("@");
  const accessValid =
    selectedBusinessUnitIds.length > 0 &&
    (useRoleDefaults
      ? Boolean(role?.allowedSurfaces.length)
      : allowedSurfaces.length > 0);
  const canContinue =
    (step === 0 && dataValid) ||
    (step === 1 && Boolean(roleId)) ||
    (step === 2 && accessValid) ||
    step === 3;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step < STEPS.length - 1) {
      if (canContinue) setStep((current) => current + 1);
      return;
    }

    create.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        roleId,
        businessUnitIds: selectedBusinessUnitIds,
        useRoleDefaults,
        ...(useRoleDefaults ? {} : { permissions, allowedSurfaces }),
      },
      { onSuccess: setCreated },
    );
  };

  if (created) {
    return (
      <GeneratedPassword result={created} onClose={() => onOpenChange(false)} />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>Cadastrar usuário</DialogTitle>
        <DialogDescription>
          Defina identidade, papel, superfícies e unidades antes de liberar o
          primeiro acesso.
        </DialogDescription>
      </DialogHeader>

      <ol className="grid grid-cols-4 gap-2" aria-label="Etapas do cadastro">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className="w-full text-left"
              onClick={() => index < step && setStep(index)}
              disabled={index > step}
            >
              <span
                className={`block h-1.5 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                {index + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="member-first-name">Nome</Label>
            <Input
              id="member-first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-last-name">Sobrenome</Label>
            <Input
              id="member-last-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="member-email">E-mail</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Usado para entrar, mesmo que a pessoa não o leia"
              required
            />
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="member-role">Papel</Label>
            <Select value={roleId} onValueChange={selectRole}>
              <SelectTrigger id="member-role">
                <SelectValue placeholder="Escolher papel" />
              </SelectTrigger>
              <SelectContent>
                {(roles.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role ? (
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="font-medium">{role.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {role.description ?? "Papel operacional da organização."}
              </p>
              <div className="mt-3 flex gap-2">
                {["MOBILE", "WEB"].map((surface) => (
                  <Badge
                    key={surface}
                    variant={
                      role.allowedSurfaces.includes(surface)
                        ? "secondary"
                        : "outline"
                    }
                    className={
                      role.allowedSurfaces.includes(surface)
                        ? undefined
                        : "opacity-45"
                    }
                  >
                    {surface === "MOBILE" ? "App mobile" : "Plataforma Web"}{" "}
                    {role.allowedSurfaces.includes(surface) ? "✓" : "—"}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <MemberAccessEditor
          units={units.data ?? []}
          selectedUnitIds={selectedBusinessUnitIds}
          onSelectedUnitIdsChange={setBusinessUnitIds}
          role={role}
          catalog={catalog.data}
          useRoleDefaults={useRoleDefaults}
          onUseRoleDefaultsChange={setDefaults}
          permissions={permissions}
          onPermissionsChange={setPermissions}
          allowedSurfaces={allowedSurfaces}
          onAllowedSurfacesChange={setAllowedSurfaces}
        />
      ) : null}

      {step === 3 ? (
        <div className="space-y-4 rounded-xl border p-4">
          <div>
            <p className="text-xs text-muted-foreground">Pessoa</p>
            <p className="font-medium">
              {firstName.trim()} {lastName.trim()}
            </p>
            <p className="text-sm text-muted-foreground">{email.trim()}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Summary label="Papel" value={role?.name ?? "—"} />
            <Summary
              label="Unidades"
              value={`${selectedBusinessUnitIds.length} selecionada${selectedBusinessUnitIds.length === 1 ? "" : "s"}`}
            />
            <Summary
              label="Superfícies"
              value={
                (useRoleDefaults
                  ? role?.allowedSurfaces
                  : allowedSurfaces
                )?.join(" · ") ?? "—"
              }
            />
            <Summary
              label="Permissões"
              value={
                useRoleDefaults
                  ? "Recomendadas pelo papel"
                  : `${permissions.length} selecionadas`
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A pessoa receberá uma senha temporária exibida uma única vez.
          </p>
        </div>
      ) : null}

      <MutationError error={create.error} />

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            step === 0 ? onOpenChange(false) : setStep((value) => value - 1)
          }
        >
          {step === 0 ? "Cancelar" : "Voltar"}
        </Button>
        <Button type="submit" disabled={!canContinue || create.isPending}>
          {step === 3 ? <UserPlus className="size-4" /> : null}
          {create.isPending
            ? "Cadastrando…"
            : step === 3
              ? "Cadastrar"
              : "Continuar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function GeneratedPassword({
  result,
  onClose,
}: {
  result: CreatedTeamMember;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
    } catch {
      // The value remains visible when clipboard access is unavailable.
    }
  };

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle>{result.member.displayName} cadastrado</DialogTitle>
        <DialogDescription>
          Esta senha aparece <strong>uma única vez</strong>. Guarde-a agora e
          repasse para a pessoa.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground">Senha temporária</p>
          <p
            className="mt-1 font-mono text-2xl font-semibold tracking-wider"
            data-testid="temporary-password"
          >
            {result.temporaryPassword}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={copy}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copiada" : "Copiar senha"}
        </Button>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {result.member.email} troca esta senha no primeiro acesso. Se ela
            for perdida, gere um novo link nas ações da pessoa.
          </span>
        </p>
      </div>
      <DialogFooter>
        <Button type="button" onClick={onClose}>
          Concluir
        </Button>
      </DialogFooter>
    </div>
  );
}
