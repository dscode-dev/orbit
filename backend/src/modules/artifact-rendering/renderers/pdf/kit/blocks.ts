/**
 * Os blocos com que um documento premium é montado.
 *
 * Cada função desenha **um** bloco a partir do cursor atual e deixa o cursor
 * abaixo dele. Nenhuma decide conteúdo: recebem o que mostrar e cuidam só de
 * medida, quebra e tinta.
 *
 * ## A quebra de página mora aqui
 *
 * É o ponto mais delicado do documento impresso. Uma tabela de equipamentos
 * com quarenta linhas não cabe numa página, e cortá-la em qualquer lugar
 * produz uma segunda página que começa com números soltos, sem dizer de que
 * coluna são. Por isso `table` mede linha a linha e, ao virar a página,
 * **repete o cabeçalho** marcando que aquilo é continuação.
 */
import { contentBottom, contentWidth, ensureSpace } from './page-frame';
import { FONTS, METRICS, type DocumentTheme } from './theme';

type Doc = PDFKit.PDFDocument;

/* ------------------------------------------------------------------ */
/* Títulos                                                             */
/* ------------------------------------------------------------------ */

/**
 * Título de seção.
 *
 * Exige espaço para o título **mais** um primeiro pedaço de conteúdo: um
 * título sozinho no pé da página é o defeito clássico do relatório impresso,
 * e quem lê vira a folha sem saber o que está começando.
 */
export function sectionTitle(
  document: Doc,
  texto: string,
  theme: DocumentTheme,
  options: { readonly espacoMinimo?: number } = {},
): void {
  ensureSpace(document, options.espacoMinimo ?? 72);

  document
    .font(FONTS.bold)
    .fontSize(12.5)
    .fillColor(theme.accent)
    .text(texto, { width: contentWidth(document) });

  const y = document.y + 3;
  document
    .save()
    .moveTo(document.page.margins.left, y)
    .lineTo(document.page.width - document.page.margins.right, y)
    .lineWidth(1)
    .strokeColor(theme.accent)
    .stroke()
    .restore();

  document.y = y + 9;
}

/* ------------------------------------------------------------------ */
/* Cartão de definições                                                */
/* ------------------------------------------------------------------ */

export interface DefinitionItem {
  readonly label: string;
  readonly value?: string | null;
  /** Ocupa a linha inteira — endereço, escopo, observação curta. */
  readonly full?: boolean;
}

/**
 * Pares rótulo/valor em duas colunas, dentro de um cartão.
 *
 * Duas colunas porque é a densidade que um documento de uma página suporta sem
 * virar formulário. O item marcado como `full` atravessa as duas — endereço
 * quebrado em duas colunas fica ilegível.
 *
 * O cartão é medido **antes** de ser desenhado: a moldura precisa saber a
 * altura final, e descobrir isso desenhando exigiria apagar e refazer.
 */
