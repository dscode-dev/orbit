/**
 * API do Commercial Engine.
 *
 * ## Ações com nome de negócio
 *
 * Não há `PATCH /quotes/:id/status`. Enviar, aprovar, recusar e cancelar
 * registram coisas diferentes — quem enviou, quem decidiu, por quê — e um
 * campo genérico apagaria a distinção, além de permitir saltar de rascunho a
 * aprovado sem que nada tivesse sido proposto.
 *
 * ## Permissão comercial é independente
 *
 * `quotes.read` e `quotes.manage` não decorrem de `crm.read` nem de
 * `catalog.read`: ter a carteira de clientes ou a tabela de preços não é o
 * mesmo que poder propor um valor em nome da empresa. Quem só consulta
 * propostas também não pode aprová-las — aprovar move dinheiro previsto.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import { ParseUUIDv7Pipe } from '../../pipes';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import {
  Capabilities,
  RequiresActivePlan,
} from '../subscription-plans/plan-access';
import {
  AddQuoteItemDto,
  CancelQuoteDto,
  ConvertQuoteDto,
  CreateQuoteDto,
  QuoteQueryDto,
  RejectQuoteDto,
  UpdateQuoteDto,
  UpdateQuoteItemDto,
} from './quote.dto';
import { QuoteMapper } from './quote.mapper';
import { QuoteService } from './quote.service';

@ApiTags('Quotes')
@Controller('quotes')
@RequiresActivePlan()
export class QuoteController {
  constructor(
    private readonly quotes: QuoteService,
    private readonly mapper: QuoteMapper,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Leitura                                                           */
  /* ---------------------------------------------------------------- */

  @Get()
  @Capabilities('quotes.read')
  @Permissions('quotes.read')
  async list(@Req() request: IdentityRequest, @Query() query: QuoteQueryDto) {
    const result = await this.quotes.list(this.org(request), query);
    return {
      data: result.data.map((quote) => this.mapper.summary(quote)),
      meta: result.meta,
    };
  }

  @Get(':id')
  @Capabilities('quotes.read')
  @Permissions('quotes.read')
  async detail(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.mapper.detail(await this.quotes.get(id, this.org(request)));
  }

  /* ---------------------------------------------------------------- */
  /* Rascunho                                                          */
  /* ---------------------------------------------------------------- */

  @Post()
  @Capabilities('quotes.manage')
  @Permissions('quotes.manage')
  async create(@Req() request: IdentityRequest, @Body() input: CreateQuoteDto) {
    return this.mapper.detail(
      await this.quotes.create(
        this.org(request),
        request.identity?.businessUnitId ?? null,
        this.actor(request),
        input,
      ),
    );
  }

  @Patch(':id')
  @Capabilities('quotes.manage')
  @Permissions('quotes.manage')
  async update(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateQuoteDto,
  ) {
    return this.mapper.detail(
      await this.quotes.update(
        id,
        this.org(request),
        this.actor(request),
        input,
      ),
    );
  }

  /** Só rascunho. Proposta enviada é cancelada, não apagada. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Capabilities('quotes.manage')
  @Permissions('quotes.manage')
  async remove(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ): Promise<void> {
    await this.quotes.remove(id, this.org(request), this.actor(request));
  }

  /* ---------------------------------------------------------------- */
  /* Itens                                                             */
  /* ---------------------------------------------------------------- */

  @Post(':id/items')
  @Capabilities('quotes.manage')
  @Permissions('quotes.manage')
  async addItem(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: AddQuoteItemDto,
  ) {
    return this.mapper.detail(
      await this.quotes.addItem(
        id,
        this.org(request),
        this.actor(request),
        input,
      ),
    );
  }

  @Patch(':id/items/:itemId')
  @Capabilities('quotes.manage')
  @Permissions('quotes.manage')
  async updateItem(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('itemId', ParseUUIDv7Pipe) itemId: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateQuoteItemDto,
  ) {
    return this.mapper.detail(
      await this.quotes.updateItem(
        id,
        itemId,
        this.org(request),
        this.actor(request),
        input,
      ),
    );
  }

  @Delete(':id/items/:itemId')
  @Capabilities('quotes.manage')
  @Permissions('quotes.manage')
  async removeItem(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('itemId', ParseUUIDv7Pipe) itemId: string,
    @Req() request: IdentityRequest,
  ) {
    return this.mapper.detail(
      await this.quotes.removeItem(
        id,
        itemId,
        this.org(request),
        this.actor(request),
      ),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Transições                                                        */
  /* ---------------------------------------------------------------- */

  @Post(':id/send')
  @Capabilities('quotes.manage')
  @Permissions('quotes.manage')
  async send(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.mapper.detail(
      await this.quotes.send(id, this.org(request), this.actor(request)),
    );
  }

  /** Aprovar cria receita **prevista**, nunca realizada. */
  @Post(':id/approve')
  @Capabilities('quotes.manage')
  @Permissions('quotes.manage')
  async approve(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.mapper.detail(
      await this.quotes.approve(id, this.org(request), this.actor(request)),
    );
  }

  @Post(':id/reject')
  @Capabilities('quotes.manage')
  @Permissions('quotes.manage')
  async reject(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: RejectQuoteDto,
  ) {
    return this.mapper.detail(
      await this.quotes.reject(
        id,
        this.org(request),
        this.actor(request),
        input,
      ),
    );
  }

  @Post(':id/cancel')
  @Capabilities('quotes.manage')
  @Permissions('quotes.manage')
  async cancel(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: CancelQuoteDto,
  ) {
    return this.mapper.detail(
      await this.quotes.cancel(
        id,
        this.org(request),
        this.actor(request),
        input,
      ),
    );
  }

  /**
   * Converte a proposta aprovada em operação.
   *
   * Idempotente: repetir devolve a mesma operação. Exige também
   * `operations.manage` — criar trabalho em campo é ato do domínio de
   * operações, e quem só cuida de propostas não o abre sozinho.
   */
  @Post(':id/convert-to-operation')
  @Capabilities('quotes.manage', 'operations.manage')
  @Permissions('quotes.manage', 'operations.create')
  async convert(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: ConvertQuoteDto,
  ) {
    return this.mapper.detail(
      await this.quotes.convert(
        id,
        this.org(request),
        this.actor(request),
        input,
      ),
    );
  }

  private org(request: IdentityRequest): string {
    const id = request.identity?.organizationId;
    if (!id) throw new ForbiddenException('Organization context is required');
    return id;
  }

  private actor(request: IdentityRequest): string {
    const id = request.identity?.id;
    if (!id) throw new ForbiddenException('User context is required');
    return id;
  }
}
