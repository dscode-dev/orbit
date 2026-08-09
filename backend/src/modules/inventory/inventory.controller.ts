/**
 * API do Inventory Engine.
 *
 * ## Não existe rota que escreva quantidade
 *
 * Nenhum `PATCH /inventory/balances/:id`. Saldo é consequência de movimentos, e
 * um endpoint que o edite tornaria o livro decorativo — o número passaria a ser
 * a verdade, e o histórico, uma sugestão.
 *
 * O mínimo é a única escrita que não é movimento, e **não altera saldo**:
 * é política de reposição, não quantidade.
 *
 * ## Cada ação tem nome
 *
 * Entrada, consumo, devolução, ajuste e transferência significam coisas
 * diferentes no chão da oficina. Um `POST /movements { type }` genérico
 * permitiria registrar consumo como entrada por um erro de digitação, e o
 * ajuste — o único que exige motivo — deixaria de exigir.
 *
 * ## Acesso ao Catálogo não é acesso ao Estoque
 *
 * `inventory.read` e `inventory.manage` são independentes de `catalog.read`:
 * consultar a tabela de preços não é o mesmo que saber, ou mexer, no que há
 * fisicamente na prateleira de cada filial.
 */
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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
  InventoryAdjustmentDto,
  InventoryAnalyticsQueryDto,
  InventoryBalanceQueryDto,
  InventoryConsumptionDto,
  InventoryEntryDto,
  InventoryMinimumDto,
  InventoryMovementQueryDto,
  InventoryReturnDto,
  InventoryTransferDto,
} from './inventory.dto';
import { InventoryMapper } from './inventory.mapper';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@Controller('inventory')
@RequiresActivePlan()
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly mapper: InventoryMapper,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Saldos                                                            */
  /* ---------------------------------------------------------------- */

  @Get('balances')
  @Capabilities('inventory.read')
  @Permissions('inventory.read')
  async balances(
    @Req() request: IdentityRequest,
    @Query() query: InventoryBalanceQueryDto,
  ) {
    const result = await this.inventory.balances(this.org(request), query);
    return {
      data: result.data.map((balance) => this.mapper.balance(balance)),
      meta: result.meta,
    };
  }

  /**
   * Visão de um item: onde ele está, e quanto.
   *
   * Sem total da organização — somar quilos de gás de três filiais dá um
   * número que não corresponde a nenhuma prateleira.
   */
  @Get('items/:catalogItemId')
  @Capabilities('inventory.read')
  @Permissions('inventory.read')
  async item(
    @Param('catalogItemId', ParseUUIDv7Pipe) catalogItemId: string,
    @Req() request: IdentityRequest,
  ) {
    const { product, balances } = await this.inventory.item(
      this.org(request),
      catalogItemId,
    );
    return {
      item: { id: product.id, name: product.name, kind: product.kind },
      balances: balances.map((balance) => this.mapper.balance(balance)),
    };
  }

  /* ---------------------------------------------------------------- */
  /* Histórico                                                         */
  /* ---------------------------------------------------------------- */

  @Get('movements')
  @Capabilities('inventory.read')
  @Permissions('inventory.read')
  async movements(
    @Req() request: IdentityRequest,
    @Query() query: InventoryMovementQueryDto,
  ) {
    const result = await this.inventory.movements(this.org(request), query);
    return {
      data: result.data.map((movement) => this.mapper.movement(movement)),
      meta: result.meta,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Movimentos                                                        */
  /* ---------------------------------------------------------------- */

  @Post('entries')
  @Capabilities('inventory.manage')
  @Permissions('inventory.manage')
  async entry(
    @Req() request: IdentityRequest,
    @Body() input: InventoryEntryDto,
  ) {
    return this.movement(
      await this.inventory.entry(
        this.org(request),
        this.unit(request),
        this.actor(request),
        input,
      ),
    );
  }

  @Post('consumptions')
  @Capabilities('inventory.manage')
  @Permissions('inventory.manage')
  async consumption(
    @Req() request: IdentityRequest,
    @Body() input: InventoryConsumptionDto,
  ) {
    return this.movement(
      await this.inventory.consumption(
        this.org(request),
        this.unit(request),
        this.actor(request),
        input,
      ),
    );
  }

  @Post('returns')
  @Capabilities('inventory.manage')
  @Permissions('inventory.manage')
  async returned(
    @Req() request: IdentityRequest,
    @Body() input: InventoryReturnDto,
  ) {
    return this.movement(
      await this.inventory.return(
        this.org(request),
        this.unit(request),
        this.actor(request),
        input,
      ),
    );
  }

  /** Ajuste de contagem. O motivo é obrigatório — ver o DTO. */
  @Post('adjustments')
  @Capabilities('inventory.manage')
  @Permissions('inventory.manage')
  async adjustment(
    @Req() request: IdentityRequest,
    @Body() input: InventoryAdjustmentDto,
  ) {
    return this.movement(
      await this.inventory.adjustment(
        this.org(request),
        this.unit(request),
        this.actor(request),
        input,
      ),
    );
  }

  /**
   * Transferência entre unidades.
   *
   * Devolve as duas pontas. Nunca meia transferência: as duas escritas
   * acontecem na mesma transação, e a RLS exige acesso às duas unidades.
   */
  @Post('transfers')
  @Capabilities('inventory.manage')
  @Permissions('inventory.manage')
  async transfer(
    @Req() request: IdentityRequest,
    @Body() input: InventoryTransferDto,
  ) {
    const result = await this.inventory.transfer(
      this.org(request),
      this.actor(request),
      input,
    );

    if (!result) return { duplicated: true, transferId: null };

    return {
      transferId: result.transferId,
      out: this.mapper.movement(result.out),
      in: this.mapper.movement(result.in),
    };
  }

  /* ---------------------------------------------------------------- */
  /* Estoque mínimo                                                    */
  /* ---------------------------------------------------------------- */

  /**
   * `PUT` porque é idempotente: mandar o mesmo mínimo duas vezes é o mesmo
   * estado. Não é movimento e não toca no saldo.
   */
  @Put('minimums')
  @Capabilities('inventory.manage')
  @Permissions('inventory.manage')
  async minimum(
    @Req() request: IdentityRequest,
    @Body() input: InventoryMinimumDto,
  ) {
    return this.mapper.balance(
      await this.inventory.setMinimum(
        this.org(request),
        this.unit(request),
        this.actor(request),
        input,
      ),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Analytics                                                         */
  /* ---------------------------------------------------------------- */

  @Get('analytics/summary')
  @Capabilities('inventory.read')
  @Permissions('inventory.read')
  summary(
    @Req() request: IdentityRequest,
    @Query() query: InventoryAnalyticsQueryDto,
  ) {
    return this.inventory.summary(this.org(request), query);
  }

  @Get('analytics/consumption')
  @Capabilities('inventory.read')
  @Permissions('inventory.read')
  consumptionByItem(
    @Req() request: IdentityRequest,
    @Query() query: InventoryAnalyticsQueryDto,
  ) {
    return this.inventory.consumptionByItem(this.org(request), query);
  }

  /* ---------------------------------------------------------------- */
  /* Internos                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * `null` significa que a origem já produziu este movimento.
   *
   * Retry, não erro: a resposta diz que nada foi criado, e o cliente sabe que
   * o efeito já aconteceu.
   */
  private movement(record: Awaited<ReturnType<InventoryService['entry']>>) {
    if (!record) return { duplicated: true, movement: null };
    return { duplicated: false, movement: this.mapper.movement(record) };
  }

  private org(request: IdentityRequest): string {
    const id = request.identity?.organizationId;
    if (!id) throw new ForbiddenException('Organization context is required');
    return id;
  }

  private unit(request: IdentityRequest): string | null {
    return request.identity?.businessUnitId ?? null;
  }

  private actor(request: IdentityRequest): string {
    const id = request.identity?.id;
    if (!id) throw new ForbiddenException('User context is required');
    return id;
  }
}