export function definitionCard(
  document: Doc,
  itens: readonly DefinitionItem[],
  theme: DocumentTheme,
): void {
  const visiveis = itens.filter((item) => item.value);
  if (visiveis.length === 0) return;

  const largura = contentWidth(document);
  const padding = 12;
  const colunaLargura = (largura - padding * 2 - METRICS.gutter) / 2;

  /* Medição: cada item vira uma altura, e os de meia largura são emparelhados
     dois a dois — a linha vale pela maior das duas alturas. */
  const medidos = visiveis.map((item) => {
    const larguraDoTexto = item.full ? largura - padding * 2 : colunaLargura;
    document.font(FONTS.regular).fontSize(9);
    const alturaDoValor = document.heightOfString(item.value ?? '', {
      width: larguraDoTexto,
    });
    return { item, larguraDoTexto, altura: 11 + alturaDoValor };
  });

  const linhas: (typeof medidos)[] = [];
  let pendente: typeof medidos = [];
  for (const medido of medidos) {
    if (medido.item.full) {
      if (pendente.length) {
        linhas.push(pendente);
        pendente = [];
      }
      linhas.push([medido]);
      continue;
    }
    pendente.push(medido);
    if (pendente.length === 2) {
      linhas.push(pendente);
      pendente = [];
    }
  }
  if (pendente.length) linhas.push(pendente);

  const alturaInterna = linhas.reduce(
    (total, linha) =>
      total + Math.max(...linha.map((medido) => medido.altura)) + 10,
    0,
  );
  const alturaTotal = alturaInterna + padding * 2 - 10;

  ensureSpace(document, alturaTotal + 8);

  const topo = document.y;
  const esquerda = document.page.margins.left;

  document
    .save()
    .roundedRect(esquerda, topo, largura, alturaTotal, METRICS.radius)
    .fillColor(theme.surface)
    .fill()
    .roundedRect(esquerda, topo, largura, alturaTotal, METRICS.radius)
    .lineWidth(0.5)
    .strokeColor(theme.border)
    .stroke()
    .restore();

  let y = topo + padding;
  for (const linha of linhas) {
    let x = esquerda + padding;
    for (const medido of linha) {
      document
        .font(FONTS.bold)
        .fontSize(6.5)
        .fillColor(theme.inkFaint)
        .text(medido.item.label.toUpperCase(), x, y, {
          width: medido.larguraDoTexto,
          characterSpacing: 0.4,
          lineBreak: false,
          ellipsis: true,
        });
      document
        .font(FONTS.regular)
        .fontSize(9)
        .fillColor(theme.ink)
        .text(medido.item.value ?? '', x, y + 10, {
          width: medido.larguraDoTexto,
        });
      x += colunaLargura + METRICS.gutter;
    }
    y += Math.max(...linha.map((medido) => medido.altura)) + 10;
  }

  document.y = topo + alturaTotal + 14;
  document.x = esquerda;
}

/* ------------------------------------------------------------------ */
/* Tabela                                                              */
/* ------------------------------------------------------------------ */

export interface TableColumn {
  readonly header: string;
  /** Peso relativo da largura; a soma é normalizada. */
  readonly weight: number;
  readonly align?: 'left' | 'center' | 'right';
  readonly mono?: boolean;
}

/**
 * Tabela com cabeçalho que se repete a cada página.
 *
 * ## Por que medir antes de desenhar cada linha
 *
 * Uma célula com texto longo ocupa duas ou três linhas, e só depois de medir
 * dá para saber se a linha ainda cabe. Desenhar primeiro e descobrir depois
 * produziria a metade de uma linha no pé de uma página e a outra metade no
 * topo da seguinte.
 *
 * ## O cabeçalho repetido diz que é continuação
 *
 * Sem isso, a página seguinte começa com uma tabela que parece nova. O sufixo
 * é discreto de propósito: quem está lendo em sequência não precisa dele, e
 * quem pegou a folha solta precisa.
 */
