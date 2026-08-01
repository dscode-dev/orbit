"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { OrbitLogo } from "@/components/brand/orbit-logo";
import { LoadingState } from "@/components/feedback/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlans, useRegister } from "@/hooks/api";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    firstName: z.string().min(2, "Informe seu nome"),
    lastName: z.string().min(2, "Informe seu sobrenome"),
    email: z.string().email("Informe um e-mail válido"),
    password: z.string().min(12, "Use pelo menos 12 caracteres"),
    confirmPassword: z.string(),
    organizationName: z.string().min(2, "Informe o nome da organização"),
    legalName: z.string().min(2, "Informe a razão social"),
    documentNumber: z.string().min(11, "Informe um documento válido"),
    primarySegment: z.string().min(2, "Informe o segmento"),
    city: z.string().min(2, "Informe a cidade"),
    street: z.string().min(2, "Informe o endereço"),
    stateCode: z.string().length(2, "Use a sigla do estado"),
    planKey: z.string().min(1, "Escolha um plano para continuar"),
    terms: z.boolean().refine(Boolean, "Aceite os termos para continuar"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem",
  });

type FormValues = z.infer<typeof schema>;

const steps = [
  {
    title: "Escolha do plano",
    description: "Defina o plano da assinatura",
    icon: Sparkles,
  },
  { title: "Sua conta", description: "Você será o owner", icon: UserRound },
  {
    title: "Organização",
    description: "Identidade do workspace",
    icon: Building2,
  },
  { title: "Unidade principal", description: "Base da operação", icon: MapPin },
];

const LAST_STEP = steps.length - 1;

const fieldsByStep: (keyof FormValues)[][] = [
  ["planKey"],
  ["firstName", "lastName", "email", "password", "confirmPassword"],
  ["organizationName", "legalName", "documentNumber", "primarySegment"],
  ["city", "street", "stateCode", "terms"],
];

