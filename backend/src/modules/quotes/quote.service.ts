/**
 * Regras do Commercial Engine.
 *
 * ## A máquina de estados mora aqui — e só aqui
 *
 * ```
 * DRAFT ──send──▶ SENT ──approve──▶ APPROVED ──cancel──▶ CANCELLED
 *   │               │  ├─reject───▶ REJECTED
 *   │               │  ├─expira───▶ EXPIRED      (servidor, por validade)
 *   └──cancel───────┴──cancel────▶ CANCELLED
 * ```
 *
 * `REJECTED`, `EXPIRED` e `CANCELLED` são terminais. Não há endpoint genérico
 * de troca de status: cada transição tem nome de negócio, porque "enviar",
 * "aprovar" e "cancelar" registram coisas diferentes — quem enviou, quem
 * decidiu, por quê. Um `PATCH { status }` apagaria essa distinção e permitiria
 * pular de rascunho para aprovado sem que ninguém tivesse proposto nada.
 *
 * ## Conversão não é estado
 *
 * Ter virado operação é `operationId` preenchido. Um orçamento convertido
 * continua `APPROVED`: o que mudou não foi a proposta, foi a existência de
 * trabalho por causa dela.
 *
 * ## O que este domínio não faz
 *
 * Não emite nota, não cobra, não parcela, não calcula imposto nem comissão,
 * não move estoque e não mantém funil de vendas. Propõe um valor e registra a
 * resposta.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ConflictException,
  EntityNotFoundException,
  ValidationException,
} from '../../exceptions';
import { QuoteStatus } from '../../contracts';
import type {
  AddQuoteItemDto,
  CancelQuoteDto,
  ConvertQuoteDto,
  CreateQuoteDto,
  QuoteQueryDto,
  RejectQuoteDto,
  UpdateQuoteDto,
  UpdateQuoteItemDto,
} from './quote.dto';
import {
  QuoteRepository,
  type ItemSnapshot,
  type QuoteDetailRecord,
} from './quote.repository';

/** Moedas aceitas — as mesmas do Financeiro, que é onde o valor termina. */
const SUPPORTED_CURRENCIES: readonly string[] = ['BRL', 'USD', 'EUR'];

/**
 * De onde cada transição pode partir.
 *
 * Tabela em vez de `if` espalhado: é a definição autoritativa da máquina, e
 * uma linha a mais aqui é toda a mudança quando um estado novo aparecer.
 */
const TRANSITIONS = {
  send: [QuoteStatus.DRAFT],
  approve: [QuoteStatus.SENT],
  reject: [QuoteStatus.SENT],
  cancel: [QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.APPROVED],
} as const;

/** Só rascunho aceita edição de conteúdo — texto ou itens. */
const EDITABLE: readonly string[] = [QuoteStatus.DRAFT];

@Injectable()
export class QuoteService {
  constructor(private readonly repository: QuoteRepository) {}

  /* ---------------------------------------------------------------- */
  /* Leitura                                                           */
  /* ---------------------------------------------------------------- */

  async list(organizationId: string, query: QuoteQueryDto) {
    if (query.from && query.to && query.from > query.to) {
      throw new ValidationException('The period starts after it ends');
    }
    return this.repository.list(organizationId, query);
  }

  async get(id: string, organizationId: string): Promise<QuoteDetailRecord> {
    const quote = await this.repository.find(id, organizationId);
    if (!quote) throw new EntityNotFoundException('Quote', id);
    return quote;
  }

  /* ---------------------------------------------------------------- */
  /* Criação e edição                                                  */
  /* ---------------------------------------------------------------- */

  async create(
    organizationId: string,
    fallbackBusinessUnitId: string | null,
    actorId: string,
    input: CreateQuoteDto,
  ) {
    const businessUnitId = await this.resolveBusinessUnit(
      organizationId,
      input.businessUnitId ?? fallbackBusinessUnitId,
    );
    const customer = await this.repository.findCustomer(
      input.customerId,
      organizationId,
    );
    if (!customer) {
      throw new EntityNotFoundException('Customer', input.customerId);
    }

    const currency = input.currency ?? 'BRL';
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw new ValidationException('Unsupported currency');
    }
    this.requireFutureValidity(input.validUntil);