export function table(
  document: Doc,
  columns: readonly TableColumn[],
  rows: readonly (readonly (string | null | undefined)[])[],
  theme: DocumentTheme,
  options: { readonly continuationLabel?: string } = {},
): void {
  if (rows.length === 0) return;

  const largura = contentWidth(document);
  const esquerda = document.page.margins.left;
  const pesoTotal = columns.reduce((total, coluna) => total + coluna.weight, 0);
  const larguras = columns.map(
    (coluna) => (coluna.weight / pesoTotal) * largura,
  );
  const paddingX = 6;
  const paddingY = 5;

  const desenharCabecalho = (continuacao: boolean): void => {
    const alturaDoCabecalho = 20;
    const topo = document.y;

    document
      .save()
      .rect(esquerda, topo, largura, alturaDoCabecalho)
      .fillColor(theme.accentSoft)
      .fill()
      .restore();

    let x = esquerda;
    columns.forEach((coluna, indice) => {
      const texto =
        continuacao && indice === 0 && options.continuationLabel
          ? `${coluna.header} ${options.continuationLabel}`
          : coluna.header;
      document
        .font(FONTS.bold)
        .fontSize(6.8)
        .fillColor(theme.accent)
        .text(texto.toUpperCase(), x + paddingX, topo + 6.5, {
          width: larguras[indice]! - paddingX * 2,
          align: coluna.align ?? 'left',
          characterSpacing: 0.3,
          lineBreak: false,
          ellipsis: true,
        });
      x += larguras[indice]!;
    });

    document.y = topo + alturaDoCabecalho;
  };

  ensureSpace(document, 20 + 26);
  desenharCabecalho(false);

  rows.forEach((linha, indiceDaLinha) => {
    /* Medição antes de escrever: a altura da linha é a da célula mais alta. */
    const alturas = columns.map((coluna, indice) => {
      document.font(coluna.mono ? FONTS.mono : FONTS.regular).fontSize(8);
      return document.heightOfString(String(linha[indice] ?? '—'), {
        width: larguras[indice]! - paddingX * 2,
      });
    });
    const alturaDaLinha = Math.max(...alturas) + paddingY * 2;

    if (document.y + alturaDaLinha > contentBottom(document)) {
      document.addPage();
      desenharCabecalho(true);
    }

    const topo = document.y;

    /* Zebra discreta: ajuda o olho a atravessar linhas largas sem virar
       listrado de planilha. */
    if (indiceDaLinha % 2 === 1) {
      document
        .save()
        .rect(esquerda, topo, largura, alturaDaLinha)
        .fillColor(theme.surface)
        .fill()
        .restore();
    }

    let x = esquerda;
    columns.forEach((coluna, indice) => {
      document
        .font(coluna.mono ? FONTS.mono : FONTS.regular)
        .fontSize(8)
        .fillColor(theme.ink)
        .text(String(linha[indice] ?? '—'), x + paddingX, topo + paddingY, {
          width: larguras[indice]! - paddingX * 2,
          align: coluna.align ?? 'left',
        });
      x += larguras[indice]!;
    });

    document
      .save()
      .moveTo(esquerda, topo + alturaDaLinha)
      .lineTo(esquerda + largura, topo + alturaDaLinha)
      .lineWidth(0.4)
      .strokeColor(theme.border)
      .stroke()
      .restore();

    document.y = topo + alturaDaLinha;
  });

  document.y += 14;
  document.x = esquerda;
}

/* ------------------------------------------------------------------ */
/* Blocos de texto                                                     */
/* ------------------------------------------------------------------ */

/** Parágrafo dentro de um quadro — observações, conclusão, nota legal. */
export function noteBlock(
  document: Doc,
  texto: string,
  theme: DocumentTheme,
  options: { readonly title?: string } = {},
): void {
  const largura = contentWidth(document);
  const padding = 10;

  document.font(FONTS.regular).fontSize(9);
  const alturaDoTexto = document.heightOfString(texto, {
    width: largura - padding * 2,
  });
  const alturaDoTitulo = options.title ? 12 : 0;
  const alturaTotal = alturaDoTexto + alturaDoTitulo + padding * 2;

  ensureSpace(document, alturaTotal + 8);

  const topo = document.y;
  const esquerda = document.page.margins.left;

  document
    .save()
    .roundedRect(esquerda, topo, largura, alturaTotal, METRICS.radius)
    .fillColor(theme.surface)
    .fill()
    .roundedRect(esquerda, topo, largura, alturaTotal, METRICS.radius)
    .lineWidth(0.5)
    .strokeColor(theme.border)
    .stroke()
    .restore();

  if (options.title) {
    document
      .font(FONTS.bold)
      .fontSize(6.5)
      .fillColor(theme.inkFaint)
      .text(options.title.toUpperCase(), esquerda + padding, topo + padding, {
        width: largura - padding * 2,
        characterSpacing: 0.4,
      });
  }

  document
    .font(FONTS.regular)
    .fontSize(9)
    .fillColor(theme.ink)
    .text(texto, esquerda + padding, topo + padding + alturaDoTitulo, {
      width: largura - padding * 2,
    });

  document.y = topo + alturaTotal + 14;
  document.x = esquerda;
}

/** Legenda de um grupo dentro de uma seção — "Unidade evaporadora". */
export function groupLabel(
  document: Doc,
  texto: string,
  theme: DocumentTheme,
): void {
  ensureSpace(document, 56);
  document
    .font(FONTS.bold)
    .fontSize(9.5)
    .fillColor(theme.ink)
    .text(texto, { width: contentWidth(document) });
  document.y += 4;
  document.x = document.page.margins.left;
}
