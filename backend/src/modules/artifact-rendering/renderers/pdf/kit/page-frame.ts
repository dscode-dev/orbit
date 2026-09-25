/**
 * A moldura da página: faixa de marca no topo, identificação no rodapé.
 *
 * ## Desenhada depois, não durante
 *
 * Cabeçalho e rodapé são pintados numa passada final sobre as páginas já
 * bufferizadas (`bufferPages`), e não no evento `pageAdded`. Dois motivos:
 *
 * - **"Página 3 de 7" exige saber o total.** Durante o fluxo ninguém sabe
 *   quantas páginas o documento terá; escrever "de 7" só é possível quando a
 *   última já existe.
 * - **Desenhar no meio do fluxo move o cursor.** Pintar o cabeçalho enquanto
 *   uma tabela transborda empurraria a linha seguinte para baixo do cabeçalho
 *   recém-desenhado, e a tabela continuaria no lugar errado.
 *
 * O espaço é reservado antes, pelas margens: o conteúdo nunca invade a área da
 * moldura porque ela não existe para o fluxo — existe só no fim.
 */
import type { DocumentEmitter } from './document-context';
import {
  FONTS,
  METRICS,
  brandGradient,
  shellGradient,
  type DocumentTheme,
} from './theme';

export interface FrameIdentity {
  /** "PMOC", "Ordem de Serviço" — o que o documento é. */
  readonly documentTitle: string;
  /** "PMOC-000023" — o número pelo qual ele é procurado. */
  readonly documentCode: string;
  readonly emitter?: DocumentEmitter;
  /** "Versão documental 1". */
  readonly revisionLabel?: string;
  /** Emissão já formatada no fuso de quem emite. */
  readonly issuedAtLabel?: string;
}

/** A largura útil entre as margens. */
export function contentWidth(document: PDFKit.PDFDocument): number {
  return (
    document.page.width -
    document.page.margins.left -
    document.page.margins.right
  );
}

/** Onde o conteúdo pode terminar antes de invadir o rodapé. */
export function contentBottom(document: PDFKit.PDFDocument): number {
  return document.page.height - document.page.margins.bottom;
}

/**
 * Garante espaço para o próximo bloco, abrindo página quando não houver.
 *
 * Devolve `true` quando quebrou — quem chama usa isso para repetir o cabeçalho
 * de uma tabela que continuou na página seguinte.
 */
export function ensureSpace(
  document: PDFKit.PDFDocument,
  needed: number,
): boolean {
  if (document.y + needed <= contentBottom(document)) return false;
  document.addPage();
  return true;
}

/**
 * Pinta a moldura em todas as páginas.
 *
 * Chamada uma vez, no fim, antes de `document.end()`.
 */
export function paintFrames(
  document: PDFKit.PDFDocument,
  identity: FrameIdentity,
  theme: DocumentTheme,
): void {
  const range = document.bufferedPageRange();
  const total = range.count;

  for (let indice = 0; indice < total; indice += 1) {
    document.switchToPage(range.start + indice);

    /**
     * A margem inferior é zerada enquanto a moldura é pintada.
     *
     * O rodapé é escrito **abaixo** da margem de conteúdo, que é justamente o
     * espaço reservado para ele. Só que `text()` interpreta uma escrita além da
     * margem inferior como "acabou a página" e **abre outra** — e como a
     * moldura é pintada em todas, cada rodapé criava uma página nova, que por
     * sua vez ganhava rodapé. O documento saía com o dobro de páginas, metade
     * em branco.
     *
     * Zerar a margem durante a pintura diz ao pdfkit que ali ainda é página.
     */
    const margemOriginal = document.page.margins.bottom;
    document.page.margins.bottom = 0;
    paintHeader(document, identity, theme, indice === 0);
    paintFooter(document, identity, theme, indice + 1, total);
    document.page.margins.bottom = margemOriginal;
  }
}

/**
 * O cabeçalho.
 *
 * ## Duas formas, e o motivo
 *
 * Na primeira página é uma faixa grafite de altura inteira: logo, nome do
 * documento em branco, código em pílula e o timbre de quem emite. É o que faz
 * a folha parecer papel timbrado em vez de saída de formulário, e é a única
 * página onde alguém olha o cabeçalho procurando informação.
 *
 * Da segunda em diante repetir esse bloco é desperdício — num laudo de seis
 * páginas seriam seis faixas escuras dizendo a mesma coisa. Ali fica só o
 * necessário para identificar a folha solta que caiu da grampeadora: filete da
 * marca, nome do documento e código.
 */
