"use client";

/**
 * Moldura comum dos widgets.
 *
 * Concentra o que todo widget precisa e nenhum deve reimplementar: cabeçalho,
 * estados de carregamento, erro, vazio e indisponibilidade, além do Error
 * Boundary local.
 *
 * Nenhuma regra de autorização vive aqui nem nos widgets: quem decide o que o
 * tenant enxerga é o `WidgetResolver` do backend (via `GET /dashboard`) e o
 * registry do frontend. A moldura apenas apresenta o resultado.
 */
import type { ReactNode } from "react";
import { CircleOff, Lock, RefreshCw, TriangleAlert } from "lucide-react";

import { ChartWrapper } from "@/components/charts/chart-wrapper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { WidgetErrorBoundary } from "./widget-error-boundary";
import type { WidgetQuery } from "./widget-registry";

export interface WidgetFrameProps {
  widgetId: string;
  title: string;
  description?: string;
  /** Renderizado à direita do cabeçalho (marcas, filtros, contadores). */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function WidgetFrame({
  widgetId,
  title,
  description,
  actions,
  className,
  children,
}: WidgetFrameProps) {
  return (
    <Card className={cn("glass-panel h-full", className)}>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </CardHeader>
      <CardContent>
        <WidgetErrorBoundary
          widgetId={widgetId}
          fallback={(error) => <WidgetRenderFailure error={error} />}
        >
          {children}
        </WidgetErrorBoundary>
      </CardContent>
    </Card>
  );
}

/**
 * Moldura para widgets de gráfico.
 *
 * Usa o `ChartWrapper` do Design System — que já é um card com cabeçalho — em
 * vez do `WidgetFrame`, evitando cartão dentro de cartão. O Error Boundary é
 * o mesmo.
 */
export function WidgetChartFrame({
  widgetId,
  title,
  description,
  actions,
  height = 300,
  className,
  children,
}: WidgetFrameProps & { height?: number }) {
  return (
    <ChartWrapper
      title={title}
      description={description}
      actions={actions}
      height={height}
      className={className}
    >
      <WidgetErrorBoundary
        widgetId={widgetId}
        fallback={(error) => <WidgetRenderFailure error={error} />}
      >
        {children}
      </WidgetErrorBoundary>
    </ChartWrapper>
  );
}

/**
 * Máquina de estados de uma leitura.
 *
 * Carregando → erro → vazio → dados, em um único lugar. Os widgets recebem o
 * dado já resolvido e não repetem a cadeia de condicionais.
 */
export function WidgetState<TData>({
  query,
  children,
  loadingRows,
  isEmpty,
  emptyMessage,
}: {
  query: WidgetQuery<TData>;
  loadingRows?: number;
  /** Vazio semântico do widget (ex.: lista de indicadores sem itens). */
  isEmpty?: (data: TData) => boolean;
  emptyMessage?: string;
  children: (data: TData) => ReactNode;
}) {
  if (query.isPending) return <WidgetLoading rows={loadingRows} />;
  if (query.error) {
    return <WidgetError error={query.error} onRetry={query.refetch} />;
  }
  if (query.data === undefined) return <WidgetEmpty message={emptyMessage} />;
  if (isEmpty?.(query.data)) return <WidgetEmpty message={emptyMessage} />;
  return <>{children(query.data)}</>;
}

/** Estado de carregamento — mantém a altura do widget estável. */
export function WidgetLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Carregando widget">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-4 w-full", index === 0 && "h-8 w-2/3")}
        />
      ))}
    </div>
  );
}

/** Vazio legítimo: a consulta respondeu, mas não há dados no período. */
export function WidgetEmpty({
  message = "Nenhum dado no período selecionado.",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center">
      <CircleOff className="size-5 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Erro de leitura.
 *
 * 403 é tratado à parte: o backend recusou por permissão, plano ou
 * capability — não é falha, é ausência de acesso, e não oferece "tentar
 * novamente".
 */
export function WidgetError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const apiError = error instanceof ApiError ? error : null;

  if (apiError?.isForbidden) {
    return (
      <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center">
        <Lock className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Sua conta não tem acesso a este indicador.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-24 flex-col items-center justify-center gap-3 text-center">
      <TriangleAlert className="size-5 text-destructive" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium">Não foi possível carregar</p>
        <p className="text-xs text-muted-foreground">
          {apiError?.message ?? "Tente novamente em instantes."}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Widget sem Read Model real no backend.
 *
 * Existe porque alguns widgets resolvidos por `GET /dashboard` só têm dados
 * fixos no código do backend. Preferimos declarar a ausência a exibir número
 * inventado. Ver `docs/dashboard.md`.
 */
export function WidgetWithoutSource({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center">
      <CircleOff className="size-5 text-muted-foreground" aria-hidden />
      <p className="max-w-sm text-sm text-muted-foreground">{reason}</p>
    </div>
  );
}

function WidgetRenderFailure({ error }: { error: Error }) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center">
      <TriangleAlert className="size-5 text-destructive" aria-hidden />
      <p className="text-sm font-medium">Widget indisponível</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        {process.env.NODE_ENV === "production"
          ? "Este painel não pôde ser exibido. O restante do dashboard continua funcionando."
          : error.message}
      </p>
    </div>
  );
}
