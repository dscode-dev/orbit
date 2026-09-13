/**
 * Alinhamento da central de documentos.
 *
 * A barra de busca dividia a linha com o resumo de resultados: ela parava
 * ~120px antes da borda enquanto as filas, o cartão de estado vazio e a
 * paginação iam até o fim da página. O olho lê isso como um campo torto, não
 * como duas colunas.
 *
 * A medida é a borda direita de cada bloco, no navegador real. Um teste visual
 * aprovaria qualquer largura; este reprova quando elas voltam a divergir.
 */
import { expect, test } from "@playwright/test";

import { login, settled } from "./support";

for (const largura of [1440, 1024]) {
  test(`a ${largura}px a busca acompanha a largura da lista`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await login(page);
    await page.goto("/documentos");
    await settled(page);

    const bordas = await page.evaluate(() => {
      const direita = (seletor: string) => {
        const elemento = document.querySelector(seletor);
        return elemento
          ? Math.round(elemento.getBoundingClientRect().right)
          : null;
      };
      return {
        busca: direita("#documents-search"),
        conteudo: direita('[role="tabpanel"] > div'),
      };
    });

    expect(bordas.busca, "a busca precisa existir").not.toBeNull();
    expect(bordas.conteudo, "a lista precisa existir").not.toBeNull();

    /** Um pixel de folga para arredondamento de subpixel. */
    expect(Math.abs(bordas.busca! - bordas.conteudo!)).toBeLessThanOrEqual(1);
  });
}
