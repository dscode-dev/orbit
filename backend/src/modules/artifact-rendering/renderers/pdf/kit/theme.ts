/**
 * O tema dos documentos premium.
 *
 * ## Por que existe um tema, e não cores soltas no desenho
 *
 * O documento sai com a marca de quem o emite: a cor de destaque vem de
 * `layout.visualIdentity` do template e muda por organização. Espalhar
 * `#1d4ed8` pelo código faria a metade esquecida continuar azul quando alguém
 * configurasse verde — e ninguém repara num rodapé.
 *
 * ## As cores neutras não acompanham a marca
 *
 * Só o destaque é do cliente. Texto, bordas e superfícies continuam sendo os
 * mesmos em qualquer organização, porque é o que garante que o documento
 * continue legível quando a cor escolhida for clara demais, escura demais ou
 * simplesmente feia. A marca decora; o contraste é responsabilidade nossa.
 */
import { safeColor } from '../../html/html-safe';

export interface DocumentTheme {
  /** A cor da organização, já validada. */
  readonly accent: string;
  /** Uma versão clara do destaque, para preenchimentos. */
  readonly accentSoft: string;
  readonly ink: string;
  readonly inkMuted: string;
  readonly inkFaint: string;
  readonly border: string;
  readonly surface: string;
  readonly surfaceStrong: string;
}

const PADRAO = '#1d4ed8';

/**
 * Uma versão clara da cor de destaque, para faixas e cabeçalhos de tabela.
 *
 * Misturada com branco em vez de usar opacidade: pdfkit aplica opacidade ao
 * estado gráfico inteiro, e um preenchimento translúcido acabaria clareando a
 * borda e o texto desenhados em seguida.
 */
function clarear(hex: string, proporcao: number): string {
  const limpo = hex.replace('#', '');
  const canal = (posicao: number) =>
    Number.parseInt(limpo.slice(posicao, posicao + 2), 16);
  const misturar = (valor: number) =>
    Math.round(valor + (255 - valor) * proporcao)
      .toString(16)
      .padStart(2, '0');
  return `#${misturar(canal(0))}${misturar(canal(2))}${misturar(canal(4))}`;
}

export function buildTheme(primaryColor?: string): DocumentTheme {
  const accent = safeColor(primaryColor) || PADRAO;
  return {
    accent,
    accentSoft: clarear(accent, 0.9),
    ink: '#111827',
    inkMuted: '#4b5563',
    inkFaint: '#9ca3af',
    border: '#e5e7eb',
    surface: '#f9fafb',
    surfaceStrong: '#f3f4f6',
  };
}

/** Medidas em pontos (1 pt = 1/72 pol). A4 tem 595 × 842. */
export const METRICS = {
  pageMargin: 40,
  /** Altura reservada no topo para a faixa de marca e o cabeçalho. */
  headerHeight: 96,
  /** Altura reservada no rodapé para a linha de identificação. */
  footerHeight: 44,
  gutter: 14,
  radius: 4,
} as const;

export const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  mono: 'Courier',
} as const;
