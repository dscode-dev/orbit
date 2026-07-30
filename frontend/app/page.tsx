"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  Cpu,
  Layers,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { motion } from "motion/react";

import { OrbitLogo } from "@/components/brand/orbit-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";



const features = [
  {
    icon: Boxes,
    title: "Inventário em tempo real",
    description: "Estoque, lotes e movimentações sincronizados em cada unidade operacional.",
  },
  {
    icon: Workflow,
    title: "Processos orquestrados",
    description: "Fluxos configuráveis com aprovações, SLAs e trilha de auditoria completa.",
  },
  {
    icon: BarChart3,
    title: "Indicadores acionáveis",
    description: "KPIs e relatórios prontos, com drill-down até o documento de origem.",
  },
  {
    icon: ShieldCheck,
    title: "Governança e permissões",
    description: "Papéis granulares, segregação por workspace e log de tudo que acontece.",
  },
  {
    icon: Cpu,
    title: "Automação assistida",
    description: "Copilot sugere ações e antecipa rupturas antes que virem problema.",
  },
  {
    icon: Layers,
    title: "Design system próprio",
    description: "Interface consistente, acessível e pronta para novos módulos de negócio.",
  },
];

const metrics = [
  { value: "38%", label: "menos retrabalho operacional" },
  { value: "2,4x", label: "mais rápido no fechamento" },
  { value: "99,9%", label: "disponibilidade da plataforma" },
];

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Orbit — início">
          <OrbitLogo />
        </Link>
        <nav aria-label="Navegação" className="hidden items-center gap-6 md:flex">
          <a href="#recursos" className="text-sm text-muted-foreground hover:text-foreground">
            Recursos
          </a>
          <a href="#plataforma" className="text-sm text-muted-foreground hover:text-foreground">
            Plataforma
          </a>
          <Link
            href="/design-system"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Design System
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/cadastro">
              Começar agora
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <Header />

      <main>
        {/* Hero */}
        <section className="bg-aurora relative overflow-hidden">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-3xl"
            >
              <Badge variant="secondary" className="gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Orbit V2 — nova geração
              </Badge>
              <h1 className="mt-5 font-display text-4xl leading-[1.05] font-bold tracking-tight text-foreground sm:text-6xl">
                O ERP de operações que gira{" "}
                <span className="text-gradient-orbit">em torno do seu negócio</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Inventário, pessoas, processos e indicadores em uma única plataforma. Rápida,
                clara e construída sobre um design system próprio — pronta para escalar com a sua
                operação.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/cadastro">
                    Acessar plataforma
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/design-system">Ver design system</Link>
                </Button>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
                {["Implantação guiada", "Sem custo de setup", "Suporte em português"].map((i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-4 text-success" />
                    {i}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="mt-16 grid gap-4 sm:grid-cols-3"
            >
              {metrics.map((m) => (
                <div key={m.label} className="glass-panel rounded-2xl p-6">
                  <p className="font-display text-3xl font-bold text-foreground">{m.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section id="recursos" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Tudo que a operação precisa, em um só lugar
            </h2>
            <p className="mt-3 text-muted-foreground">
              Módulos que conversam entre si, sem planilhas paralelas e sem integrações frágeis.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, index) => (
              <motion.article
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.3, delay: index * 0.04 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-elevated"
              >
                <span className="bg-gradient-orbit inline-flex size-10 items-center justify-center rounded-xl text-primary-foreground">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </motion.article>
            ))}
          </div>
        </section>

        {/* Platform strip */}
        <section id="plataforma" className="border-y border-border bg-muted/40">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
                Uma base visual sólida para cada novo módulo
              </h2>
              <p className="mt-3 text-muted-foreground">
                Tokens de cor, tipografia, motion e componentes documentados. Toda nova tela nasce
                consistente, acessível e no ritmo da marca Orbit.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Tema claro com a paleta orbital aplicada com precisão",
                  "Componentes shadcn/ui adaptados e documentados",
                  "Command palette, atalhos e navegação previsível",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    {i}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-8" variant="outline">
                <Link href="/design-system">
                  Explorar componentes
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Pedidos hoje", value: "1.284" },
                  { label: "SLA cumprido", value: "97,3%" },
                  { label: "Itens críticos", value: "12" },
                  { label: "Ciclo médio", value: "3,2d" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-foreground">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Ocupação por unidade</p>
                <div className="mt-3 space-y-2">
                  {[82, 64, 41].map((v, i) => (
                    <div key={i} className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="bg-gradient-orbit h-full rounded-full"
                        style={{ width: `${v}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="bg-gradient-orbit relative overflow-hidden rounded-3xl px-8 py-14 text-center">
            <h2 className="font-display text-3xl font-bold text-primary-foreground sm:text-4xl">
              Coloque sua operação em órbita
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-primary-foreground/85 sm:text-base">
              Comece pelo acesso à plataforma e evolua módulo a módulo, no seu ritmo.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8">
              <Link href="/login">
                Entrar no Orbit
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <OrbitLogo />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Orbit Operations ERP. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
