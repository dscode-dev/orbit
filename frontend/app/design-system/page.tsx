"use client";

import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  Filter as FilterIcon,
  Inbox,
  Rocket,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import {
  ContentContainer,
  PageHeader,
  SectionHeader,
  SplitLayout,
  ScrollablePanel,
} from "@/components/layout/page-primitives";
import { OrbitLogo } from "@/components/brand/orbit-logo";
import { StatCard, KpiCard } from "@/components/ui/stat-card";
import {
  EmptyState,
  LoadingState,
  Spinner,
} from "@/components/feedback/states";
import { Timeline } from "@/components/ui/timeline";
import { MultiSelect } from "@/components/ui/multi-select";
import { ChartWrapper } from "@/components/charts/chart-wrapper";
import { RequirePlatformAdmin } from "@/guards";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";

const paletteTokens = [
  { name: "background", label: "Deep Space", swatch: "bg-background" },
  { name: "card", label: "Surface", swatch: "bg-card" },
  { name: "primary", label: "Orbital Blue", swatch: "bg-primary" },
  { name: "accent", label: "Nebula Violet", swatch: "bg-accent" },
  { name: "success", label: "Success", swatch: "bg-success" },
  { name: "warning", label: "Warning", swatch: "bg-warning" },
  { name: "destructive", label: "Destructive", swatch: "bg-destructive" },
  { name: "gradient", label: "Orbit Gradient", swatch: "bg-gradient-orbit" },
];

const tableRows = [
  {
    id: "ORB-1042",
    modulo: "Operações",
    estado: "Ativo",
    owner: "A. Souza",
    progresso: 82,
  },
  {
    id: "ORB-1043",
    modulo: "Inventário",
    estado: "Em revisão",
    owner: "M. Lima",
    progresso: 46,
  },
  {
    id: "ORB-1044",
    modulo: "Pessoas",
    estado: "Rascunho",
    owner: "J. Prado",
    progresso: 12,
  },
];

const options = [
  { value: "ops", label: "Operações" },
  { value: "inv", label: "Inventário" },
  { value: "fin", label: "Financeiro" },
  { value: "ppl", label: "Pessoas" },
];

function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      <SectionHeader title={title} description={description} />
      {children}
    </motion.section>
  );
}

