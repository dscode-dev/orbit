"use client";

/**
 * Error Boundary local de widget.
 *
 * Um widget que quebra ao renderizar (contrato divergente, campo ausente,
 * erro em biblioteca de gráfico) não pode derrubar o Dashboard inteiro. O
 * boundary isola a falha no card e mantém o restante do painel utilizável.
 *
 * Só cobre erros de renderização — falhas de rede são estado do TanStack
 * Query e aparecem como erro dentro do próprio `WidgetFrame`.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Recebe o erro capturado e devolve o que renderizar no lugar. */
  fallback: (error: Error) => ReactNode;
  /** Identificador do widget, usado no log de desenvolvimento. */
  widgetId: string;
}

interface State {
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[dashboard] widget "${this.props.widgetId}" falhou ao renderizar`,
        error,
        info.componentStack,
      );
    }
  }

  override render(): ReactNode {
    const { error } = this.state;
    return error ? this.props.fallback(error) : this.props.children;
  }
}
