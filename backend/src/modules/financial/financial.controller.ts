/**
 * API do Financeiro.
 *
 * ## Permissão financeira é independente
 *
 * Toda rota exige capability **e** permissão financeira. Quem administra a
 * operação ou o cliente relacionado ao lançamento não passa a ler o dinheiro
 * dele: `operations.read` e `crm.read` não abrem nada aqui, e o filtro por
 * `customerId` continua exigindo `financial.read`. O caminho de acesso não é o
 * critério — a permissão é.
 *
 * ## Leitura e escrita separadas
 *
 * `financial.read` vê; `financial.manage` lança, confirma e cancela. Um
 * operador que precisa consultar o que entrou não ganha o direito de criar
 * receita.
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
  CancelFinancialEntryDto,
  ConfirmFinancialEntryDto,
  CreateFinancialCategoryDto,
  CreateFinancialEntryDto,
  FinancialAnalyticsQueryDto,
  FinancialCategoryQueryDto,
  FinancialEntryQueryDto,
  UpdateFinancialCategoryDto,
  UpdateFinancialEntryDto,
  UpdateFinancialSettingsDto,
} from './financial.dto';
import { FinancialMapper } from './financial.mapper';
import { FinancialService } from './financial.service';

@ApiTags('Financial')
@Controller('financial')
@RequiresActivePlan()
export class FinancialController {
  constructor(
    private readonly financial: FinancialService,
    private readonly mapper: FinancialMapper,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Lançamentos                                                       */
  /* ---------------------------------------------------------------- */

  @Get('entries')
  @Capabilities('financial.read')
  @Permissions('financial.read')
  async entries(
    @Req() request: IdentityRequest,
    @Query() query: FinancialEntryQueryDto,
  ) {
    const result = await this.financial.list(this.org(request), query);
    return {
      data: result.data.map((entry) => this.mapper.entry(entry)),
      meta: result.meta,
    };
  }

  @Get('entries/:id')
  @Capabilities('financial.read')
  @Permissions('financial.read')
  async entry(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.mapper.entry(await this.financial.get(id, this.org(request)));
  }

  @Post('entries')
  @Capabilities('financial.manage')
  @Permissions('financial.manage')
  async createEntry(
    @Req() request: IdentityRequest,
    @Body() input: CreateFinancialEntryDto,
  ) {
    return this.mapper.entry(
      await this.financial.create(
        this.org(request),
        request.identity?.businessUnitId ?? null,
        this.actor(request),
        input,
      ),
    );
  }

  @Patch('entries/:id')
  @Capabilities('financial.manage')
  @Permissions('financial.manage')
  async updateEntry(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateFinancialEntryDto,
  ) {
    return this.mapper.entry(
      await this.financial.update(
        id,
        this.org(request),
        this.actor(request),
        input,
      ),
    );
  }

  @Post('entries/:id/confirm')
  @Capabilities('financial.manage')
  @Permissions('financial.manage')
  async confirmEntry(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: ConfirmFinancialEntryDto,
  ) {
    return this.mapper.entry(
      await this.financial.confirm(
        id,
        this.org(request),
        this.actor(request),
        input,
      ),
    );
  }

  /**
   * Cancelamento.
   *
   * `POST`, e não `DELETE`: o lançamento não é removido. Um `DELETE` que na
   * verdade preserva o registro mentiria sobre o que acontece, e é o tipo de
   * mentira que alguém acredita na hora de conferir o caixa.
   */
  @Post('entries/:id/cancel')
  @Capabilities('financial.manage')
  @Permissions('financial.manage')
  async cancelEntry(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: CancelFinancialEntryDto,
  ) {
    return this.mapper.entry(
      await this.financial.cancel(
        id,
        this.org(request),
        this.actor(request),
        input,
      ),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Categorias                                                        */
  /* ---------------------------------------------------------------- */

  @Get('categories')
  @Capabilities('financial.read')
  @Permissions('financial.read')
  async categories(
    @Req() request: IdentityRequest,
    @Query() query: FinancialCategoryQueryDto,
  ) {
    const items = await this.financial.listCategories(
      this.org(request),
      query.type,
    );
    return items.map((item) => this.mapper.category(item));
  }

  @Post('categories')
  @Capabilities('financial.manage')
  @Permissions('financial.manage')
  async createCategory(
    @Req() request: IdentityRequest,
    @Body() input: CreateFinancialCategoryDto,
  ) {
    return this.mapper.category(
      await this.financial.createCategory(this.org(request), input),
    );
  }

  @Patch('categories/:id')
  @Capabilities('financial.manage')
  @Permissions('financial.manage')
  async updateCategory(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateFinancialCategoryDto,
  ) {
    return this.mapper.category(
      await this.financial.updateCategory(id, this.org(request), input),
    );
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Capabilities('financial.manage')
  @Permissions('financial.manage')
  async removeCategory(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ): Promise<void> {
    await this.financial.removeCategory(id, this.org(request));
  }

  /* ---------------------------------------------------------------- */
  /* Analytics                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Fora de `/analytics`, de propósito.
   *
   * Aquele controlador exige `analytics.read` na classe inteira. Publicar
   * finanças ali daria faturamento a quem só tem indicadores operacionais. O
   * vocabulário é o mesmo — os Read Models de período e KPI são compartilhados
   * —, a porta é que é outra.
   */
  @Get('analytics/summary')
  @Capabilities('financial.read')
  @Permissions('financial.read')
  summary(
    @Req() request: IdentityRequest,
    @Query() query: FinancialAnalyticsQueryDto,
  ) {
    return this.financial.summary(this.org(request), query);
  }

  @Get('analytics/categories')
  @Capabilities('financial.read')
  @Permissions('financial.read')
  categoryBreakdown(
    @Req() request: IdentityRequest,
    @Query() query: FinancialAnalyticsQueryDto,
  ) {
    return this.financial.byCategory(this.org(request), query);
  }

  @Get('analytics/timeline')
  @Capabilities('financial.read')
  @Permissions('financial.read')
  timeline(
    @Req() request: IdentityRequest,
    @Query() query: FinancialAnalyticsQueryDto,
  ) {
    return this.financial.timeline(this.org(request), query);
  }

  /* ---------------------------------------------------------------- */
  /* Configuração                                                      */
  /* ---------------------------------------------------------------- */

  @Get('settings')
  @Capabilities('financial.read')
  @Permissions('financial.read')
  async settings(@Req() request: IdentityRequest) {
    return this.mapper.settings(
      await this.financial.settings(this.org(request)),
    );
  }

  @Patch('settings')
  @Capabilities('financial.manage')
  @Permissions('financial.manage')
  async updateSettings(
    @Req() request: IdentityRequest,
    @Body() input: UpdateFinancialSettingsDto,
  ) {
    return this.mapper.settings(
      await this.financial.updateSettings(
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