export default function DesignSystemPage() {
  const [selected, setSelected] = useState<string[]>(["ops"]);
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <RequirePlatformAdmin>
      <AppShell
        activeLabel="Visão geral"
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Orbit</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Design System</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      >
        <ContentContainer size="wide" className="space-y-12 pb-20">
          {/* Hero / identity */}
          <section className="glass-panel relative overflow-hidden rounded-2xl p-8 sm:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full opacity-40 blur-3xl bg-gradient-orbit"
            />
            <div className="relative flex flex-col gap-6">
              <OrbitLogo />
              <div className="space-y-3">
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="size-3" /> Fundação visual · v2
                </Badge>
                <h1 className="max-w-2xl text-3xl font-semibold sm:text-4xl">
                  O sistema de design do{" "}
                  <span className="text-gradient-orbit">Orbit</span>
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Tokens, componentes e layout base construídos a partir da
                  identidade da marca — espaço profundo, órbita e luz. Toda tela
                  futura da plataforma nasce daqui.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-gradient-orbit text-primary-foreground shadow-glow hover:opacity-90">
                  <Rocket className="size-4" /> Começar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toast.success("Toast do design system")}
                >
                  Ver toast
                </Button>
              </div>
            </div>
          </section>

          <PageHeader
            title="Biblioteca de componentes"
            description="Cada componente consome exclusivamente tokens do design system. Nenhum valor mágico."
            actions={
              <>
                <Button variant="outline" size="sm">
                  <FilterIcon className="size-4" /> Filtros
                </Button>
                <Button size="sm">
                  <Settings2 className="size-4" /> Configurar
                </Button>
              </>
            }
          />

          {/* Palette */}
          <Block
            title="Paleta & tokens"
            description="Derivada da logo: navy profundo, azul orbital e violeta de nebulosa."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {paletteTokens.map((token) => (
                <div key={token.name} className="glass rounded-xl p-3">
                  <div
                    className={`h-14 w-full rounded-lg ring-1 ring-border ${token.swatch}`}
                  />
                  <p className="mt-3 text-sm font-medium">{token.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    --{token.name}
                  </p>
                </div>
              ))}
            </div>
          </Block>

          {/* Metrics */}
          <Block title="Métricas" description="StatCard, KPI Card e Progress.">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Ordens ativas"
                value="1.284"
                delta="+12,4%"
                trend="up"
                hint="vs. mês anterior"
                icon={<Activity className="size-4" />}
              />
              <StatCard
                label="Lead time médio"
                value="3,2 d"
                delta="-8,1%"
                trend="down"
                hint="melhorou"
                icon={<Boxes className="size-4" />}
              />
              <KpiCard label="Capacidade" value="76%" progress={76} />
              <KpiCard label="SLA" value="98,2%" progress={98} />
            </div>
            <Progress value={62} className="h-2" />
          </Block>

          {/* Forms */}
          <Block
            title="Formulários"
            description="Input, Textarea, Select, MultiSelect, Checkbox, Radio e Switch."
          >
            <Card className="glass-panel">
              <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ds-name">Nome do registro</Label>
                  <Input id="ds-name" placeholder="Ex: Ordem de produção" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ds-search">Busca</Label>
                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="ds-search"
                      className="pl-9"
                      placeholder="Filtrar resultados"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ds-select">Módulo</Label>
                  <Select>
                    <SelectTrigger id="ds-select">
                      <SelectValue placeholder="Selecionar módulo" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Escopos</Label>
                  <MultiSelect
                    options={options}
                    value={selected}
                    onChange={setSelected}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="ds-notes">Observações</Label>
                  <Textarea
                    id="ds-notes"
                    placeholder="Descreva o contexto…"
                    rows={3}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox id="ds-check" defaultChecked />
                    <Label htmlFor="ds-check">Notificar equipe</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="ds-switch" defaultChecked />
                    <Label htmlFor="ds-switch">Automação</Label>
                  </div>
                </div>
                <RadioGroup defaultValue="a" className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="a" id="ds-r1" />
                    <Label htmlFor="ds-r1">Padrão</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="b" id="ds-r2" />
                    <Label htmlFor="ds-r2">Avançado</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </Block>

          {/* Actions & overlays */}
          <Block
            title="Ações & overlays"
            description="Button, Badge, Tooltip, Popover, Dropdown, Dialog e Drawer."
          >
            <Card className="glass-panel">
              <CardContent className="flex flex-wrap items-center gap-3 pt-6">
                <Button>Primária</Button>
                <Button variant="secondary">Secundária</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destrutiva</Button>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Configurações"
                >
                  <Settings2 className="size-4" />
                </Button>
                <Badge>Badge</Badge>
                <Badge variant="secondary">Tag</Badge>
                <Badge variant="outline">Outline</Badge>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">Tooltip</Button>
                  </TooltipTrigger>
                  <TooltipContent>Dica contextual</TooltipContent>
                </Tooltip>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">Popover</Button>
                  </PopoverTrigger>
                  <PopoverContent className="text-sm">
                    Conteúdo flutuante em vidro.
                  </PopoverContent>
                </Popover>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">Dropdown</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Duplicar</DropdownMenuItem>
                    <DropdownMenuItem>Arquivar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Modal</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Título do modal</DialogTitle>
                      <DialogDescription>
                        Diálogos usam o mesmo blur, raio e sombra dos painéis.
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>

                <Drawer>
                  <DrawerTrigger asChild>
                    <Button variant="outline">Drawer</Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Painel lateral</DrawerTitle>
                      <DrawerDescription>
                        Ideal para edição contextual em mobile.
                      </DrawerDescription>
                    </DrawerHeader>
                  </DrawerContent>
                </Drawer>
              </CardContent>
            </Card>
          </Block>

          {/* Data */}
          <Block
            title="Dados"
            description="Table, Pagination, Tabs e Accordion."
          >
            <SplitLayout
              ratio="2/1"
              primary={
                <Card className="glass-panel">
                  <CardHeader>
                    <CardTitle className="text-base">Registros</CardTitle>
                    <CardDescription>
                      Estrutura base para DataTables dos módulos.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Módulo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead className="text-right">
                            Progresso
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">
                              {row.id}
                            </TableCell>
                            <TableCell>{row.modulo}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{row.estado}</Badge>
                            </TableCell>
                            <TableCell className="flex items-center gap-2">
                              <Avatar className="size-6">
                                <AvatarFallback className="text-[10px]">
                                  {row.owner.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              {row.owner}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.progresso}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious href="#" />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink href="#" isActive>
                            1
                          </PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink href="#">2</PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext href="#" />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </CardContent>
                </Card>
              }
              secondary={
                <Card className="glass-panel h-full">
                  <CardHeader>
                    <CardTitle className="text-base">Atividade</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollablePanel maxHeight="18rem" className="pr-2">
                      <Timeline
                        items={[
                          {
                            title: "Tokens publicados",
                            timestamp: "09:12",
                            tone: "success",
                            description: "Paleta derivada da logo.",
                          },
                          { title: "Sidebar revisada", timestamp: "10:04" },
                          {
                            title: "Command palette",
                            timestamp: "11:20",
                            tone: "warning",
                          },
                          {
                            title: "Auditoria de contraste",
                            timestamp: "13:47",
                          },
                        ]}
                      />
                    </ScrollablePanel>
                  </CardContent>
                </Card>
              }
            />

            <Tabs defaultValue="tab1">
              <TabsList>
                <TabsTrigger value="tab1">Visão</TabsTrigger>
                <TabsTrigger value="tab2">Detalhes</TabsTrigger>
                <TabsTrigger value="tab3">Histórico</TabsTrigger>
              </TabsList>
              <TabsContent
                value="tab1"
                className="glass mt-3 rounded-xl p-4 text-sm text-muted-foreground"
              >
                Conteúdo da aba de visão geral.
              </TabsContent>
              <TabsContent
                value="tab2"
                className="glass mt-3 rounded-xl p-4 text-sm text-muted-foreground"
              >
                Conteúdo detalhado.
              </TabsContent>
              <TabsContent
                value="tab3"
                className="glass mt-3 rounded-xl p-4 text-sm text-muted-foreground"
              >
                Histórico de alterações.
              </TabsContent>
            </Tabs>

            <Accordion
              type="single"
              collapsible
              className="glass rounded-xl px-4"
            >
              <AccordionItem value="a1">
                <AccordionTrigger>
                  Como criar um novo componente?
                </AccordionTrigger>
                <AccordionContent>
                  Componha primitivas existentes, use apenas classes derivadas
                  de tokens e exponha variantes com CVA.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="a2" className="border-b-0">
                <AccordionTrigger>Posso usar cores literais?</AccordionTrigger>
                <AccordionContent>
                  Não. Todo valor visual vive em src/styles.css.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Block>

          {/* Feedback */}
          <Block
            title="Feedback & estados"
            description="Alert, Skeleton, Spinner, Loading e Empty State."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <Alert>
                  <Sparkles className="size-4" />
                  <AlertTitle>Fundação pronta</AlertTitle>
                  <AlertDescription>
                    Os módulos do ERP podem ser construídos sobre esta base.
                  </AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <AlertTitle>Falha de sincronização</AlertTitle>
                  <AlertDescription>
                    Verifique a conexão e tente novamente.
                  </AlertDescription>
                </Alert>
                <div className="glass space-y-3 rounded-xl p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-24 w-full" />
                </div>
                <Spinner label="Sincronizando módulos…" />
              </div>
              <div className="space-y-4">
                <LoadingState />
                <EmptyState
                  icon={<Inbox className="size-5" />}
                  title="Nenhum registro ainda"
                  description="Quando os módulos forem ativados, os dados aparecerão aqui."
                  action={
                    <Button variant="outline" size="sm">
                      <ArrowUpRight className="size-4" /> Documentação
                    </Button>
                  }
                />
              </div>
            </div>
          </Block>

          {/* Charts + calendar */}
          <Block
            title="Gráficos & calendário"
            description="Wrapper padrão para Recharts e seletor de datas."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartWrapper
                title="Throughput"
                description="Wrapper reutilizável para qualquer gráfico."
              >
                <div className="flex h-full items-end gap-2">
                  {[38, 62, 45, 78, 56, 88, 71].map((v, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${v}%` }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.4,
                        delay: i * 0.04,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="bg-gradient-orbit w-full rounded-t-md opacity-90"
                    />
                  ))}
                </div>
              </ChartWrapper>
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="text-base">Calendário</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="rounded-xl"
                  />
                </CardContent>
              </Card>
            </div>
          </Block>
        </ContentContainer>
      </AppShell>
    </RequirePlatformAdmin>
  );
}
