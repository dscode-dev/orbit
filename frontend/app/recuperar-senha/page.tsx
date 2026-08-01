"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { motion } from "motion/react";

import { OrbitLogo } from "@/components/brand/orbit-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForgotPassword } from "@/hooks/api";
import { ROUTES } from "@/lib/routes";

/**
 * Solicitação de recuperação de senha.
 *
 * O backend responde 202 mesmo para e-mails inexistentes, para não revelar
 * quais contas existem. A tela reflete isso: a confirmação é sempre a mesma.
 */
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const forgotPassword = useForgotPassword();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await forgotPassword.mutateAsync({
        email: String(form.get("email") ?? ""),
      });
    } finally {
      setSent(true);
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
            Recuperar acesso
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Informe o e-mail da sua conta. Se ela existir, enviaremos um link
            para definir uma nova senha.
          </p>

          {sent ? (
            <div className="mt-8 space-y-6">
              <Alert>
                <MailCheck className="size-4" />
                <AlertTitle>Verifique seu e-mail</AlertTitle>
                <AlertDescription>
                  Se houver uma conta com esse endereço, o link de recuperação
                  chega em instantes. Ele expira em 30 minutos.
                </AlertDescription>
              </Alert>
              <Button asChild variant="outline" className="w-full">
                <Link href={ROUTES.login}>Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail corporativo</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="voce@empresa.com"
                    className="pl-9"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={forgotPassword.isPending}
              >
                {forgotPassword.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </main>
  );
}