    return this.repository.create({
      organizationId,
      businessUnitId,
      customerId: input.customerId,
      title: input.title,
      notes: input.notes ?? null,
      validUntil: input.validUntil ? this.dateOnly(input.validUntil) : null,
      currency,
      createdById: actorId,
    });
  }

  async update(
    id: string,
    organizationId: string,
    actorId: string,
    input: UpdateQuoteDto,
  ) {
    const quote = await this.requireEditable(id, organizationId);
    if (input.validUntil) this.requireFutureValidity(input.validUntil);

    /**
     * O desconto é conferido contra o subtotal atual.
     *
     * A constraint do banco também o faz, mas devolver 400 com explicação é
     * melhor que 500 com violação de constraint — e o `recalculate` apararia o
     * valor em silêncio, que seria pior ainda: o usuário pediria 500 de
     * desconto e veria 300 sem entender por quê.
     */
    if (input.discount !== undefined) {
      const subtotal = Number(quote.subtotal);
      if (input.discount > subtotal) {
        throw new ValidationException(
          `Discount exceeds the quote subtotal (${quote.subtotal.toString()})`,
        );
      }
    }

    return this.repository.update(
      id,
      organizationId,
      quote.businessUnit.id,
      actorId,
      {
        title: input.title,
        notes: input.notes,
        validUntil: input.validUntil
          ? this.dateOnly(input.validUntil)
          : undefined,
      },
      {
        title: quote.title,
        discount: quote.discount.toString(),
        validUntil: quote.validUntil?.toISOString() ?? null,
      },
      input.discount === undefined ? undefined : input.discount.toFixed(2),
    );
  }

  /**
   * Remove um rascunho.
   *
   * Só `DRAFT`: proposta enviada não desaparece — ela é cancelada, e o motivo
   * fica. Apagar o que o cliente já viu destruiria a explicação de um negócio
   * perdido.
   */
  async remove(
    id: string,
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    const quote = await this.requireEditable(id, organizationId);
    await this.repository.softDelete(
      id,
      organizationId,
      quote.businessUnit.id,
      actorId,
    );
  }

  /* ---------------------------------------------------------------- */
  /* Itens                                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Acrescenta um item, congelando o que valia agora.
   *
   * Com `catalogItemId`, os campos ausentes vêm do Catálogo; os informados
   * sobrepõem, porque negociar preço é o que um orçamento faz. Sem ele,
   * descrição e preço passam a ser obrigatórios — é a regra que precisa ver os
   * dois campos juntos, e por isso mora aqui e não no DTO.
   */
  async addItem(
    quoteId: string,
    organizationId: string,
    actorId: string,
    input: AddQuoteItemDto,
  ) {
    const quote = await this.requireEditable(quoteId, organizationId);
    const snapshot = await this.snapshot(
      organizationId,
      quote.businessUnit.id,
      input,
    );
    return this.repository.addItem(
      quoteId,
      organizationId,
      quote.businessUnit.id,
      actorId,
      snapshot,
    );
  }

  async updateItem(
    quoteId: string,
    itemId: string,
    organizationId: string,
    actorId: string,
    input: UpdateQuoteItemDto,
  ) {
    const quote = await this.requireEditable(quoteId, organizationId);
    const item = await this.repository.findItem(itemId, quoteId);
    if (!item) throw new EntityNotFoundException('QuoteItem', itemId);

    return this.repository.updateItem(
      itemId,
      quoteId,
      organizationId,
      quote.businessUnit.id,
      actorId,
      {
        description: input.description,
        unit: input.unit,
        quantity:
          input.quantity === undefined ? undefined : input.quantity.toFixed(3),
        unitPrice:
          input.unitPrice === undefined
            ? undefined
            : input.unitPrice.toFixed(2),
        discount:
          input.discount === undefined ? undefined : input.discount.toFixed(2),
        notes: input.notes,
      },
      {
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        total: item.total.toString(),
      },
    );
  }

  async removeItem(
    quoteId: string,
    itemId: string,
    organizationId: string,
    actorId: string,
  ) {
    const quote = await this.requireEditable(quoteId, organizationId);
    const item = await this.repository.findItem(itemId, quoteId);
    if (!item) throw new EntityNotFoundException('QuoteItem', itemId);

    return this.repository.removeItem(
      itemId,
      quoteId,
      organizationId,
      quote.businessUnit.id,
      actorId,
      { description: item.description, total: item.total.toString() },
    );
  }

  /* ---------------------------------------------------------------- */
  /* Transições                                                        */
  /* ---------------------------------------------------------------- */

  /**
   * Envia a proposta ao cliente.
   *
   * Exige ao menos um item e um total maior que zero: enviar um orçamento
   * vazio ou de R$ 0,00 é enviar um documento que não propõe nada, e o cliente
   * não teria o que aprovar.
   *
   * Exige validade: uma proposta sem prazo é uma proposta que nunca expira, e
   * o preço de hoje passa a valer para sempre.
   */
  async send(id: string, organizationId: string, actorId: string) {
    const quote = await this.requireStatus(
      id,
      organizationId,
      TRANSITIONS.send,
    );

    if (quote._count.items === 0) {
      throw new ConflictException('A quote without items cannot be sent');
    }
    if (Number(quote.total) <= 0) {
      throw new ConflictException('A quote with no value cannot be sent');
    }
    if (!quote.validUntil) {
      throw new ConflictException(
        'A quote must have a validity date before it is sent',
      );
    }
    this.requireFutureValidity(quote.validUntil);

    return this.applied(
      await this.repository.transition({
        id,
        organizationId,
        businessUnitId: quote.businessUnit.id,
        actorId,
        from: TRANSITIONS.send,
        to: QuoteStatus.SENT,
        data: { sentAt: new Date(), sentById: actorId },
        action: 'QUOTE_SENT',
        details: { total: quote.total.toString() },
      }),
    );
  }

  /**
   * Aprovação do cliente.
   *
   * Dispara o evento que cria a **receita prevista** — nunca realizada: o
   * trabalho ainda não foi feito e o dinheiro não entrou. Confirmar é ato do
   * Financeiro, quando o pagamento acontecer.
   */
  async approve(id: string, organizationId: string, actorId: string) {
    const quote = await this.requireStatus(
      id,
      organizationId,
      TRANSITIONS.approve,
    );

    return this.applied(
      await this.repository.transition({
        id,
        organizationId,
        businessUnitId: quote.businessUnit.id,
        actorId,
        from: TRANSITIONS.approve,
        to: QuoteStatus.APPROVED,
        data: { decidedAt: new Date(), decidedById: actorId },
        action: 'QUOTE_APPROVED',
        details: { total: quote.total.toString() },
        event: true,
      }),
    );
  }

  async reject(
    id: string,
    organizationId: string,
    actorId: string,
    input: RejectQuoteDto,
  ) {
    const quote = await this.requireStatus(
      id,
      organizationId,
      TRANSITIONS.reject,
    );

    return this.applied(
      await this.repository.transition({
        id,
        organizationId,
        businessUnitId: quote.businessUnit.id,
        actorId,
        from: TRANSITIONS.reject,
        to: QuoteStatus.REJECTED,
        data: {
          decidedAt: new Date(),
          decidedById: actorId,
          closingReason: input.reason,
        },
        action: 'QUOTE_REJECTED',
        details: { reason: input.reason },
      }),
    );
  }

  /**
   * Cancela — inclusive depois de aprovado.
   *
   * O evento cancela a receita prevista correspondente, se houver, **sem
   * apagá-la**: a previsão existiu e alguém a viu no relatório. A operação já
   * criada por uma conversão **não é tocada**: se há trabalho em campo, quem
   * decide encerrá-lo é o domínio de operações, e desfazê-lo daqui apagaria
   * histórico de execução por causa de uma decisão comercial.
   */
  async cancel(
    id: string,
    organizationId: string,
    actorId: string,
    input: CancelQuoteDto,
  ) {
    const quote = await this.requireStatus(
      id,
      organizationId,
      TRANSITIONS.cancel,
    );

    return this.applied(
      await this.repository.transition({
        id,
        organizationId,
        businessUnitId: quote.businessUnit.id,
        actorId,
        from: TRANSITIONS.cancel,
        to: QuoteStatus.CANCELLED,
        data: { cancelledAt: new Date(), closingReason: input.reason },
        action: 'QUOTE_CANCELLED',
        details: { reason: input.reason },
        event: true,
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Conversão                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Transforma a proposta aprovada em trabalho.
   *
   * Só de `APPROVED`: converter um rascunho seria abrir ordem de serviço para
   * algo que ninguém contratou. Só uma vez: `operationId` guarda o resultado, e
   * repetir devolve a operação existente em vez de criar a segunda.
   *
   * **Nada é inventado.** Técnico, execução, checklist e agenda não são
   * atribuídos: o contrato de `Operation` os trata como decisões posteriores, e
   * escolhê-los aqui produziria uma ordem de serviço que ninguém combinou. O
   * que a conversão sabe é quem é o cliente, qual a unidade e o que foi
   * proposto.
   */
  async convert(
    id: string,
    organizationId: string,
    actorId: string,
    input: ConvertQuoteDto,
  ) {
    const quote = await this.get(id, organizationId);

    /** Já convertido: devolve o mesmo, sem criar nada. */
    if (quote.operationId) return quote;

    if (quote.status !== QuoteStatus.APPROVED) {
      throw new ConflictException(
        `Only an approved quote can become an operation (current: ${quote.status})`,
      );
    }
    if (input.scheduledStart && input.scheduledEnd) {
      if (input.scheduledEnd < input.scheduledStart) {
        throw new ValidationException(
          'Scheduled end cannot precede scheduled start',
        );
      }
    }

    const code = await this.operationCode(organizationId, quote.code);

    const converted = await this.repository.convert({
      quoteId: id,
      organizationId,
      businessUnitId: quote.businessUnit.id,
      customerId: quote.customer.id,
      actorId,
      code,
      kind: input.kind ?? 'MAINTENANCE',
      priority: input.priority ?? 'NORMAL',
      title: quote.title,
      description: `Originado do orçamento ${quote.code}.`,
      scheduledStart: input.scheduledStart ?? null,
      scheduledEnd: input.scheduledEnd ?? null,
    });

    /**
     * Perdeu a corrida: outra requisição converteu primeiro, e a operação
     * criada por esta desapareceu no rollback. O resultado correto é o que já
     * existe.
     */
    if (!converted) return this.get(id, organizationId);
    return converted;
  }

  /* ---------------------------------------------------------------- */
  /* Internos                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Congela o item.
   *
   * O preço do Catálogo é **sugestão inicial**, não vínculo: uma vez gravado,
   * o item não olha mais para lá. É o que permite mudar a tabela de preços sem
   * reescrever propostas já enviadas — e o que impede alguém de descobrir, seis
   * meses depois, que um orçamento antigo mudou de valor sozinho.
   */
  private async snapshot(
    organizationId: string,
    businessUnitId: string,
    input: AddQuoteItemDto,
  ): Promise<ItemSnapshot> {
    const quantity = input.quantity.toFixed(3);
    const discount = (input.discount ?? 0).toFixed(2);

    if (!input.catalogItemId) {
      if (!input.description || input.unitPrice === undefined) {
        throw new ValidationException(
          'An item without a catalog reference needs description and unitPrice',
        );
      }
      return {
        catalogItemId: null,
        kind: 'SERVICE',
        description: input.description,
        sku: null,
        unit: input.unit ?? 'UN',
        quantity,
        unitPrice: input.unitPrice.toFixed(2),
        discount,
        notes: input.notes ?? null,
      };
    }

    const product = await this.repository.findCatalogItem(
      input.catalogItemId,
      organizationId,
      businessUnitId,
    );
    if (!product) {
      throw new EntityNotFoundException('CatalogItem', input.catalogItemId);
    }
    if (product.status !== 'ACTIVE') {
      throw new ConflictException(
        'This catalog item is no longer offered and cannot be quoted',
      );
    }

    const price = input.unitPrice ?? this.decimal(product.salePrice);
    if (price === null) {
      throw new ValidationException(
        'The catalog item has no sale price; inform unitPrice explicitly',
      );
    }

    return {
      catalogItemId: product.id,
      kind: product.kind,
      description: input.description ?? product.name,
      sku: product.sku,
      unit: input.unit ?? product.unit,
      quantity,
      unitPrice: price.toFixed(2),
      discount,
      notes: input.notes ?? null,
    };
  }

  /**
   * Código da operação derivada.
   *
   * Deriva do código do orçamento — `ORC-000042` vira `OS-ORC-000042` — para
   * que a origem seja legível na listagem de operações sem abrir nada. Se
   * estiver ocupado, um sufixo curto resolve; o índice único do banco continua
   * sendo a autoridade.
   */
  private async operationCode(
    organizationId: string,
    quoteCode: string,
  ): Promise<string> {
    const seed = `OS-${quoteCode}`;
    const free = await this.repository.nextOperationCode(organizationId, seed);
    if (free) return free;
    return `${seed}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  }

  private async requireEditable(id: string, organizationId: string) {
    const quote = await this.get(id, organizationId);
    if (!EDITABLE.includes(quote.status)) {
      throw new ConflictException(
        `Only a draft quote can be changed (current: ${quote.status})`,
      );
    }
    return quote;
  }

  /**
   * Confere o estado de partida **depois** de expirar o que venceu.
   *
   * A ordem importa: sem expirar antes, uma proposta vencida ainda apareceria
   * como `SENT` e aceitaria aprovação — o cliente aprovaria um preço que já não
   * vale.
   */
  private async requireStatus(
    id: string,
    organizationId: string,
    allowed: readonly string[],
  ) {
    await this.repository.expire(organizationId);
    const quote = await this.get(id, organizationId);
    if (!allowed.includes(quote.status)) {
      throw new ConflictException(
        `This quote is ${quote.status} and cannot make that transition`,
      );
    }
    return quote;
  }

  /**
   * `null` significa que outra requisição mudou o estado no meio do caminho.
   *
   * A verificação anterior passou, a escrita condicional não — é a corrida de
   * dois cliques. Recusar é o certo: o segundo clique não deve sobrescrever
   * quem decidiu e quando.
   */
  private applied(quote: QuoteDetailRecord | null): QuoteDetailRecord {
    if (!quote) {
      throw new ConflictException(
        'The quote changed while this request was being processed',
      );
    }
    return quote;
  }

  private async resolveBusinessUnit(
    organizationId: string,
    candidate: string | null | undefined,
  ): Promise<string> {
    if (!candidate) {
      throw new ValidationException('A business unit is required');
    }
    const unit = await this.repository.findBusinessUnit(
      candidate,
      organizationId,
    );
    if (!unit) throw new EntityNotFoundException('BusinessUnit', candidate);
    return unit.id;
  }

  /** Validade no passado é proposta nascida vencida. */
  private requireFutureValidity(value: Date | null | undefined): void {
    if (!value) return;
    const day = this.dateOnly(value);
    const today = this.dateOnly(new Date());
    if (day < today) {
      throw new ValidationException('Validity date is in the past');
    }
  }

  /** Meia-noite UTC: a coluna é `DATE`, e hora só criaria diferença por fuso. */
  private dateOnly(value: Date): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private decimal(value: Prisma.Decimal | null): number | null {
    if (value === null) return null;
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }
}
