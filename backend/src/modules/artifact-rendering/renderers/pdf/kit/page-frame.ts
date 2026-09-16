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
import { FONTS, METRICS, type DocumentTheme } from './theme';

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
    paintHeader(document, identity, theme);
    paintFooter(document, identity, theme, indice + 1, total);
    document.page.margins.bottom = margemOriginal;
  }
}

function paintHeader(
  document: PDFKit.PDFDocument,
  identity: FrameIdentity,
  theme: DocumentTheme,
): void {
  const esquerda = METRICS.pageMargin;
  const direita = document.page.width - METRICS.pageMargin;
  const largura = direita - esquerda;

  /* A faixa de marca sangra até a borda: é o que dá ao documento o aspecto de
     papel timbrado em vez de folha de formulário. */
  document.save();
  document.rect(0, 0, document.page.width, 6).fill(theme.accent);
  document.restore();

  const topo = 26;
  let alturaDaMarca = 0;

  if (identity.emitter?.logo) {
    try {
      /* `fit` já ancora em cima e à esquerda; passar `align`/`valign` aqui é
         o que o tipo de `pdfkit` recusa, e não mudaria o resultado. */
      document.image(identity.emitter.logo, esquerda, topo, {
        fit: [116, 40],
      });
      alturaDaMarca = 44;
    } catch {
      /* Logo ilegível não derruba o documento: o nome cobre a identificação. */
      alturaDaMarca = 0;
    }
  }

  document
    .font(FONTS.bold)
    .fontSize(alturaDaMarca ? 15 : 18)
    .fillColor(theme.ink)
    .text(identity.documentTitle, esquerda, topo + alturaDaMarca, {
      width: largura * 0.5,
      lineBreak: false,
    });

  document
    .font(FONTS.bold)
    .fontSize(9)
    .fillColor(theme.accent)
    .text(identity.documentCode, esquerda, document.y + 1, {
      width: largura * 0.5,
      lineBreak: false,
    });

  /* A identificação de quem emite fica à direita, alinhada à direita: é onde o
     olho procura o timbre, e é o que o documento impresso precisa provar. */
  const emitter = identity.emitter;
  if (emitter) {
    const linhas = [
      emitter.legalName,
      emitter.document,
      [emitter.cityState, emitter.phone].filter(Boolean).join(' · '),
      emitter.email,
    ].filter((linha): linha is string => Boolean(linha));

    const colunaX = esquerda + largura * 0.52;
    const colunaLargura = largura * 0.48;
    let y = topo;

    if (emitter.tradeName) {
      document
        .font(FONTS.bold)
        .fontSize(10)
        .fillColor(theme.ink)
        .text(emitter.tradeName, colunaX, y, {
          width: colunaLargura,
          align: 'right',
        });
      y = document.y + 1;
    }

    document.font(FONTS.regular).fontSize(7.5).fillColor(theme.inkMuted);
    for (const linha of linhas) {
      document.text(linha, colunaX, y, {
        width: colunaLargura,
        align: 'right',
      });
      y = document.y;
    }
  }

  /* A régua fecha o cabeçalho e separa do conteúdo sem pedir espaço vertical. */
  const linhaY = METRICS.headerHeight - 12;
  document
    .save()
    .moveTo(esquerda, linhaY)
    .lineTo(direita, linhaY)
    .lineWidth(0.5)
    .strokeColor(theme.border)
    .stroke()
    .restore();
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