/** `Decimal` do Prisma chega como string; a formatação é a mesma. */
function formatPrice(value: string | number | null, currency: string): string {
  if (value === null) return "Sob consulta";
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "Sob consulta";
  if (amount === 0) return "Gratuito";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

/**
 * Escolha do plano — primeira etapa do onboarding público.
 *
 * Os planos vêm de `GET /plans`, rota pública do backend encaminhada pelo BFF
 * sem sessão. `planKey` segue para `POST /identity/register`, que provisiona
 * organização, unidade principal e o papel de owner na mesma transação.
 */
function PlanStep({
  selected,
  onSelect,
  error,
}: {
  selected: string;
  onSelect: (planKey: string) => void;
  error?: string;
}) {
  const plans = usePlans();

  if (plans.isPending) return <LoadingState label="Carregando planos…" />;

  if (plans.isError || plans.data.length === 0) {
    return (
      <Alert>
        <AlertTitle>Não foi possível carregar os planos</AlertTitle>
        <AlertDescription>
          {plans.error?.message ??
            "Nenhum plano está disponível no momento. Tente novamente em instantes."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.data.map((plan) => {
          const active = plan.key === selected;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.key)}
              aria-pressed={active}
              className={cn(
                "rounded-xl border border-border p-5 text-left transition-colors",
                active
                  ? "border-primary bg-secondary"
                  : "hover:border-primary/40 hover:bg-muted/40",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold">
                    {plan.name}
                  </p>
                  {plan.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.description}
                    </p>
                  ) : null}
                </div>
                {active ? (
                  <Check className="size-4 shrink-0 text-primary" />
                ) : null}
              </div>
              <p className="mt-4 font-display text-2xl font-bold">
                {formatPrice(plan.monthlyPrice, plan.currency)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  /mês
                </span>
              </p>
              {plan.capabilities.length > 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {plan.capabilities.length} módulos habilitados
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
  );
}

export default function CadastroPage() {
  const createAccount = useRegister();
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      primarySegment: "Serviços",
      stateCode: "PE",
      planKey: "",
      terms: false,
    },
  });

  async function next() {
    if (await trigger(fieldsByStep[step])) {
      setStep((current) => Math.min(current + 1, LAST_STEP));
    }
  }

  async function submit(values: FormValues) {
    const { confirmPassword: _, terms: __, ...payload } = values;
    try {
      await createAccount.mutateAsync({
        ...payload,
        stateCode: payload.stateCode.toUpperCase(),
        documentType:
          payload.documentNumber.replace(/\D/g, "").length === 11
            ? "CPF"
            : "CNPJ",
        client: "WEB",
        businessUnitType: "HEADQUARTERS",
      });
      toast.success("Sua organização está pronta");
    } catch (error) {
      toast.error("Não foi possível concluir o cadastro", {
        description:
          error instanceof Error ? error.message : "Tente novamente.",
      });
    }
  }

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[22rem_1fr]">
      <aside className="bg-gradient-orbit relative hidden overflow-hidden p-8 text-primary-foreground lg:flex lg:flex-col">
        <div className="absolute -top-20 -left-20 size-64 rounded-full border border-primary-foreground/20" />
        <div className="relative [&_span]:text-primary-foreground [&_svg]:text-primary-foreground">
          <OrbitLogo />
        </div>
        <div className="relative my-auto">
          <p className="text-xs font-semibold tracking-[0.22em] text-primary-foreground/70 uppercase">
            Novo workspace
          </p>
          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight">
            Sua operação começa com uma base segura.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-primary-foreground/75">
            Configure a organização em poucos passos. Você entra como owner e
            pode convidar o time depois.
          </p>
          <ol className="mt-10 space-y-2">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const active = index === step;
              const complete = index < step;
              return (
                <li
                  key={item.title}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                    active && "bg-primary-foreground/12",
                  )}
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/10">
                    {complete ? (
                      <Check className="size-4" />
                    ) : (
                      <Icon className="size-4" />
                    )}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="block text-xs text-primary-foreground/65">
                      {item.description}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-primary-foreground/70">
          <ShieldCheck className="size-4" />
          Sessão segura e isolamento multi-tenant
        </div>
      </aside>

      <section className="flex min-w-0 flex-col px-5 py-6 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between">
          <div className="lg:hidden">
            <OrbitLogo />
          </div>
          <span className="hidden text-sm text-muted-foreground lg:block">
            Etapa {step + 1} de {steps.length}
          </span>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Já tenho uma conta</Link>
          </Button>
        </header>

        <div className="mx-auto flex w-full max-w-2xl flex-1 items-center py-10">
          <form onSubmit={handleSubmit(submit)} className="w-full">
            <div className="mb-8 flex gap-2 lg:hidden">
              {steps.map((item, index) => (
                <span
                  key={item.title}
                  className={cn(
                    "h-1 flex-1 rounded-full bg-muted",
                    index <= step && "bg-primary",
                  )}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mb-8">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    <Sparkles className="size-3.5 text-primary" />
                    14 dias para explorar
                  </span>
                  <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
                    {steps[step].title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step === 0 &&
                      "Escolha o plano que a sua organização vai assinar."}
                    {step === 1 &&
                      "Crie suas credenciais de acesso administrativo."}
                    {step === 2 &&
                      "Dê um nome ao ambiente que sua equipe verá todos os dias."}
                    {step === 3 &&
                      "Cadastre a matriz para contextualizar sua operação."}
                  </p>
                </div>

                {step === 0 && (
                  <PlanStep
                    selected={watch("planKey")}
                    onSelect={(planKey) =>
                      setValue("planKey", planKey, { shouldValidate: true })
                    }
                    error={errors.planKey?.message}
                  />
                )}

                {step === 1 && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Nome</Label>
                      <Input
                        id="firstName"
                        autoComplete="given-name"
                        {...register("firstName")}
                      />
                      <FieldError message={errors.firstName?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Sobrenome</Label>
                      <Input
                        id="lastName"
                        autoComplete="family-name"
                        {...register("lastName")}
                      />
                      <FieldError message={errors.lastName?.message} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="email">E-mail corporativo</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        {...register("email")}
                      />
                      <FieldError message={errors.email?.message} />
                    </div>
                    {(["password", "confirmPassword"] as const).map((name) => (
                      <div key={name} className="space-y-2">
                        <Label htmlFor={name}>
                          {name === "password" ? "Senha" : "Confirmar senha"}
                        </Label>
                        <div className="relative">
                          <Input
                            id={name}
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            className="pr-10"
                            {...register(name)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((value) => !value)}
                            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                            aria-label="Alternar visibilidade da senha"
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </div>
                        <FieldError message={errors[name]?.message} />
                      </div>
                    ))}
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="organizationName">
                        Nome da organização
                      </Label>
                      <Input
                        id="organizationName"
                        placeholder="Como sua equipe conhece a empresa"
                        {...register("organizationName")}
                      />
                      <FieldError message={errors.organizationName?.message} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="legalName">Razão social</Label>
                      <Input id="legalName" {...register("legalName")} />
                      <FieldError message={errors.legalName?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="documentNumber">CPF ou CNPJ</Label>
                      <Input
                        id="documentNumber"
                        inputMode="numeric"
                        {...register("documentNumber")}
                      />
                      <FieldError message={errors.documentNumber?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="primarySegment">Segmento principal</Label>
                      <Input
                        id="primarySegment"
                        {...register("primarySegment")}
                      />
                      <FieldError message={errors.primarySegment?.message} />
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="grid gap-5 sm:grid-cols-[1fr_6rem]">
                    <div className="space-y-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input id="city" {...register("city")} />
                      <FieldError message={errors.city?.message} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stateCode">UF</Label>
                      <Input
                        id="stateCode"
                        maxLength={2}
                        className="uppercase"
                        {...register("stateCode")}
                      />
                      <FieldError message={errors.stateCode?.message} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="street">Endereço da matriz</Label>
                      <Input id="street" {...register("street")} />
                      <FieldError message={errors.street?.message} />
                    </div>
                    <div className="rounded-xl border border-border bg-muted/40 p-4 sm:col-span-2">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="terms"
                          checked={watch("terms")}
                          onCheckedChange={(checked) =>
                            setValue("terms", checked === true, {
                              shouldValidate: true,
                            })
                          }
                        />
                        <Label
                          htmlFor="terms"
                          className="text-sm font-normal leading-relaxed"
                        >
                          Concordo com os Termos de Uso e a Política de
                          Privacidade do Orbit.
                        </Label>
                      </div>
                      <FieldError message={errors.terms?.message} />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
              <Button
                type="button"
                variant="ghost"
                disabled={step === 0 || isSubmitting}
                onClick={() => setStep((current) => Math.max(current - 1, 0))}
              >
                <ArrowLeft className="size-4" />
                Voltar
              </Button>
              {step < LAST_STEP ? (
                <Button type="button" size="lg" onClick={next}>
                  Continuar
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Criar organização
                </Button>
              )}
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