function paintHeader(
  document: PDFKit.PDFDocument,
  identity: FrameIdentity,
  theme: DocumentTheme,
  primeira: boolean,
): void {
  const esquerda = METRICS.pageMargin;
  const direita = document.page.width - METRICS.pageMargin;
  const largura = direita - esquerda;

  if (!primeira) {
    paintCompactHeader(document, identity, theme, esquerda, direita, largura);
    return;
  }

  const alturaDaFaixa = METRICS.headerHeight - 14;

  document.save();
  document
    .rect(0, 0, document.page.width, alturaDaFaixa)
    .fill(shellGradient(document, theme));
  /* O filete da marca fecha a faixa por baixo: é a transição do grafite para o
     branco do papel, e é onde o degradê tem largura para ser visto. */
  document
    .rect(0, alturaDaFaixa, document.page.width, 3)
    .fill(brandGradient(document, theme));
  document.restore();

  const topo = 22;
  const y = topo;

  /**
   * O logo fica **ao lado** do título, não acima dele.
   *
   * Empilhado, ele somava sua altura à do título e à da pílula do código, e o
   * conjunto estourava a faixa — a pílula encostava no filete. Lado a lado, o
   * logo ocupa a folga horizontal que já existia à esquerda e a faixa mantém
   * a altura, que é o que permite o resto do cabeçalho ter posição fixa.
   *
   * A largura reservada é fixa mesmo quando o logo é estreito: um título que
   * começa em posição diferente conforme a marca do inquilino faria cada
   * cliente receber um documento com composição própria.
   */
  const LARGURA_DO_LOGO = 74;
  let colunaDoTitulo = esquerda;

  if (identity.emitter?.logo) {
    try {
      /* `fit` já ancora em cima e à esquerda; passar `align`/`valign` aqui é
         o que o tipo de `pdfkit` recusa, e não mudaria o resultado. */
      document.image(identity.emitter.logo, esquerda, y, {
        fit: [LARGURA_DO_LOGO, 44],
      });
      colunaDoTitulo = esquerda + LARGURA_DO_LOGO + 16;
    } catch {
      /* Logo ilegível não derruba o documento: o nome cobre a identificação. */
    }
  }

  const recuo = colunaDoTitulo - esquerda;

  /**
   * O corpo do título cede para caber numa linha.
   *
   * `lineBreak: false` não impede o pdfkit de quebrar num espaço quando há
   * `width`, e "Relatório de Qualidade do Ar" em corpo 21 ocupava duas linhas
   * — empurrando a pílula do código contra o filete da faixa. Medir e reduzir
   * até caber mantém a faixa com altura previsível, que é o que permite o
   * resto do cabeçalho ter posição fixa.
   */
  const larguraDoTitulo = largura * 0.56 - recuo;
  let corpoDoTitulo = 21;
  document.font(FONTS.bold);
  while (
    corpoDoTitulo > 12 &&
    document.fontSize(corpoDoTitulo).widthOfString(identity.documentTitle) >
      larguraDoTitulo
  ) {
    corpoDoTitulo -= 1;
  }

  document
    .font(FONTS.bold)
    .fontSize(corpoDoTitulo)
    .fillColor(theme.onShell)
    .text(identity.documentTitle, colunaDoTitulo, y + 2, {
      width: larguraDoTitulo,
      lineBreak: false,
      ellipsis: true,
    });

  pill(document, identity.documentCode, colunaDoTitulo, document.y + 6, theme);

  /* O timbre fica à direita, alinhado à direita: é onde o olho procura quem
     emitiu, e é o que o documento impresso precisa provar. */
  const emitter = identity.emitter;
  if (emitter) {
    const linhas = [
      emitter.legalName,
      emitter.document,
      [emitter.cityState, emitter.phone].filter(Boolean).join(' · '),
      emitter.email,
    ].filter((linha): linha is string => Boolean(linha));

    const colunaX = esquerda + largura * 0.58;
    const colunaLargura = largura * 0.42;
    let yDireita = topo;

    if (emitter.tradeName) {
      document
        .font(FONTS.bold)
        .fontSize(10.5)
        .fillColor(theme.onShell)
        .text(emitter.tradeName, colunaX, yDireita, {
          width: colunaLargura,
          align: 'right',
        });
      yDireita = document.y + 2;
    }

    document.font(FONTS.regular).fontSize(7.5).fillColor(theme.onShellMuted);
    for (const linha of linhas) {
      document.text(linha, colunaX, yDireita, {
        width: colunaLargura,
        align: 'right',
      });
      yDireita = document.y;
    }
  }
}

