"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MailCheck,
  ShieldAlert,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { OrbitLogo } from "@/components/brand/orbit-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SessionLoading } from "@/guards";
import { useForgotPassword, useResetPassword } from "@/hooks/api";
import { ROUTES } from "@/lib/routes";
import { useOptionalSession } from "@/providers";

/** Mínimo exigido por `ResetPasswordDto` no backend. */
const MIN_PASSWORD_LENGTH = 12;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<SessionLoading label="Carregando…" />}>
      <ResetPasswordView />
    </Suspense>
  );
}

/**
 * Definição de nova senha a partir do token enviado por e-mail
 * (`POST /identity/password/reset`).
 *
 * Também é o destino do fluxo de troca obrigatória: quando a sessão indica
 * `requiresPasswordChange`, o guard traz o usuário para cá.
 */
function ResetPasswordView() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const mandatory = params.get("motivo") === "obrigatorio";
  const [showPassword, setShowPassword] = useState(false);
  const resetPassword = useResetPassword();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) {
      toast.error("As senhas não coincidem");
      return;
    }
    try {
      await resetPassword.mutateAsync({ token, password });
      toast.success("Senha atualizada", {
        description: "Entre novamente com a nova senha.",
      });
    } catch (error) {
      toast.error("Não foi possível redefinir a senha", {
        description:
          error instanceof Error
            ? error.message
            : "O link pode ter expirado. Solicite um novo.",
      });
    }
  }

  return (
    <main className="flex min-h-dvh flex-col px-6 py-8 sm:px-10">
      <div className="flex items-center justify-between">
        <Link href={ROUTES.home} aria-label="Orbit — início">
          <OrbitLogo />
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href={ROUTES.login}>
            <ArrowLeft className="size-4" />
            Voltar ao login
          </Link>
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {mandatory ? "Defina uma nova senha" : "Nova senha"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use pelo menos {MIN_PASSWORD_LENGTH} caracteres. A nova senha vale
            para todos os acessos da sua conta.
          </p>

          {mandatory ? (
            <Alert className="mt-6">
              <ShieldAlert className="size-4" />
              <AlertTitle>Troca de senha obrigatória</AlertTitle>
              <AlertDescription>
                Sua organização exige a definição de uma nova senha antes de
                continuar.
              </AlertDescription>
            </Alert>
          ) : null}

          {token ? (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                    placeholder="••••••••••••"
                    className="px-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirme a nova senha</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                    placeholder="••••••••••••"
                    className="pl-9"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={resetPassword.isPending}
              >
                {resetPassword.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Salvar nova senha"
                )}
              </Button>
            </form>
          ) : (
            <MissingTokenState mandatory={mandatory} />
          )}
        </motion.div>
      </div>
    </main>
  );
}

/**
 * Página aberta sem o token do e-mail.
 *
 * Na troca obrigatória o usuário chega aqui autenticado e sem token — o
 * caminho suportado pelo backend hoje é disparar o e-mail de recuperação para
 * a própria conta e concluir pelo link.
 */
function MissingTokenState({ mandatory }: { mandatory: boolean }) {
  const session = useOptionalSession();
  const forgotPassword = useForgotPassword();
  const email = session?.user?.email;
  const [sent, setSent] = useState(false);

  async function requestLink() {
    if (!email) return;
    try {
      await forgotPassword.mutateAsync({ email });
    } finally {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <Alert className="mt-8">
        <MailCheck className="size-4" />
        <AlertTitle>Link enviado</AlertTitle>
        <AlertDescription>
          Enviamos o link de definição de senha para {email}. Ele expira em 30
          minutos.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <Alert>
        <ShieldAlert className="size-4" />
        <AlertTitle>
          {mandatory ? "Confirme por e-mail" : "Link inválido"}
        </AlertTitle>
        <AlertDescription>
          {mandatory && email
            ? `Para definir a nova senha com segurança, enviamos um link para ${email}.`
            : "Esta página precisa do link enviado por e-mail. Solicite um novo link de recuperação para continuar."}
        </AlertDescription>
      </Alert>
      {mandatory && email ? (
        <Button
          className="w-full"
          size="lg"
          onClick={requestLink}
          disabled={forgotPassword.isPending}
        >
          {forgotPassword.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Enviar link para meu e-mail"
          )}
        </Button>
      ) : (
        <Button asChild className="w-full" size="lg">
          <Link href={ROUTES.forgotPassword}>Solicitar novo link</Link>
        </Button>
      )}
    </div>
  );
}
