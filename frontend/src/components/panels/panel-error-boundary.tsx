"use client";

/**
 * Error Boundary local de painel.
 *
 * Um painel que quebra ao renderizar (contrato divergente, campo ausente,
 * erro em biblioteca de gráfico) não pode derrubar a página inteira. O
 * boundary isola a falha no card e mantém o restante da página utilizável.
 *
 * Só cobre erros de renderização — falhas de rede são estado do TanStack
 * Query e aparecem como erro dentro do próprio `PanelFrame`.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Recebe o erro capturado e devolve o que renderizar no lugar. */
  fallback: (error: Error) => ReactNode;
  /** Identificador do painel, usado no log de desenvolvimento. */
  panelId: string;
}

interface State {
  error: Error | null;
}

export class PanelErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[panels] painel "${this.props.panelId}" falhou ao renderizar`,
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