/** Da segunda página em diante: o mínimo para identificar a folha. */
function paintCompactHeader(
  document: PDFKit.PDFDocument,
  identity: FrameIdentity,
  theme: DocumentTheme,
  esquerda: number,
  direita: number,
  largura: number,
): void {
  document.save();
  document
    .rect(0, 0, document.page.width, 3)
    .fill(brandGradient(document, theme));
  document.restore();

  const y = 26;
  const rotulo = [identity.emitter?.tradeName, identity.documentTitle]
    .filter(Boolean)
    .join('  ·  ');

  document
    .font(FONTS.bold)
    .fontSize(8.5)
    .fillColor(theme.ink)
    .text(rotulo, esquerda, y, {
      width: largura * 0.7,
      lineBreak: false,
      ellipsis: true,
    });

  document
    .font(FONTS.bold)
    .fontSize(8.5)
    .fillColor(theme.accent)
    .text(identity.documentCode, esquerda + largura * 0.7, y, {
      width: largura * 0.3,
      align: 'right',
      lineBreak: false,
    });

  const linhaY = y + 15;
  document
    .save()
    .moveTo(esquerda, linhaY)
    .lineTo(direita, linhaY)
    .lineWidth(0.5)
    .strokeColor(theme.border)
    .stroke()
    .restore();
}

/**
 * O código do documento numa pílula com o degradê.
 *
 * Um código em texto solto some no meio do timbre. Na pílula ele vira o
 * segundo elemento que se lê depois do nome do documento — que é a ordem em
 * que alguém procura um papel específico numa pasta.
 */
function pill(
  document: PDFKit.PDFDocument,
  texto: string,
  x: number,
  y: number,
  theme: DocumentTheme,
): void {
  document.font(FONTS.bold).fontSize(8.5);
  const larguraDoTexto = document.widthOfString(texto);
  const padding = 9;
  const largura = larguraDoTexto + padding * 2;
  const altura = 16;

  document
    .save()
    .roundedRect(x, y, largura, altura, altura / 2)
    .fill(brandGradient(document, theme))
    .restore();

  document
    .fillColor('#FFFFFF')
    .text(texto, x + padding, y + 4.5, { lineBreak: false });
}

function paintFooter(
  document: PDFKit.PDFDocument,
  identity: FrameIdentity,
  theme: DocumentTheme,
  pagina: number,
  total: number,
): void {
  const esquerda = METRICS.pageMargin;
  const direita = document.page.width - METRICS.pageMargin;
  const largura = direita - esquerda;
  const base = document.page.height - METRICS.footerHeight + 8;

  document
    .save()
    .moveTo(esquerda, base)
    .lineTo(direita, base)
    .lineWidth(0.5)
    .strokeColor(theme.border)
    .stroke()
    .restore();

  const emitter = identity.emitter;
  const identificacao = [
    emitter?.tradeName ?? emitter?.legalName,
    emitter?.phone,
    emitter?.email,
    identity.documentCode,
    identity.revisionLabel,
    identity.issuedAtLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  const numeracao = `Página ${pagina} de ${total}`;
  const larguraDaNumeracao = 90;

  document
    .font(FONTS.regular)
    .fontSize(7)
    .fillColor(theme.inkFaint)
    .text(identificacao, esquerda, base + 6, {
      width: largura - larguraDaNumeracao - 8,
      lineBreak: false,
      ellipsis: true,
    });

  document
    .font(FONTS.regular)
    .fontSize(7)
    .fillColor(theme.inkMuted)
    .text(numeracao, direita - larguraDaNumeracao, base + 6, {
      width: larguraDaNumeracao,
      align: 'right',
      lineBreak: false,
    });
}
