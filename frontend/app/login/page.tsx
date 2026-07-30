"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { OrbitLogo } from "@/components/brand/orbit-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";



export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          mfaCode: form.get("mfaCode") || undefined,
          client: "WEB",
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        if (payload.message?.toLowerCase().includes("mfa code is required")) {
          setRequiresMfa(true);
          throw new Error("Digite o código do seu autenticador para continuar.");
        }
        throw new Error(payload.message);
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error("Não foi possível entrar", {
        description: error instanceof Error ? error.message : "Verifique suas credenciais.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Orbit — início">
            <OrbitLogo />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Voltar ao site</Link>
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
              Bem-vindo de volta
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Entre com suas credenciais para acessar o workspace da sua operação.
            </p>

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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <button
                    type="button"
                    onClick={() => toast.info("Recuperação de senha em breve")}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="px-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="remember" defaultChecked />
                <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
                  Manter-me conectado
                </Label>
              </div>

              {requiresMfa && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-2"
                >
                  <Label htmlFor="mfaCode">Código de segurança</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="mfaCode"
                      name="mfaCode"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      minLength={6}
                      maxLength={10}
                      required
                      placeholder="000000"
                      className="pl-9 font-mono tracking-[0.25em]"
                    />
                  </div>
                </motion.div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-[11px] tracking-wider text-muted-foreground uppercase">ou</span>
              <Separator className="flex-1" />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => toast.info("SSO corporativo em breve")}
            >
              <ShieldCheck className="size-4" />
              Entrar com SSO corporativo
            </Button>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Ainda não tem acesso?{" "}
              <Link
                href="/cadastro"
                className="font-medium text-primary hover:underline"
              >
                Criar minha organização
              </Link>
            </p>
          </motion.div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Ao continuar você concorda com os Termos de Uso e a Política de Privacidade.
        </p>
      </div>

      {/* Brand side */}
      <aside className="bg-gradient-orbit relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-96 rounded-full border border-primary-foreground/20"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 size-[28rem] rounded-full border border-primary-foreground/15"
        />

        <p className="relative text-sm font-medium tracking-[0.2em] text-primary-foreground/70 uppercase">
          Orbit Operations ERP
        </p>

        <div className="relative max-w-md">
          <blockquote className="font-display text-3xl leading-snug font-semibold text-primary-foreground">
            “Colocamos toda a operação em uma única órbita — e reduzimos o retrabalho em 38%.”
          </blockquote>
          <p className="mt-6 text-sm text-primary-foreground/80">
            Marina Duarte · Diretora de Operações, Acme Industries
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-4">
          {[
            { v: "12k+", l: "ordens/mês" },
            { v: "99,9%", l: "uptime" },
            { v: "24/7", l: "suporte" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl bg-primary-foreground/10 p-4 backdrop-blur-sm">
              <p className="font-display text-xl font-bold text-primary-foreground">{s.v}</p>
              <p className="text-xs text-primary-foreground/75">{s.l}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
